# AppDev Packages

A mono-repository for AppDev packages.

The components can be found in the `packages/*` directory.

## Adding new packages

When adding a new package, the best approach is to create a new directory under `packages/*` & run `npm init -y`

This will create a basic `package.json` file which can be updated with the relevant information.

### VSCode

If you are using the `vscode-jest` runner extension you will need to add your new package to the settings file in `.vscode/settings.json`. This enables the extension to navigate symlink directories and correctly run package tests.

## Deploying new packages

There is a [publish.yaml](./.github/workflows/publish.yaml) GitHub action integrated into the repo, that can be used to publish new packages to the NPM registry.

You need to add a new step into the `Orchestrator` to listen out for changed files in the desired package.

You can then replicate the pattern of publishing like so

```bash
  publish-[PKG]:
    needs: orchestrator
    runs-on: ubuntu-latest
    if: ${{ needs.orchestrator.outputs.publish-[PKG] || github.event_name == 'workflow_dispatch' && inputs.package == [PKG]}}
    steps:
      - name: Publish Package
        uses: ./.github/actions/publish-package
        with:
          package-path: 'packages/[PKG]'
        env:
          NPM_AUTH_TOKEN: ${{ secrets.NPM_AUTH_TOKEN }}
```

# Monorepo packages
- [@dvsa/appdev-api-common](packages/appdev-common/README.md#contents)
- [@dvsa/aws-utilities](packages/aws-utils/README.md#contents)
- [@dvsa/cvs-microservice-common](packages/cvs-common/README.md#contents)
- [@dvsa/db-operations](packages/database/README.md#contents)
- [@dvsa/openapi-schema-generator](packages/openapi-schema-generator/README.md#contents)
