import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');

import * as helpers from "../helpers";

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
        let foundPath = helpers.findDockerOutputFilePath('src/build_123.txt\nsrc/push_123.txt', 'build');
        
        console.log(`Found path: ${foundPath}`);

        assert.equal(foundPath, 'src/build_123.txt');
        
        done();
    });    
});