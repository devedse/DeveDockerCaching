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
    const regex = new RegExp("(?:--->\\s+(.*)[\\r\\n]+^Step [0-9]+\/[0-9]+ : FROM|Successfully built (.*)$)", 'mg');

    let matches: string[] = [];

    let m;
    while (m = regex.exec(input)) {
        //matches.push(m.groups!.ID ?? m.groups!.IDLast)
        matches.push(m[1] ?? m[2]);
    }

    console.log(matches);

    return matches;
}

export function stringNullOrEmpty(input: string | undefined | null): boolean {
    if (input == null || input == undefined || input.length == 0) {
        return true;
    }
    return false;
}

export function determineFullyQualifiedDockerNamesForTags(matches: string[], imageName: string, repositoryName: string, cacheImagePostfix: string): ImageToTag[] {
    let fullCacheImageName = imageName.replace(repositoryName, `${repositoryName}${cacheImagePostfix}`);

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