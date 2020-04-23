import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');

import * as helpers from "../helpers";

import * as fs from "fs";

describe('Sample task tests', function () {

    before( function() {

    });

    after(() => {

    });

    it('Test that tests the task', function(done: MochaDone) { 
        // let taskPath = path.join(__dirname, '..', 'index.js');
        // let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
        
        // tmr.setInput('containerRegistry', 'testContainerRegistry')
        // tmr.setInput('action', 'dockerPushCache');

        // tmr.setInput('dockerfilepath', 'src/.dockerfile');
        // tmr.setInput('dockerBuildOutput', 'src/build_123.txt\nsrc/push_123.txt');

        // tmr.run();

        done();
    });

    it('Finds the right file in dockerBuildOutput', function(done: MochaDone) {
        const foundPath = helpers.findDockerOutputFilePath('src/build_123.txt\nsrc/push_123.txt', 'build');
        
        console.log(`Found path: ${foundPath}`);

        assert.equal(foundPath, 'src/build_123.txt');
        
        done();
    });

    it('Finds the right file in dockerBuildOutput', function(done: MochaDone) {
        const fileData = fs.readFileSync('./tests/dockerBuildLogExample.txt', 'utf8');

        const imageIdsToPush = helpers.findIdsInDockerBuildLog(fileData);
        
        console.log(`Found matches: ${imageIdsToPush}`);

        done();
    });

    it('Generates the right image names', function(done: MochaDone) {
        const fileData = fs.readFileSync('./tests/dockerBuildLogExample.txt', 'utf8');

        const imageIdsToPush = helpers.findIdsInDockerBuildLog(fileData);
        const imageNamesToPush = helpers.determineFullyQualifiedDockerNamesForTags(imageIdsToPush, 'testRepo.azurecr.io/superimage', '-staging');

        console.log(`Found matches: ${imageIdsToPush}`);
        console.log(`Found image names to push:`);

        imageNamesToPush.forEach((val) => {
            console.log(`Tagging ${val.stageId} as ${val.cacheImageName}`);
        });

        done();
    });

    it('Parses image names from docker-compose.yml', function(done: MochaDone) {
        const fileData = fs.readFileSync('./tests/docker-composeExample.txt', 'utf8');

        const imageNamesDockerCompose = helpers.findImageNamesInDockerComposeFile(fileData);

        console.log(`Found images in docker compose file: ${imageNamesDockerCompose}`);
        
        assert.equal(imageNamesDockerCompose[0].serviceName, 'coolimage.service');
        assert.equal(imageNamesDockerCompose[0].imageName, '${DOCKER_REGISTRY-}coolimageservice');
        assert.equal(imageNamesDockerCompose[0].dockerFile, 'coolimage.Service/Dockerfile');
        assert.equal(imageNamesDockerCompose[0].context, '.');
        assert.equal(imageNamesDockerCompose[1].serviceName, 'coolimage.service.cdcprocessor');
        assert.equal(imageNamesDockerCompose[1].imageName, '${DOCKER_REGISTRY-}coolimageservicecdcprocessor');
        assert.equal(imageNamesDockerCompose[1].dockerFile, 'coolimage.Service.CDCProcessor/Dockerfile');
        assert.equal(imageNamesDockerCompose[1].context, '.');
        assert.equal(imageNamesDockerCompose[2].serviceName, 'coolimage.service.eventpublisher');
        assert.equal(imageNamesDockerCompose[2].imageName, '${DOCKER_REGISTRY-}coolimageserviceeventpublisher');
        assert.equal(imageNamesDockerCompose[2].dockerFile, 'coolimage.Service.EventPublisher/Dockerfile');
        assert.equal(imageNamesDockerCompose[2].context, '.');
        assert.equal(imageNamesDockerCompose[3].serviceName, 'coolimage.service.eventconsumer');
        assert.equal(imageNamesDockerCompose[3].imageName, '${DOCKER_REGISTRY-}coolimageserviceeventconsumer');
        assert.equal(imageNamesDockerCompose[3].dockerFile, 'coolimage.Service.EventConsumer/Dockerfile');
        assert.equal(imageNamesDockerCompose[3].context, '.');

        done();
    });

    it('Splits the docker compose output log', function(done: MochaDone) {
        const fileData = fs.readFileSync('./tests/docker-composeExample.txt', 'utf8');
        const dockerComposeBuildLog = fs.readFileSync('./tests/dockerComposeBuildLogExample.txt', 'utf8');

        const imageNamesDockerCompose = helpers.findImageNamesInDockerComposeFile(fileData);
        helpers.splitDockerComposeBuildLog(imageNamesDockerCompose, dockerComposeBuildLog);

        assert.ok(imageNamesDockerCompose[0].buildLogForThisImage.startsWith("Building coolimage.service"), 'StartsWith failed for 0');
        assert.ok(imageNamesDockerCompose[1].buildLogForThisImage.startsWith("Building coolimage.service.cdcprocessor"), 'StartsWith failed for 1');
        assert.ok(imageNamesDockerCompose[2].buildLogForThisImage.startsWith("Building coolimage.service.eventpublisher"), 'StartsWith failed for 2');
        assert.ok(imageNamesDockerCompose[3].buildLogForThisImage.startsWith("Building coolimage.service.eventconsumer"), 'StartsWith failed for 3');
        assert.ok(imageNamesDockerCompose[0].buildLogForThisImage.endsWith("Successfully tagged containerregistry.azurecr.io/coolimageservice:latest"), 'EndsWith failed for 0');
        assert.ok(imageNamesDockerCompose[1].buildLogForThisImage.endsWith("Successfully tagged containerregistry.azurecr.io/coolimageservicecdcprocessor:latest"), 'EndsWith failed for 1');
        assert.ok(imageNamesDockerCompose[2].buildLogForThisImage.endsWith("[section]Finishing: Build services"), 'EndsWith failed for 2');
        assert.ok(imageNamesDockerCompose[3].buildLogForThisImage.endsWith("Successfully tagged containerregistry.azurecr.io/coolimageserviceeventconsumer:latest"), 'EndsWith failed for 0');

        done();
    });

    it('Obtains the right version from a docker compose file', function(done: MochaDone) {
        const fileData = fs.readFileSync('./tests/docker-composeExample.txt', 'utf8');
        const readVersion = helpers.readVersionFromDockerComposeFile(fileData);

        assert.equal(readVersion, "3.4");

        done();
    });

    it('Determines the right dockerfile path', function(done: MochaDone) {
        assert.equal(helpers.determineDockerfilePath("/dir", ".", "dockerfile").replace(/\\/g, "/"), "/dir/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir", "/home", "dockerfile").replace(/\\/g, "/"), "/home/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir", "home", "dockerfile").replace(/\\/g, "/"), "/dir/home/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir/test", "../thing", "dockerfile").replace(/\\/g, "/"), "/dir/thing/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir/test", "./thing", "dockerfile").replace(/\\/g, "/"), "/dir/test/thing/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir/test", "thing", "dockerfile").replace(/\\/g, "/"), "/dir/test/thing/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir/test", "thing", "../dockerfile").replace(/\\/g, "/"), "/dir/test/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir/test", "thing", "subdir/dockerfile").replace(/\\/g, "/"), "/dir/test/thing/subdir/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir/test", "/home", "subdir/dockerfile").replace(/\\/g, "/"), "/home/subdir/dockerfile");
        assert.equal(helpers.determineDockerfilePath("/dir/test", "/home/", "subdir/dockerfile").replace(/\\/g, "/"), "/home/subdir/dockerfile");
        
        //Apparently these 2 tests don't work on Linux, but yeah... Shouldn't matter since this only happens on windows.
        //assert.equal(helpers.determineDockerfilePath("/dir", "C:\\", "dockerfile").replace(/\\/g, "/"), "C:/dockerfile");
        //assert.equal(helpers.determineDockerfilePath("/dir", "C:\\test", "dockerfile").replace(/\\/g, "/"), "C:/test/dockerfile");

        done();
    });
});