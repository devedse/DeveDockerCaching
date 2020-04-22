import YAML from 'js-yaml';
import * as path from 'path';

export function execRegex(input: string, regexString: string) : RegExpExecArray[] {
   
    const regex = new RegExp(regexString, 'mg');

    let matches: RegExpExecArray[] = [];

    let m;
    while (m = regex.exec(input)) {
        matches.push(m);
    }

    return matches;
}

export function findDockerOutputFilePath(dockerBuildOutput: string, thingToFind: string): string | undefined {
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

export function findIdsInDockerBuildLog(input: string): string[] {
    //const regex = new RegExp("(--->\\s+(?<ID>.*)[\\r\\n]+^Step [0-9]+\/[0-9]+ : FROM|Successfully built (?<IDLast>.*)$)", 'mg');
    //const regex = new RegExp("(?:--->\\s+(.*)[\\r\\n]+^Step [0-9]+\/[0-9]+ : FROM|Successfully built (.*)$)", 'mg');
    const regex = "(?:--->\\s+(.*)[\\r\\n]+^Step [0-9]+\/[0-9]+ : FROM|Successfully built (.*)$)";

    console.log(`Looking for regex: '${regex}'`);
    const regexMatches = execRegex(input, regex);    
    console.log(`Matches found: ${regexMatches.length}`);
    
    let matches: string[] = [];

    for (let i = 0; i < regexMatches.length; i++) {
        let match = regexMatches[i];
        matches.push(match[1] ?? match[2]);
    }

    console.log(`Id's to push: ${matches}`);

    return matches;
}

export function stringNullOrEmpty(input: string | undefined | null): boolean {
    if (input == null || input == undefined || input.length == 0) {
        return true;
    }
    return false;
}

export function convertToCachedImageName(imageName: string, cacheImagePostfix: string): string {
    let lastIndex = imageName.lastIndexOf(":");
    if (lastIndex != -1) {
        imageName = imageName.substring(0, lastIndex);
    }

    imageName += cacheImagePostfix;
    return imageName;
}

export function determineFullyQualifiedDockerNamesForTags(matches: string[], imageName: string, cacheImagePostfix: string): ImageToTag[] {
    let fullCacheImageName = convertToCachedImageName(imageName, cacheImagePostfix);

    let imageNames: ImageToTag[] = [];

    for (let i = 0; i < matches.length; i++) {
        let match = matches[i];
        let tagImageName = `${fullCacheImageName}:${i}`;

        imageNames.push({stageId: match, cacheImageName: tagImageName});
    }

    return imageNames;
}

interface ImageToTag {
    stageId: string;
    cacheImageName: string;
}

export function countStagesInDockerFile(dockerFileContent: string): number {
    const regex = new RegExp("^FROM\\s", 'mg');

    let count: number = 0;

    let m;
    while (m = regex.exec(dockerFileContent)) {
        //matches.push(m.groups!.ID ?? m.groups!.IDLast)
        count += 1;
    }

    return count;
}

export function readVersionFromDockerComposeFile(dockerComposeFileContent: string): string {
    let parsed = YAML.load(dockerComposeFileContent);
    return parsed.version;
}

export function findImageNamesInDockerComposeFile(dockerComposeFileContent: string): ServiceAndImage[] {
    let parsed = YAML.load(dockerComposeFileContent);
    let keys = Object.keys(parsed.services);
    let entries = <any[]>Object.values(parsed.services);

    let imageNames: ServiceAndImage[] = [];


    console.log("Images found in docker-compose file:");
    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];

        if (entry.build) {
            let key = keys[i];

            let context = "";
            if (entry.build.context) {
                context = entry.build.context;
            }

            console.log(`ServiceName: ${key} ImageName: ${entry.image} DockerFile: ${entry.build.dockerfile}`);
            imageNames.push({ serviceName: key, imageName: entry.image, dockerFile: entry.build.dockerfile, context: context, buildLogForThisImage: "", indexInLog: undefined });
        }
    }

    console.log();
    return imageNames;
}

interface ServiceAndImage {
    serviceName: string;
    imageName: string;
    dockerFile: string;
    context: string;
    buildLogForThisImage: string;
    indexInLog: number | undefined;
}

function findNextHighestIndex(dockerComposeImages: ServiceAndImage[], index: number): number {
    let curLowest: number = Number.MAX_SAFE_INTEGER;

    for (let i = 0; i < dockerComposeImages.length; i++) {
        let curItem = dockerComposeImages[i];

        if (curItem.indexInLog != undefined && curItem.indexInLog > index && curItem.indexInLog < curLowest) {
            curLowest = curItem.indexInLog;
        }
    }

    return curLowest;
}

export function splitDockerComposeBuildLog(dockerComposeImages: ServiceAndImage[], dockerComposeBuildLog: string): ServiceAndImage[] {
    console.log("Splitting dockercompose build log...");

    for (let i = 0; i < dockerComposeImages.length; i++) {
        let item = dockerComposeImages[i];

        let escapedServiceName = escapeRegExp(item.serviceName);
        let textToSearchFor = `^Building ${escapedServiceName}[\\r\\n]+^Step [0-9]+\\/[0-9]+ : FROM`;

        console.log(`Looking for regex: '${textToSearchFor}'`);
        const regexMatches = execRegex(dockerComposeBuildLog, textToSearchFor);
        console.log(`Matches found: ${regexMatches.length}`);

        if (regexMatches.length > 1) {
            console.log(`Warning, found more then 1 match for regex: ${textToSearchFor} ${regexMatches}`);
        } else if (regexMatches.length == 0) {
            console.log(`Error, could not find match for regex: ${textToSearchFor} in docker build log.`);
            continue;
        }

        let match = regexMatches[0];
        item.indexInLog = match.index;
    }
    console.log();

    console.log("Found build logs:");
    for (let i = 0; i < dockerComposeImages.length; i++) {
        let item = dockerComposeImages[i];

        if (item.indexInLog != undefined) {
            let nextHighest = findNextHighestIndex(dockerComposeImages, item.indexInLog);
            if (nextHighest == -1) {
                nextHighest = dockerComposeBuildLog.length;
            }
            let str = dockerComposeBuildLog.substr(item.indexInLog, nextHighest - item.indexInLog);
            
            item.buildLogForThisImage = str.trim();
        }
        else {
            console.log(`Could not find index for item: ${item.serviceName}`);
        }

        console.log(`${i}: ServiceName: ${item.serviceName} Index in log: ${item.indexInLog} Length in log: ${item.buildLogForThisImage?.length}`);
    }
    console.log();

    return dockerComposeImages;
}

export function escapeRegExp(input: string) : string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function getDirectoryName(path: string) : string {
    return path.substring(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
}

export function determineDockerfilePath(basepath: string, context: string, dockerfile: string): string {
    if (path.isAbsolute(context)) {
        return path.join(context, dockerfile);
    } else {
        return path.join(basepath, context, dockerfile);
    }
}