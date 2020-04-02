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

export function stringNullOrEmpty(input: string | undefined | null): boolean {
    if (input == null || input == undefined || input.length == 0) {
        return true;
    }
    return false;
}