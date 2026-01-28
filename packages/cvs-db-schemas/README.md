# cvs-db-schema

Collection of DB schemas in Drizzle form to be shared between service domains

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

### Publishing

In order to see the output of what will be published, run the following command:

```shell
npm publish --dry-run
```

There are two ways in which this package can/should be published:

###### Requires manual version bump via the PR

- Upon merge into `main` branch, the package will be published via a GHA workflow.

# Contents

- `src/outbox`: Outbox table schema for event publishing/retries.
- `src/test-facility`: Test facility schemas:
  - `activity` table
  - `test_station` table
- `src/helper/format-schema-name`: Helper to suffix schema names on CB2 branches.
- `src/index.ts`: Public exports for the schemas.
