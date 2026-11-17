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

### Fragmented batch performance

Duplicate names retain individual schema generation and input-order merging.
Consecutive single-entry batches with exactly the same input path share a
TypeScript program, while each entry gets a fresh parser and formatter. This
preserves declaration and child-schema collision behaviour, including when a
barrel imports different declarations with the same name. The program is released
from the reuse cache when the path changes, a multi-entry batch starts, or the
generation call finishes.

```sh
npm run benchmark:batch-fragmentation --workspace=@dvsa/openapi-schema-generator
```

This compares the previous generation loop against compiler reuse, with the same
indexed generator in both variants. It uses 500 interfaces across 5 files, requested
through one barrel, and five fresh processes per scenario/variant with alternating
execution order. Type checking stays enabled; timings cover `generate()` and exclude
process startup and harness loading. All OpenAPI output hashes must match.

Example local medians (Node 24.11.1, ts-json-schema-generator 2.9.0, TypeScript 5.9.3):

| Inputs | Programs before → after | Time before → after |
| --- | ---: | ---: |
| 25 distinct names | 1 → 1 | 260ms → 221ms |
| 25 distinct names, first name repeated at end | 26 → 1 | 2,793ms → 271ms |
| 25 distinct names, two interspersed repeats | 27 → 1 | 2,814ms → 257ms |
| Same name repeated 6 times | 6 → 1 | 753ms → 222ms |

The distinct-name case takes the unchanged batching path; its timing difference is
measurement variation. Gains apply to consecutive fragmented entries sharing a path;
alternating different files still requires separate programs. These synthetic inputs
do not load a consuming service's Lambda handlers.

## Inversify HTTP and Zod

Import the dedicated entry point for Inversify HTTP services:

```typescript
import 'reflect-metadata';
import { InversifyToOpenApiSpec } from '@dvsa/openapi-schema-generator/inversify';
import { iocContainer } from './src/domain/ioc/container';

const spec = await InversifyToOpenApiSpec.generate({
  container: iocContainer,
  openApiObject: {
    openapi: '3.1.0',
    info: { title: 'my-service', version: '1.0.0' },
  },
});
```

Install compatible `@inversifyjs/http-open-api`, `@inversifyjs/open-api-types`,
`inversify` and Zod 4 dependencies in the consuming service. These are optional peers
so legacy consumers do not need the new stack. The new entry point does not load the
legacy TypeScript compiler or routing-controllers generator.

Discovery defaults to the current working directory and these globs:

| Option | Default | Source |
| --- | --- | --- |
| `modelsGlob` | `src/domain/models/**/*.ts` | Exported Zod 4 or Zod Mini schemas |
| `controllersGlob` | `src/proxy/resources/*.ts` | Inversify HTTP controller classes |
| `functionsGlob` | `src/functions/*/index.ts` | Standalone `openApi` exports |

Override `cwd` or any glob for other layouts; set a glob to `false` to disable it.
Use Bun for the starter's TypeScript/decorator/path-alias sources, or another configured
TypeScript loader. Node consumers can instead discover compiled JavaScript files.
The service supplies its configured container, API metadata and output serialization.
Generation returns a spec; it does not delete or write output files.

Schemas drop a trailing `Schema` and capitalise the first letter (`userSchema` becomes
`User`). Duplicate names, including collisions with seed schemas, fail generation.
Standalone modules can export `{ path, pathItem }` as `openApi`; modules without that
export are skipped. Invalid metadata and import failures stop generation. Lambda
methods merge into existing paths, with the Lambda definition taking precedence for
the same method, matching the starter's existing behaviour.

### Migrating legacy consumers

The root `TypescriptToOpenApiSpec`, `LambdaAPI` and `registerLambdaHandler` APIs remain
supported. Each emits a warning once per process when invoked, with upgrade guidance.
Importing the package alone does not warn. For Inversify HTTP services, use the new
entry point, replace class-validator models with Zod schemas, use Inversify OpenAPI
decorators on controllers, and replace Lambda decorators with `openApi` exports.
See the starter's
[`migrate-to-inversify`](https://github.com/dvsa/dvsa-serverless-starter/tree/main/.agents/skills/migrate-to-inversify)
workflow for the full stack migration. TypeScript-interface-only consumers can keep
using `TypescriptToOpenApiSpec` until they choose to migrate their schema source.

Run `npm test` for both the legacy generator tests and the built ESM/CommonJS
entry point integration tests. Use `npm run test:inversify` to run only the latter.
