"use strict";

import * as del from "del";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "azure-pipelines-task-lib/task";
import * as tr from "azure-pipelines-task-lib/toolrunner";
import * as imageUtils from "./containerimageutils";
import AuthenticationToken from "./registryauthenticationprovider/registryauthenticationtoken"
import * as fileutils from "./fileutils";
import * as os from "os";

export default class ContainerConnection {
    private dockerPath: string;
    public hostUrl!: string;
    public certsDir!: string;
    private caPath!: string;
    private certPath!: string;
    private keyPath!: string;
    private registryAuth!: { [key: string]: string };
    private configurationDirPath!: string | undefined;
    private oldDockerConfigContent!: string | null;

    constructor(isDockerRequired: boolean = true) {
        this.dockerPath = tl.which("docker", isDockerRequired);        
    }

    public createCommand(): tr.ToolRunner {
        var command = tl.tool(this.dockerPath);
        if (this.hostUrl) {
            command.arg(["-H", this.hostUrl]);
            command.arg("--tls");
            command.arg("--tlscacert='" + this.caPath + "'");
            command.arg("--tlscert='" + this.certPath + "'");
            command.arg("--tlskey='" + this.keyPath + "'");
        }
        return command;
    }

    public execCommand(command: tr.ToolRunner, options?: tr.IExecOptions): Q.Promise<number> {
        let errlines = Array<string>();
        let dockerHostVar = tl.getVariable("DOCKER_HOST");
        if (dockerHostVar) {
            tl.debug(`DOCKER_HOST variable is set. Docker will try to connect to the Docker host: ${dockerHostVar}`);
        }

        command.on("errline", line => {
            errlines.push(line);
        });
        return command.exec(options).fail(error => {            
            if (dockerHostVar) {
                tl.warning(`DOCKER_HOST variable is set. Please ensure that the Docker daemon is running on: ${dockerHostVar}`);
            }

            errlines.forEach(line => tl.error(line));
            throw error;
        });
    }

    public open(hostEndpoint?: string, authenticationToken?: AuthenticationToken, multipleLoginSupported?: boolean, doNotAddAuthToConfig?: boolean): void {
        this.openHostEndPoint(hostEndpoint);
        this.openRegistryEndpoint(authenticationToken, multipleLoginSupported, doNotAddAuthToConfig);
    }

    public getQualifiedImageNameIfRequired(imageName: string) {
        if (!imageUtils.hasRegistryComponent(imageName)) {
            imageName = this.getQualifiedImageName(imageName);
        }

        return imageName;
    }

    public getQualifiedImageName(repository: string, enforceDockerNamingConvention?: boolean): string {
        let imageName = repository ? repository : "";
        if (repository && this.registryAuth) {
            imageName = this.prefixRegistryIfRequired(this.registryAuth["registry"], repository);
        }

        return enforceDockerNamingConvention ? imageUtils.generateValidImageName(imageName) : imageName;
    }

    public getQualifiedImageNamesFromConfig(repository: string, enforceDockerNamingConvention?: boolean) {
        let imageNames: string[] = [];
        if (repository) {
            let regUrls = this.getRegistryUrlsFromDockerConfig();
            if (regUrls && regUrls.length > 0) {
                regUrls.forEach(regUrl => {
                    let imageName = this.prefixRegistryIfRequired(regUrl, repository);
                    if (enforceDockerNamingConvention) {
                        imageName = imageUtils.generateValidImageName(imageName);
                    }
                    
                    imageNames.push(imageName);
                });
            }
            else {
                // in case there is no login information found and a repository is specified, the intention
                // might be to tag the image to refer locally.
                let imageName = repository;
                if (enforceDockerNamingConvention) {
                    imageName = imageUtils.generateValidImageName(imageName);
                }
                
                imageNames.push(imageName);
            }
        }

        return imageNames;
    }

