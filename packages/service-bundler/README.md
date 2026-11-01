# service-bundler

Centralised script for bundling and zipping service artifacts for deployment.

JavaScript is emitted as a single entry bundle per function and API proxy. This
keeps Lambda artifacts self-contained and avoids runtime JavaScript chunk loading.
Native `.node` assets, source maps, and files supplied through `copyFiles` are
still emitted separately when required.

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

If wishing to add new top level directories to the output, then they must be included in the `files` array inside `package.json` as well as included in the `clean:temp` command.
