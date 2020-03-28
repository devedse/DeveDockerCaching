import os
from os import environ
import json
from pathlib import Path

version = '1.0.0'
patchVersion = '0'

if environ.get('TRAVIS') is not None:
    patchVersion = os.environ['TRAVIS_BUILD_NUMBER']
if environ.get('APPVEYOR') is not None:
    patchVersion = os.environ['APPVEYOR_BUILD_NUMBER']

version = f"1.0.{patchVersion}"
vssExtensionsFilePath = "src/vss-extension.json"

print(f"Updating version to {version} in {vssExtensionsFilePath}")

loadedFile = open(vssExtensionsFilePath, "r")
json_object = json.load(loadedFile)
loadedFile.close()

json_object["version"] = version
print(json_object)

loadedFile = open(vssExtensionsFilePath, "w")
json.dump(json_object, loadedFile)
loadedFile.close()

paths = Path('src').glob('**/task.json')

for taskJsonFilePath in paths:

    print(f"Updating Patch Version to {patchVersion} in {taskJsonFilePath}")

    loadedFile = open(taskJsonFilePath, "r")
    json_object = json.load(loadedFile)
    loadedFile.close()

    json_object["version"]["Patch"] = patchVersion
    print(json_object)

    loadedFile = open(taskJsonFilePath, "w")
    json.dump(json_object, loadedFile)
    loadedFile.close()