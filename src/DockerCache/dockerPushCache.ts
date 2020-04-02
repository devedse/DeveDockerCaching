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

export function run(connection: ContainerConnection, outputUpdate: (data: string) => any, isBuildAndPushCommand?: boolean): any {

    console.log("Starting Docker Cache Push...");

    // find dockerfile path
    let dockerfilepath = tl.getInput("Dockerfile", true)!;
    let dockerFile = fileUtils.findDockerFile(dockerfilepath);

    console.log(`Docker file path: ${dockerfilepath}`);
    console.log(`Docker file: ${dockerFile}`);

    let dockerBuildOutput = tl.getInput("dockerBuildOutput", true)!;
    console.log("Docker build output:");
    console.log(dockerBuildOutput);

    let foundPath = findPath(dockerBuildOutput, "build");
    console.log(`Found path: ${foundPath}`);
}


function findPath(dockerBuildOutput: string, thingToFind: string): string | undefined {
    var paths = dockerBuildOutput.split(/\r?\n/);

    let indexOfLast: number = -1;
    let foundPath: string | undefined = undefined;

    paths.forEach(str => {
        var i = str.indexOf(thingToFind);
        if (i > indexOfLast) {
            foundPath = str;
            indexOfLast = i;
        }
    });

    return foundPath;
}