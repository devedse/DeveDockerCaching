# DeveDockerCaching

This task can be used to cache layers during a docker build. It works for both docker builds and docker compose.

The way it works is as follows:

Let's say we have the following image:
`coolregistry.azurecr.io/coolimage-staging`

**1. Pull Cached Layers (will be skipped the first time)**

During first build upload all layers as cache (e.g. coolregistry.azurecr.io/coolimage-staging:0 and coolregistry.azurecr.io/coolimage-staging:1)

**2. docker (-compose) build**

Execute the docker-compose build using the normal docker (-compose) tasks using the output from the DeveDockerCaching task

**3. Push Cached Layers**

After the build is completed, DeveDockerCaching will determine what layers need to be cached and push these as ....-staging:(0...n) to the container registry

## Setup in docker-compose caching

To be able to configure this you need 3 tasks

1. DeveDockerCaching - dockerComposePullCache
1. DockerCompose - build
1. DeveDockerCaching - dockerComposePushCache

![Image](Images/dockercompose_tasks.png)

### docker-compose classic pipelines

**DeveDockerCaching - dockerComposePullCache**

1. Make sure the variables are configured exactly the same as the docker-compose build task.
1. Make sure the output is stored in a variable which should be provided to the docker-compose build task in the "additional docker compose files".

![Image](Images/devedockercache_dockercomposepullconfig.png)

**DockerCompose - build**

1. Make sure the additional docker-compose tasks includes the output from the DeveDockerCompose pull task.
1. DeveDockerCaching generates a compose file that should be included in the addtional docker-compose files.
1. Set the output variable of the docker-compose build task to something. DeveDockerCaching needs this to determine what docker images where made.

![Image](Images/dockercomposeconfig.png)

**DeveDockerCaching - dockerComposePushCache**

1. Make sure the variables are configured exactly the same as the docker-compose build task.
1. Then configure this variable as the docker build output.

![Image](Images/devedockercache_dockercomposepushconfig.png)