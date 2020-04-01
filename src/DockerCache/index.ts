import * as tl from "azure-pipelines-task-lib/task";
import RegistryAuthenticationToken from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "./docker-common-v2/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "./docker-common-v2/dockercommandutils";






async function run() {
    try {
        let endpointId = tl.getInput("containerRegistry");
        let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId!);

        let command = tl.getInput("action", true)!;

        // Connect to any specified container registry
        let connection = new ContainerConnection();
        connection.open(null!, registryAuthenticationToken, true, false);
        
        var dockerCommandMap: { [id: string] : string; } = {
            "dockerPullCache": "./dockerPullCache",
            "dockerPushCache": "./dockerPushCache",
            "dockerComposePullCache": "./dockerComposePullCache",
            "dockerComposePushCache": "./dockerComposePushCache",
        };
        
        let commandImplementation = require("./dockercommand");
        if (command in dockerCommandMap) {
            commandImplementation = require(dockerCommandMap[command]);
        }
        

        let resultPaths = "";
        await commandImplementation.run(connection, (pathToResult: string) => {
            resultPaths += pathToResult;    
        })
        

        //dockerCommandUtils.pull(connection, )
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();