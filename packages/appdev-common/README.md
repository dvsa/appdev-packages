# app-dev-common

Common code used by the various serverless microservices withing AppDev systems, published as a NPM package.

## Developing
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

# Contents

## JWTAuthChecker

### Overview
`JWTAuthChecker` is a utility class for verifying JSON Web Tokens (JWT) and enforcing role-based access control (RBAC) in an Express application using `routing-controllers`.

It performs authentication by extracting the JWT from the request headers, verifying its validity, and checking whether the user has the required roles to access a resource.

## Usage

### Example Usage in a Controller
The `JWTAuthChecker.execute` method can be used in conjunction with the `@Authorized` decorator to enforce authentication and role-based access.

#### Basic Authentication Check
In the entry point to your service/application e.g. `src/index.ts`, bind the `JWTAuthChecker.execute` method to the `authorizationChecker` option in the `createExpressServer` function.
```ts
// ...other imports
import { JWTAuthChecker } from '@dvsa/appdev-api-common';
import { MyResource } from '@resources/MyResource';
import { createExpressServer } from 'routing-controllers';

export const app = createExpressServer({
   cors: true,
   defaultErrorHandler: false,
   controllers: [MyResource],
   authorizationChecker: JWTAuthChecker.execute,
});
```


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

# AwsOIDCAzureTokenClient

## Overview
`AwsOIDCAzureTokenClient` handles federated authentication between AWS and Azure AD. It obtains an AWS OIDC web identity JWT via STS and exchanges it for an Azure AD access token using the client credentials grant with a JWT bearer assertion.

This is useful for workloads running in AWS that need to authenticate against Azure AD-protected APIs without storing Azure client secrets.

## Flow
1. Calls AWS STS `GetWebIdentityToken` to obtain a signed JWT (RS256)
2. Sends the JWT as a `client_assertion` to the Azure AD v2.0 token endpoint (`https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`)
3. Returns the Azure AD `access_token`
4. Caches the token in-memory and reuses it until it expires (with configurable skew tolerance)

## Usage

### Importing the Class
```ts
import { AwsOIDCAzureTokenClient } from '@dvsa/appdev-api-common/auth/aws-oidc-azure-client';
```

### Initializing
```ts
const client = new AwsOIDCAzureTokenClient(
  "your-azure-tenant-id",  // Azure AD tenant ID
  "your-azure-client-id",  // Azure AD application (client) ID
  300,                      // Token duration in seconds (default: 300)
  {
    debugMode: false,       // Log tokens & debug info (default: false)
    forceFreshAuth: false,  // Skip cache, always fetch fresh (default: false)
    expirySkewSeconds: 30,  // Treat token as expired N seconds early (default: 30)
  }
);
```

### Retrieving an Access Token
```ts
const token = await client.getAccessToken();
```

The token is cached statically — subsequent calls return the cached token until it expires (minus the skew window).

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debugMode` | `boolean` | `false` | Log debug messages and tokens. **Use with caution — can leak secrets.** |
| `forceFreshAuth` | `boolean` | `false` | Skip token caching, always fetch a new token. |
| `expirySkewSeconds` | `number` | `30` | Treat token as expired this many seconds before actual expiry to avoid clock skew issues. |

## Error Handling
- **STS did not return a WebIdentityToken**: AWS STS call failed or returned no token.
- **Azure token endpoint error**: Azure AD rejected the token exchange (HTTP status and response body included in error).
- **Error decoding access token**: Cached token could not be decoded — triggers a fresh fetch.

```ts
try {
  const token = await client.getAccessToken();
} catch (error) {
  console.error("Azure federated auth failed:", error);
}
```

## Prerequisites
- The AWS environment must have OIDC federation configured (e.g., an EKS service account or Lambda with web identity role)
- An Azure AD app registration with federated credentials trust configured to accept the AWS OIDC issuer
- `@aws-sdk/client-sts` must be available (included as a dependency)

---

# ClientCredentials

## Overview
`ClientCredentials` is a utility class for handling OAuth2 client credentials authentication. It fetches and manages an access token from an authorization server, caching it for reuse until it expires.

This implementation helps applications authenticate machine-to-machine (M2M) interactions by using client credentials to obtain a bearer token.

## Usage

### Importing the `ClientCredentials` Class
```ts
import { ClientCredentials } from '@dvsa/appdev-api-common';
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

# DateTime

## Overview
`DateTime` is a utility class built on `dayjs` to provide a structured and flexible way to handle date and time operations. It supports parsing, formatting, arithmetic operations, and comparisons.

## Usage

### Importing the `DateTime` Class
```ts
import { DateTime } from '@dvsa/appdev-api-common';
```

### Creating a `DateTime` Instance
You can create an instance of `DateTime` using a `Date`, `string`, or another `DateTime` instance.

```ts
const now = new DateTime(); // Current date and time
const fromString = new DateTime("15/03/2025", "DD/MM/YYYY");
const fromDate = new DateTime(new Date());
```

### Formatting Dates
You can format a `DateTime` instance using the `format` method.

```ts
console.log(now.format("YYYY-MM-DD HH:mm:ss"));
```

### Standard UK Local Date Formats
The class provides helper methods for formatting dates in UK local formats:

```ts
console.log(DateTime.StandardUkLocalDateTimeAdapter(now)); // "DD/MM/YYYY HH:mm:ss"
console.log(DateTime.StandardUkLocalDateAdapter(now)); // "DD/MM/YYYY"
```

### Arithmetic Operations
You can add or subtract time units to/from a `DateTime` instance.

```ts
const futureDate = now.add(5, "days");
const pastDate = now.subtract(2, "weeks");
```

### Date Comparisons
```ts
const date1 = new DateTime("2025-03-10");
const date2 = new DateTime("2025-03-15");

console.log(date1.isBefore(date2)); // true
console.log(date2.isAfter(date1)); // true
console.log(date1.isBetween("2025-03-05", "2025-03-20")); // true
```

### Difference Between Dates
Get the difference in various units:

```ts
const daysDiff = date1.daysDiff(date2); // Number of whole days between dates
const hoursDiff = date1.diff(date2, "hour");
console.log(`Difference: ${daysDiff} days, ${hoursDiff} hours`);
```

### Comparing Durations
```ts
const duration = date1.compareDuration(date2, "minute");
console.log(`Difference in minutes: ${duration}`);
```

### Getting the Current Date
```ts
const today = DateTime.today();
console.log(today);
```

## Error Handling
Ensure that input dates are in a valid format when creating a `DateTime` instance. If an invalid format is provided, `dayjs` will handle parsing failures gracefully but may return an invalid instance.

Example error handling:
```ts
const invalidDate = new DateTime("invalid-date");
console.log(invalidDate.toString()); // Returns an invalid date string
```


# Compression

## Overview
`DataCompression` is a utility class to simplify the compression & decompression using Gzip and Gunzip algorithms.

## Usage

### Importing the `DataCompression` Class
```ts
import { DataCompression } from '@dvsa/appdev-api-common';
```

### Compressing Data
This is the process of taking a plain JSON object and compressing it using Gzip.

```ts
const data = { key: 'value' };
const compressedData = DataCompression.compress(data);
// H4sIAAAAAAAAA6tWyk6tVLJSKkvMKU1VqgUAv5wYPw8AAAA=
```

### Decompressing Data
This is the process of taking a compressed JSON object and decompressing it using Gunzip.

```ts
const data = "H4sIAAAAAAAAA6tWyk6tVLJSKkvMKU1VqgUAv5wYPw8AAAA=";
const decompressedData = DataCompression.decompress(data);
// { key: 'value' }
```
