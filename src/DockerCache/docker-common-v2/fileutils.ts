"use strict";

import * as del from "del";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as tl from "azure-pipelines-task-lib/task";

// http://www.daveeddy.com/2013/03/26/synchronous-file-io-in-nodejs/
// We needed a true Sync file write for config file
export function writeFileSync(filePath: string, data: string): number {
    try
    {
        const fd = fs.openSync(filePath, 'w');
        var bitesWritten = fs.writeSync(fd, data);
        fs.fsyncSync(fd);
        tl.debug(`Synced the file content to the disk. The content is ${data}`);
        fs.closeSync(fd);
        return bitesWritten;
    } catch(e)
    {
        tl.error(`Can not write data to the file ${filePath}. Error: ${e}`);
        throw e;
    }
}

export function findDockerFile(dockerfilepath: string) : string {
    if (dockerfilepath.indexOf('*') >= 0 || dockerfilepath.indexOf('?') >= 0) {
        tl.debug("Pattern found in docker compose filepath parameter");
        let workingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
        let allFiles = tl.find(workingDirectory!);
        let matchingResultsFiles = tl.match(allFiles, dockerfilepath, workingDirectory, { matchBase: true });

        if (!matchingResultsFiles || matchingResultsFiles.length == 0) {
            throw new Error(`No Docker file matching '${dockerfilepath}' was found.`);
        }

        return matchingResultsFiles[0];
    }
    else
    {
        tl.debug("No pattern found in docker compose filepath parameter");
        return dockerfilepath;
    }
}