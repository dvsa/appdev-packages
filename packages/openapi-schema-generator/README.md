# openapi-schema-generator

Package for consuming a filepath which should contain TS interfaces, it will then generate an OpenAPI objects from these interfaces.

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

# Contents

## TypescriptToOpenApiSpec

### Overview
`TypescriptToOpenApiSpec` is a utility class that converts TypeScript interfaces into OpenAPI 3.0 schemas. It supports processing multiple interfaces, extracting definitions, handling nested references, and generating OpenAPI-compliant schemas.

### Usage

#### Importing the `TypescriptToOpenApiSpec` Class
```ts
import { TypescriptToOpenApiSpec } from "./utils/typescript-to-openapi";
```

#### Generating OpenAPI Schemas from TypeScript Interfaces

##### Converting Specific Interfaces from Multiple Files
If you have specific interfaces to convert, use `generateNamedSchemas`.

```ts
async function generateSchemas() {
  const schemas = await TypescriptToOpenApiSpec.generateNamedSchemas([
    { path: "models/User.ts", interfaceName: "User" },
    { path: "models/Product.ts", interfaceName: "Product" },
  ]);
  console.log(JSON.stringify(schemas, null, 2));
}

generateSchemas();
```

##### Converting All Interfaces from Multiple Files
To generate schemas for all interfaces in a file, use `generateUnnamedSchemas`.

```ts
async function generateAllSchemas() {
  const schemas = await TypescriptToOpenApiSpec.generateUnnamedSchemas([
    { path: "models/User.ts" },
    { path: "models/Product.ts" },
  ]);
  console.log(JSON.stringify(schemas, null, 2));
}

generateAllSchemas();
```

#### Handling Nested and Referenced Models
This class automatically finds and includes referenced models within interfaces.

```ts
interface User {
  id: string;
  profile: Profile;
}

interface Profile {
  age: number;
  city: string;
}
```

When `User` is converted, `Profile` is also included in the OpenAPI schema.

#### Output Example
```json
{
  "User": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "profile": { "$ref": "#/components/schemas/Profile" }
    },
    "required": ["id", "profile"]
  },
  "Profile": {
    "type": "object",
    "properties": {
      "age": { "type": "number" },
      "city": { "type": "string" }
    },
    "required": ["age", "city"]
  }
}
```

#### Handling Enums
Enums in TypeScript are converted into OpenAPI schema `enum` definitions.

```ts
enum Role {
  ADMIN = "admin",
  USER = "user",
}
```

Generates:
```json
{
  "Role": {
    "type": "string",
    "enum": ["admin", "user"]
  }
}
```

#### Debugging and Logging
If you need to debug schema generation, add logging when processing definitions:
```ts
console.log("Generated OpenAPI schema:", JSON.stringify(schemas, null, 2));
```

### Error Handling
- If a referenced model is not found, an error is thrown.
- If an invalid TypeScript file is provided, an error is logged.
- If an interface is not found in the specified file, an error is thrown.

### Type lookup performance

Named schema batches use an index of project declarations built once per generator.
Dependency declarations are indexed only if a requested name is absent from the project.
Project declarations retain precedence over dependency declarations, and wildcard
selection is unchanged. Indexes are discarded with the generator so subsequent runs
read source changes.

Run the repeatable comparison against the dependency's standard generator:

```sh
npm run benchmark:type-lookup --workspace=@dvsa/openapi-schema-generator
```

The benchmark generates 2,000 interfaces across 20 files, requests 1, 100 and 500
names, and compares five fresh processes per variant with alternating execution
order. Type checking remains enabled. It verifies identical schema hashes and
reports median generator construction, schema creation and combined times;
process startup and harness loading are excluded.

Example local results (Node 24.11.1, ts-json-schema-generator 2.9.0, its TypeScript
5.9.3 compiler):

| Requested names | Standard generator | Indexed generator |
| --- | ---: | ---: |
| 1 | 257ms | 255ms |
| 100 | 793ms | 267ms |
| 500 | 2,950ms | 303ms |

These are combined construction and schema creation times on synthetic inputs,
not full consuming-service OpenAPI generation times. The adapter extends the
dependency's protected named lookup method, so dependency upgrades should run
the compatibility tests and benchmark.