    public close(multipleLoginSupported?: boolean, command?: string): void {
        if (multipleLoginSupported) {
            if (this.isLogoutRequired(command)) {
                this.logout();
            }
        }
        else {
            if (this.configurationDirPath && fs.existsSync(this.configurationDirPath)) {
                del.sync(this.configurationDirPath, {force: true});
            }
            if (this.certsDir && fs.existsSync(this.certsDir)) {
                del.sync(this.certsDir);
            }
        }
    }
    
    public setDockerConfigEnvVariable() {
        if (this.configurationDirPath && fs.existsSync(this.configurationDirPath)) {
            tl.setVariable("DOCKER_CONFIG", this.configurationDirPath);
        }
        else {
            tl.error("Docker registry service connection not specified.");
            throw new Error("Docker registry service connection not specified.");
        }
    }
    
    public unsetDockerConfigEnvVariable() {
        var dockerConfigPath = tl.getVariable("DOCKER_CONFIG");
        if (dockerConfigPath) {
            this.unsetEnvironmentVariable();
            del.sync(dockerConfigPath, {force: true});
        }    
    }

    private logout() {
        // If registry info is present, remove auth for only that registry. (This can happen for any command - build, push, logout etc.)
        // Else, remove all auth data. (This would happen only in case of logout command. For other commands, logout is not called.)
        let registry = this.registryAuth ? this.registryAuth["registry"] : "";
        if (registry) {
            tl.debug(`Trying to logout from registry: ${registry}`);
            let existingConfigurationFile = this.getExistingDockerConfigFilePath();

            if (existingConfigurationFile) {
                if (this.oldDockerConfigContent) {
                    // restore the old docker config, cached in connection.open()
                    tl.debug(`Restoring the previous login auth data for the registry: ${registry}`);
                    this.writeDockerConfigJson(this.oldDockerConfigContent, existingConfigurationFile);
                }
                else {                    
                    let existingConfigJson = this.getDockerConfigJson(existingConfigurationFile);
                    if (existingConfigJson && existingConfigJson.auths && existingConfigJson.auths[registry]) {
                        if (Object.keys(existingConfigJson.auths).length > 1) {
                            // if the config contains other auths, then delete only the auth entry for the regist`ry
                            tl.debug(`Found login info for other registry(s). Trying to remove auth from the Docker config for the registry: ${registry}`);                        
                            delete existingConfigJson.auths[registry];
                            let dockerConfigContent = JSON.stringify(existingConfigJson);
                            tl.debug(`Deleting auth data for registry from Docker config file. Registry: ${registry}, New Docker config: ${dockerConfigContent}`);
                            this.writeDockerConfigJson(dockerConfigContent, existingConfigurationFile);
                        }
                        else {
                            // if no other auth data is present, delete the config file and unset the DOCKER_CONFIG variable
                            tl.debug(`Deleting Docker config directory. Path: ${existingConfigurationFile}`);
                            this.removeConfigDirAndUnsetEnvVariable();
                        }
                    }
                    else {
                        // trying to logout from a registry where no login was done. Nothing to be done here.
                        tl.debug(`Could not find the auth data for registry in the Docker config file. Nothing to be done to logout. Registry: ${registry}`);
                    }
                }
            }
            else {
                // should not come to this in a good case, since when registry is provided, we are adding docker config
                // to a temp directory and setting DOCKER_CONFIG variable to its path.
                tl.debug(`Could not find Docker Config. Either DOCKER_CONFIG variable is not set, or the config file is outside the temp directory, or the file does not exist. DOCKER_CONFIG: ${this.configurationDirPath}`);
                this.unsetEnvironmentVariable();
            }
        }        
        // unset the docker config env variable, and delete the docker config file (if present)
        else {
            tl.debug("Logging out. Removing all auth data from temp docker config, since no registry is specified.");
            this.removeConfigDirAndUnsetEnvVariable();
        }
    }

