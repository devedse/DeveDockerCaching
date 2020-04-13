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
import DockerComposeConnection from "./docker-compose-common/dockercomposeconnection";

export async function run(connection: ContainerConnection, outputUpdate: (data: string) => any, isBuildAndPushCommand?: boolean): Promise<void> {
    console.log("Starting Docker Compose Cache Push...");
    let cacheImagePostfix = tl.getInput("cacheImagePostfix")!;
    let dockerBuildOutput = tl.getInput("dockerBuildOutput", true)!;

    console.log(`Docker build output:\n${dockerBuildOutput}\n`);
    let foundPath = helpers.findDockerOutputFilePath(dockerBuildOutput, "build");
    console.log(`Build log file to process: ${foundPath}`);

    if (helpers.stringNullOrEmpty(foundPath)) {
        throw new Error(`Could not find docker output file path in this string:\n${dockerBuildOutput}`);
    }
    let fileData = fs.readFileSync(foundPath!, 'utf8');
    console.log();

    console.log("Opening Docker-Compose connection...");
    var dockerComposeConnection = new DockerComposeConnection(connection);
    try {
        await dockerComposeConnection.open();
        
        console.log("Generating final compose file...")
        let finalComposeFile = fs.readFileSync(dockerComposeConnection.finalComposeFile, 'utf8');

        console.log(`Final compose file:\n${finalComposeFile}`);
        console.log();

        let imageNamesDockerCompose = helpers.findImageNamesInDockerComposeFile(finalComposeFile);
        imageNamesDockerCompose = helpers.splitDockerComposeBuildLog(imageNamesDockerCompose, fileData);

        console.log();
        console.log("Obtaining id's from individual docker build logs...")

        for (let y = 0; y < imageNamesDockerCompose.length; y++) {
            let curItem = imageNamesDockerCompose[y];
            console.log(`Processing item: ${y} ServiceName: ${curItem.serviceName} Index in log: ${curItem.indexInLog} Length in log: ${curItem.buildLogForThisImage?.length}`);

            console.log(`\tFinding Id's to push for ${curItem.serviceName}...`);
            let imageIdsToPush = helpers.findIdsInDockerBuildLog(curItem.buildLogForThisImage);
            console.log(`\tFinding Fully Qualified Docker names to push for ${curItem.serviceName}...`);
            let imageNamesToPush = helpers.determineFullyQualifiedDockerNamesForTags(imageIdsToPush, curItem.imageName, cacheImagePostfix);

            console.log(`\tStarting Tagging and Pushing for ${curItem.serviceName}...`);

            for (let i = 0; i < imageNamesToPush.length; i++) {
                let val = imageNamesToPush[i];
                console.log(`\tTagging and Pushing ${i}: ${val.cacheImageName}`);

                let totalOutput = "";

                console.log(`\t\tTagging ${val.stageId} as ${val.cacheImageName}...`);
                await dockerCommandUtils.command(connection, 'tag', `"${val.stageId}" "${val.cacheImageName}"`, (thisOutput) => totalOutput += `${thisOutput}\n`);

                console.log(`\t\tPushing ${val.cacheImageName}...`);
                await dockerCommandUtils.push(connection, val.cacheImageName, "", (thisOutput) => totalOutput += `${thisOutput}\n`);
                
                console.log(`\t\tAdditional command output: ${totalOutput}`);
            }
        }
    }
    finally {
        dockerComposeConnection.close();
    }
}