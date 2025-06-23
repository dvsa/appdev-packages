# cvs-feature-flags

Feature flags for the Commercial Vehicle Services (CVS) system, published as a GitHub package.

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


### Naming conventions followed for RDS Migration

When adding a new RDS migration object, the following conventions should be adhered to:
1. The object should be named `<domain>DB` e.g. "testFacilityDB", "defectDB", "testTypeDB"

2. A typical object should follow this structure:
   - `enabled`: A boolean indicating if the feature is enabled.
   - `<function>readDDB`: A boolean indicating if reading from DynamoDB is enabled.
   - `<function>readAurora`: A boolean indicating if reading from Aurora is enabled.
   - `<function>writeDDB`: A boolean indicating if writing to DynamoDB is enabled.
   - `<function>writeAurora`: A boolean indicating if writing to Aurora is enabled.
   
(*Note: If Reads/Writes aren't required, the omit the flag)

Example
```json
testFacilityDB: {
  enabled: true,

  // these flags control the /test-station/{+proxy}
  testStationReadDDB: true,
  testStationReadAurora: false,

  // The only writes that occur in "test stations" are via the put, therefore no need for distinct flags
  testStationWriteDDB: true,
  testStationWriteAurora: false,
        
  // these flags control the /activities/{+proxy}
  activityReadDDB: true,
  activityReadAurora: false,
  activityWriteDDB: true
  activityWriteAurora: false
}

```