    private removeConfigDirAndUnsetEnvVariable(): void {
        let dockerConfigDirPath = tl.getVariable("DOCKER_CONFIG");
        if (dockerConfigDirPath && this.isPathInTempDirectory(dockerConfigDirPath) && fs.existsSync(dockerConfigDirPath)) {
            tl.debug(`Deleting Docker config directory. Path: ${dockerConfigDirPath}`);
            del.sync(dockerConfigDirPath, {force: true});
        }
        
        this.unsetEnvironmentVariable();
    }

    private unsetEnvironmentVariable(): void {
        tl.setVariable("DOCKER_CONFIG", "");        
    }

    private isLogoutRequired(command?: string): boolean {
        return command === "logout" || (this.registryAuth != null && this.registryAuth != undefined && this.registryAuth["registry"] != null);
    }

    private openHostEndPoint(hostEndpoint?: string): void {
        if (hostEndpoint) {
            this.hostUrl = tl.getEndpointUrl(hostEndpoint, false);
            if (this.hostUrl.charAt(this.hostUrl.length - 1) == "/") {
                this.hostUrl = this.hostUrl.substring(0, this.hostUrl.length - 1);
            }

            this.certsDir = path.join("", ".dockercerts");
            if (!fs.existsSync(this.certsDir)) {
                fs.mkdirSync(this.certsDir);
            }

            var authDetails = tl.getEndpointAuthorization(hostEndpoint, false)!.parameters;

            this.caPath = path.join(this.certsDir, "ca.pem");
            fs.writeFileSync(this.caPath, authDetails["cacert"]);

            this.certPath = path.join(this.certsDir, "cert.pem");
            fs.writeFileSync(this.certPath, authDetails["cert"]);

            this.keyPath = path.join(this.certsDir, "key.pem");
            fs.writeFileSync(this.keyPath, authDetails["key"]);
        }
    }
    
    protected openRegistryEndpoint(authenticationToken?: AuthenticationToken, multipleLoginSupported?: boolean, doNotAddAuthToConfig?: boolean): void {        
        this.oldDockerConfigContent = null;
        if (authenticationToken) {     
            this.registryAuth = {};

            this.registryAuth["username"] = authenticationToken.getUsername();
            this.registryAuth["password"] = authenticationToken.getPassword();
            this.registryAuth["registry"] = authenticationToken.getLoginServerUrl();

            // don't add auth data to config file if doNotAddAuthToConfig is true.
            // In this case we only need this.registryAuth to be populated correctly (to logout from this particular registry when close() is called) but we don't intend to login.
            if (this.registryAuth && !doNotAddAuthToConfig) {
                let existingConfigurationFile = this.getExistingDockerConfigFilePath();

                if (multipleLoginSupported && existingConfigurationFile) {
                    let existingConfigJson = this.getDockerConfigJson(existingConfigurationFile);
                    if (existingConfigJson && existingConfigJson.auths) {
                        let newAuth = authenticationToken.getDockerAuth();
                        let newAuthJson = JSON.parse(newAuth);
                        // Think of json object as a dictionary and authJson looks like 
                        //      "auths": {
                        //          "aj.azurecr.io": {
                        //              "auth": "***",
                        //              "email": "***"
                        //          }
                        //      }
                        //    key will be aj.azurecr.io
                        //
                        for (let registryName in newAuthJson) {
                            
                            // If auth is already present for the same registry, then cache it so that we can 
                            // preserve it back on logout. 
                            if (existingConfigJson.auths[registryName]) {
                                this.oldDockerConfigContent = JSON.stringify(existingConfigJson);
                                tl.debug(`Found an earlier login to the same registry. Saving old auth data and continuing with the new login. Old docker config: ${this.oldDockerConfigContent}`);
                            }

                            existingConfigJson.auths[registryName] = newAuthJson[registryName];
                            tl.debug(`Adding auth data for registry to Docker config file. Registry: ${registryName}.`);
                        }

                        let dockerConfigContent = JSON.stringify(existingConfigJson);
                        this.writeDockerConfigJson(dockerConfigContent, existingConfigurationFile);
                    }
                }
                else {
                    var json = authenticationToken.getDockerConfig();
                    this.writeDockerConfigJson(json);
                }                
            }
        }
    }

