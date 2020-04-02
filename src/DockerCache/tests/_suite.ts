import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

import ma = require('azure-pipelines-task-lib/mock-answer');
import tmrm = require('azure-pipelines-task-lib/mock-run');

describe('Sample task tests', function () {

    before( function() {

    });

    after(() => {

    });

    it('should succeed with simple inputs', function(done: MochaDone) {
        let taskPath = path.join(__dirname, '..', 'index.js');
        let tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);
        
        done();
    });

    it('it should fail if tool returns 1', function(done: MochaDone) {
        // Add failure test here
        done();
    });    
});