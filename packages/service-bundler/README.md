# service-bundler

Centralised script for bundling and zipping service artifacts for deployment.

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

### Inversify HTTP and Hono

`ServicePackager` supports both the Inversify HTTP/Hono stack and legacy Express services.
With optimistic bundling enabled (the default), OpenAPI decorators are replaced by the
package's no-op module. This includes `@inversifyjs/http-open-api` as well as the legacy
OpenAPI packages. Documentation generation must load the real decorators separately.
Set `optimisticBundling: false` if your application serves OpenAPI documentation at runtime.

Standalone function bundles exclude Hono, `@hono/aws-lambda`, Inversify HTTP and the
legacy proxy dependencies. Builds fail if generated JavaScript still references Hono,
Inversify HTTP or routing-controllers. Keep shared services and providers independent
of HTTP frameworks so standalone handlers can reuse them.

The bundler warns once per dependency per process when compiled modules use Express,
routing-controllers, TypeDI or routing-controllers-openapi. Existing builds remain
supported. Plan migration to Inversify HTTP controllers, Hono and Zod; use
[`migrate-to-inversify`](https://github.com/dvsa/dvsa-serverless-starter/tree/main/.agents/skills/migrate-to-inversify)
for the migration workflow. The warnings describe actual module requests, including
OpenAPI imports replaced by no-op aliases.
