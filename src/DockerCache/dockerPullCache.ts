"use strict";

import * as fs from "fs";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";
import RegistryAuthenticationToken from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "./docker-common-v2/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "./docker-common-v2/dockercommandutils";
import * as pipelineUtils from "./docker-common-v2/pipelineutils";
import * as fileUtils from "./docker-common-v2/fileutils";
import * as helpers from "./helpers";

export async function run(connection: ContainerConnection, outputUpdate: (data: string) => any, isBuildAndPushCommand?: boolean): Promise<void> {

    console.log("Starting Docker Cache Pull...");

    // find dockerfile path
    let dockerfilepath = tl.getInput("Dockerfile", true)!;
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);

    console.log(`Docker file path: ${dockerfilepath}`);
    console.log(`Docker file: ${dockerFile}`);





    // get qualified image names by combining container registry(s) and repository
    let repositoryName = tl.getInput("repository")!;
    let cacheImagePostfix = tl.getInput("cacheImagePostfix")!;
    let imageNames: string[] = [];    
    // if container registry is provided, use that
    // else, use the currently logged in registries
    if (tl.getInput("containerRegistry")) {
        let imageName = connection.getQualifiedImageName(repositoryName, true);
        if (imageName) {
            imageNames.push(imageName);
        }
    }
    else {
        imageNames = connection.getQualifiedImageNamesFromConfig(repositoryName, true);
    }
    
    if (imageNames.length != 1) {
        throw new Error(`ImageName length should be exaclty 1, it is: ${imageNames.length}`);
    }
    
    let imageName = imageNames[0];
    



    let dockerFileContent = fs.readFileSync(dockerFile, 'utf8');
    let stagesInDockerFile = helpers.countStagesInDockerFile(dockerFileContent);

    
    let stagingImageName = helpers.convertToCachedImageName(imageName, repositoryName, cacheImagePostfix);

    let cacheArgumentDockerBuild = "";

    for (let i = 0; i < stagesInDockerFile; i++) {
        let fullImageName = `${stagingImageName}:${i}`;

        console.log(`Pulling ${fullImageName}`);

        let totalOutput = "Output:";
        await dockerCommandUtils.pull(connection, fullImageName, "", (thisOutput) => totalOutput += `${thisOutput}\n`)
        console.log(totalOutput);        

        cacheArgumentDockerBuild += `--cache-from=${fullImageName} `;
    }    

    console.log(`cacheArgumentDockerBuild: ${cacheArgumentDockerBuild}`);

    tl.setVariable("cacheArgumentDockerBuild", cacheArgumentDockerBuild);
}