    private getExistingDockerConfigFilePath(): string | null {
        this.configurationDirPath = tl.getVariable("DOCKER_CONFIG");
        let configurationFilePath = this.configurationDirPath ? path.join(this.configurationDirPath, "config.json") : "";                
        if (this.configurationDirPath && this.isPathInTempDirectory(configurationFilePath) && fs.existsSync(configurationFilePath)) {
            return configurationFilePath;
        }

        return null;
    }

    private getDockerConfigJson(configurationFilePath : string): any {
        let configJson: any;
        let dockerConfig = fs.readFileSync(configurationFilePath, "utf-8");
        tl.debug(`Found the Docker Config stored in the temp path. Docker config path: ${configurationFilePath}, Docker config: ${dockerConfig}`);
        try {
            configJson = JSON.parse(dockerConfig);
        }
        catch(err) {
            let errorMessage = `Could not parse the Docker config obtained from the file. Error: ${err}`;
            throw new Error(errorMessage);
        }

        return configJson;
    }

    private writeDockerConfigJson(dockerConfigContent: string, configurationFilePath?: string): void {
        if (!configurationFilePath){
            this.configurationDirPath  = this.getDockerConfigDirPath();
            process.env["DOCKER_CONFIG"] = this.configurationDirPath;
            configurationFilePath = path.join(this.configurationDirPath, "config.json");    
        }
    
        tl.debug(`Writing Docker config to temp file. File path: ${configurationFilePath}, Docker config: ${dockerConfigContent}`);
        if(fileutils.writeFileSync(configurationFilePath, dockerConfigContent) == 0) {
            tl.error(`No data was written into the file ${configurationFilePath}`);
            throw new Error(`No data was written into the file ${configurationFilePath}`);
        }
    }

    private getDockerConfigDirPath(): string {
        var configDir = path.join(this.getTempDirectory(), "DockerConfig_"+Date.now());
        this.ensureDirExists(configDir);
        return configDir;
    } 

    private ensureDirExists(dirPath : string) : void
    {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath);
            var privateKeyDir= path.join(dirPath, "trust", "private");
            tl.mkdirP(privateKeyDir);
        }
    }

    private getTempDirectory(): string {
        return tl.getVariable('agent.tempDirectory') || os.tmpdir();
    }

    private getRegistryUrlsFromDockerConfig(): string[] {
        let regUrls: string[] = [];        
        let existingConfigurationFile = this.getExistingDockerConfigFilePath();
        if (existingConfigurationFile) {            
            let existingConfigJson = this.getDockerConfigJson(existingConfigurationFile);
            if (existingConfigJson && existingConfigJson.auths) {
                regUrls = Object.keys(existingConfigJson.auths);
            }
            else {
                tl.debug("No auths found in Docker config. Hence returning 0 registry url's.");
            }
        }
        else {
            tl.debug(`Could not find Docker Config. Either DOCKER_CONFIG variable is not set, or the config file is outside the temp directory, or the file does not exist. DOCKER_CONFIG: ${this.configurationDirPath}`);
        }

        return regUrls;
    }

    private isPathInTempDirectory(path: string | null): boolean {
        let tempDir = this.getTempDirectory();
        let result = (path != null && path != undefined) && path.startsWith(tempDir);
        if (!result) {
            tl.debug(`The config path is not inside the temp directory. Config path: ${path}, Temp directory: ${tempDir}`);
        }

        return result;
    }

    private prefixRegistryIfRequired(registry: string, repository: string): string {
        let imageName = repository;

        if (registry) {
            let regUrl = url.parse(registry);
            let hostname = !regUrl.slashes ? regUrl.href : regUrl.host;
            // For docker hub, repository name is the qualified image name. Prepend hostname if the registry is not docker hub.
            if (hostname!.toLowerCase() !== "index.docker.io") {
                imageName = hostname + "/" + repository;
            }
        }

        return imageName;
    }
}
