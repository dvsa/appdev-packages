# app-dev-common

Common code used by the various serverless microservices withing AppDev systems, published as a NPM package.

### Pre-requisites

- Node.js (Please see `.nvmrc` for specific version)
- `npm` (If using [n](https://github.com/tj/n) or [nvm](https://github.com/nvm-sh/nvm), this will be automatically managed)
- Security
  - [Git secrets](https://github.com/awslabs/git-secrets)
  - [ScanRepo](https://github.com/UKHomeOffice/repo-security-scanner)
    - Unzip `repo-security-scanner_<version>_Darwin_<architercture>.tar.gz` and rename the executable inside the folder
      to `scanrepo` - Add executable to path (using `echo $PATH` to find your path)

### Getting started

###### Run the following command after cloning the project

1. `npm install` (or `npm i`)

###### The code that will be published lives inside the ./src directory.

In order to simplify the publishing step, each file must be exported from the `index.ts` file.

### Publishing

In order to see the output of what will be published, run the following command:

```shell
npm publish --dry-run
```

There are two ways in which this package can/should be published:

###### Requires manual version bump via the PR

- Upon merge into `main` branch, the package will be published via a GHA workflow.

### Developing locally
To test our your changes before publishing to `npm`, you can use the following command:

`npm run localLink`

Then in the project you wish to use this package, run:

`npm link @dvsa/appdev-api-common`

Once you've completed your local testing and/or to start again from scratch, you can run:
`npm unlink @dvsa/appdev-api-common`
