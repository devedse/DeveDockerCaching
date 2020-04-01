"use strict";

import * as fs from "fs";
import * as path from "path";
import tl from "azure-pipelines-task-lib/task";
import RegistryAuthenticationToken from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "./docker-common-v2/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "./docker-common-v2/dockercommandutils";
import * as pipelineUtils from "./docker-common-v2/pipelineutils";
import * as fileUtils from "./docker-common-v2/fileutils";

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any, isBuildAndPushCommand?: boolean): any {

    // find dockerfile path
    let dockerfilepath = tl.getInput("Dockerfile", true)!;
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);


    
        
    let endpointId = tl.getInput("containerRegistry");
    let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId!);


    // get qualified image names by combining container registry(s) and repository
    let repositoryName = tl.getInput("repository");
    let imageNames: string[] = [];    
    // if container registry is provided, use that
    // else, use the currently logged in registries
    if (tl.getInput("containerRegistry")) {
        let imageName = connection.getQualifiedImageName(repositoryName!, true);
        if (imageName) {
            imageNames.push(imageName);
        }
    }
    else {
        imageNames = connection.getQualifiedImageNamesFromConfig(repositoryName!, true);
    }

    // if (imageNames.length > 1) {
    //     tl.setResult(tl.TaskResult.Failed, 'More then one ');
    // }

    console.log("Image names:");
    imageNames.forEach(imageName => {
        console.log(`Image Name Found: ${imageName.replace('e', '<e>')}`);
    });
}