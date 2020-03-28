import os
from os import environ

version = '1.0.0'

if environ.get('TRAVIS') is not None:
    version = f"1.0.{os.environ['TRAVIS_BUILD_NUMBER']}"
if environ.get('APPVEYOR') is not None:
    version = f"1.0.{os.environ['APPVEYOR_BUILD_NUMBER']}"

print(f"Updating version to {version}")

vssExtensionsFilePath = "src/vss-extension.json"

vssExtensionsFile = open(vssExtensionsFilePath, "r")
json_object = json.load(vssExtensionsFile)
vssExtensionsFile.close()
print(json_object)

json_object["version"] = version

vssExtensionsFile = open(vssExtensionsFilePath, "w")
json.dump(json_object, vssExtensionsFile)
vssExtensionsFile.close()