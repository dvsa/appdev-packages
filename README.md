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

### Package Usage

# JWTAuthChecker

## Overview
`JWTAuthChecker` is a utility class for verifying JSON Web Tokens (JWT) and enforcing role-based access control (RBAC) in an Express application using `routing-controllers`.

It performs authentication by extracting the JWT from the request headers, verifying its validity, and checking whether the user has the required roles to access a resource.

## Installation
Ensure you have `express` and `routing-controllers` installed in your project.

## Usage

### Example Usage in a Controller
The `JWTAuthChecker.execute` method can be used inside a `@Authorized` decorator to enforce authentication and role-based access.

#### Basic Authentication Check
If no roles are required, the function will simply verify the JWT token.

```ts
import { Authorized, Get, JsonController } from "routing-controllers";

@JsonController("/example")
export class ExampleController {
  @Authorized()
  @Get("/secure-endpoint")
  secureEndpoint() {
    return { message: "Access granted" };
  }
}
```

#### Role-Based Access Control
If specific roles are required, they can be passed as an argument.

```ts
@JsonController("/admin")
export class AdminController {
  @Authorized(["admin"])
  @Get("/dashboard")
  getAdminDashboard() {
    return { message: "Admin access granted" };
  }
}
```

### Manually Checking JWT Authentication
The `execute` method can also be called manually within custom middleware or service logic.

```ts
import { Action } from "routing-controllers";

async function checkUserAuthorization(action: Action) {
  try {
    const isAuthorized = await JWTAuthChecker.execute(action, ["editor"]);
    if (isAuthorized) {
      console.log("User is authorized");
    }
  } catch (error) {
    console.error("Authorization failed", error);
  }
}
```

## Environment Variables
The behavior of the authentication check can be controlled using environment variables:

- `IS_OFFLINE`: If set to `true`, the authentication check is bypassed (useful for local development).
- `FORCE_LOCAL_AUTH`: If set to `true`, authentication is enforced even in offline mode.

Example `.env` file:
```sh
IS_OFFLINE=true
FORCE_LOCAL_AUTH=false
```

## Error Handling
`JWTAuthChecker` throws an `AuthError` in case of authentication or authorization failures. The errors are structured with an HTTP status code and message.

Possible errors:
- **Missing Authorization header**: No token found in the request.
- **No roles found in token**: The JWT does not contain any roles.
- **Insufficient permissions**: The user does not have the required role(s).

Example error response:
```json
{
  "status": 401,
  "message": "Insufficient permissions",
  "code": "UNAUTHORIZED"
}
```

# ClientCredentials

## Overview
`ClientCredentials` is a utility class for handling OAuth2 client credentials authentication. It fetches and manages an access token from an authorization server, caching it for reuse until it expires.

This implementation helps applications authenticate machine-to-machine (M2M) interactions by using client credentials to obtain a bearer token.

## Usage

### Importing the `ClientCredentials` Class
```ts
import { ClientCredentials } from '@dvsa/appdev-api-common'
```

### Initializing the ClientCredentials Instance
```ts
const clientCredentials = new ClientCredentials(
  "https://auth.example.com/token", // Token URL
  "your-client-id", // Client ID
  "your-client-secret", // Client Secret
  "your-scope", // OAuth2 Scope
  true // Debug mode (optional)
);
```

### Retrieving an Access Token
To obtain an access token, call the `getAccessToken` method. This method caches the token and only fetches a new one if the current token is expired or unavailable.

```ts
async function authenticate() {
  try {
    const accessToken = await clientCredentials.getAccessToken();
    console.log("Access Token:", accessToken);
  } catch (error) {
    console.error("Failed to retrieve access token", error);
  }
}

authenticate();
```

### Debugging Mode
If `debugMode` is enabled (set to `true` during instantiation), the class will log debug messages indicating whether it is fetching a new token or using a cached one.

Example logs:
```sh
[DEBUG] New access token fetched: eyJhbGciOi...
[DEBUG] Using existing access token: eyJhbGciOi...
```

## Error Handling
`ClientCredentials` throws an error if token retrieval fails. Ensure your application catches these errors to prevent failures in authentication-dependent workflows.

Possible errors:
- **Failed to fetch client credentials**: Occurs when the token endpoint returns a non-OK response.
- **Error decoding access token**: Happens when the received JWT is invalid or cannot be parsed.

Example error handling:
```ts
try {
  const token = await clientCredentials.getAccessToken();
} catch (error) {
  console.error("Authentication error:", error);
}
```




