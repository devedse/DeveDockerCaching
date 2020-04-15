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
    console.log("\nStarting Docker Compose Cache Pull...");
    let cacheImagePostfix = tl.getInput("cacheImagePostfix")!;

    // Change to any specified working directory
    const cwd = tl.getInput("cwd")!;
    console.log(`Changing directory to: ${cwd}`);
    tl.cd(cwd);

    console.log();

    console.log("Opening Docker-Compose connection...");
    var dockerComposeConnection = new DockerComposeConnection(connection);
    try {
        await dockerComposeConnection.open();
        console.log();
        
        console.log("Generating final compose file...")
        let finalComposeFile = fs.readFileSync(dockerComposeConnection.finalComposeFile, 'utf8');

        console.log(`Final compose file:\n${finalComposeFile}`);
        console.log();

        let imageNamesDockerCompose = helpers.findImageNamesInDockerComposeFile(finalComposeFile);
    }
    finally {
        dockerComposeConnection.close();
    }
}