import tl = require('azure-pipelines-task-lib/task');
import RegistryAuthenticationToken from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import ContainerConnection from "./docker-common-v2/containerconnection";
import { getDockerRegistryEndpointAuthenticationToken } from "./docker-common-v2/registryauthenticationprovider/registryauthenticationtoken";
import * as dockerCommandUtils from "./docker-common-v2/dockercommandutils";

async function run() {
    try {
        const inputString: string | undefined = tl.getInput('samplestring', true);
        if (inputString == 'bad') {
            tl.setResult(tl.TaskResult.Failed, 'Bad input was given');
            return;
        }
        console.log('Hello', inputString);



        let endpointId = tl.getInput("containerRegistry");
        let registryAuthenticationToken: RegistryAuthenticationToken = getDockerRegistryEndpointAuthenticationToken(endpointId!);

        let connection = new ContainerConnection();
        connection.open(null!, registryAuthenticationToken, true, false);

        const dockerfilepath = tl.getInput("dockerFile", true);



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

        console.log("Image names:");
        imageNames.forEach(imageName => {
            console.log(`Image Name Found: ${imageName}`);
        });

        //dockerCommandUtils.pull(connection, )
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();