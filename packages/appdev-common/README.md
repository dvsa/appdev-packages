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
