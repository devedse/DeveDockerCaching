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

    console.log("Starting Docker Cache Push...");

    // find dockerfile path
    let dockerfilepath = tl.getInput("Dockerfile", true)!;
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);

    console.log(`Docker file path: ${dockerfilepath}`);
    console.log(`Docker file: ${dockerFile}`);

    let dockerBuildOutput = tl.getInput("dockerBuildOutput", true)!;
    console.log("Docker build output:");
    console.log(dockerBuildOutput);

    let foundPath = helpers.findDockerOutputFilePath(dockerBuildOutput, "build");
    console.log(`Found path: ${foundPath}`);

    if (helpers.stringNullOrEmpty(foundPath)) {
        throw new Error(`Could not find docker output file path in this string:\n${dockerBuildOutput}`);
    }
    let fileData = fs.readFileSync(foundPath!, 'utf8');

    console.log(`Docker file data:\n${fileData}`);

    
    
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
    
    let imageIdsToPush = helpers.findIdsInDockerBuildLog(fileData);
    let imageNamesToPush = helpers.determineFullyQualifiedDockerNamesForTags(imageIdsToPush, imageName, repositoryName, cacheImagePostfix);

    for (let i = 0; i < imageNamesToPush.length; i++) {
        let val = imageNamesToPush[i];

        console.log(`Tagging ${val.stageId} as ${val.cacheImageName}`);

        let totalOutput = "";
        await dockerCommandUtils.command(connection, 'tag', `"${val.stageId}" "${val.cacheImageName}"`, (thisOutput) => { totalOutput += `${thisOutput}\n` });

        console.log("Output:");
        console.log(totalOutput);
    }
}
