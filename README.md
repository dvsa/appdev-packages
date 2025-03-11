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

# Package Usage

## @dvsa/appdev-api-common

## JWTAuthChecker

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

# DateTime

## Overview
`DateTime` is a utility class built on `dayjs` to provide a structured and flexible way to handle date and time operations. It supports parsing, formatting, arithmetic operations, and comparisons.

## Installation
Ensure `dayjs` is installed in your project:

```sh
npm install dayjs
```

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
# CloudWatchClient

## Overview
`CloudWatchClient` is a utility class that provides an easy interface for interacting with AWS CloudWatch Logs. It supports executing log queries while optionally integrating with AWS X-Ray for request tracing.

## Installation
Ensure that you have the required AWS SDK dependencies installed:

```sh
npm install @aws-sdk/client-cloudwatch-logs @aws-sdk/credential-providers aws-xray-sdk
```

## Usage

### Importing the `CloudWatchClient` Class
```ts
import { CloudWatchClient } from '@dvsa/aws-utilities';
```

### Creating a CloudWatch Logs Client
By default, the client is created with the `eu-west-1` region. You can override this configuration by passing a custom configuration.

```ts
const cloudWatchClient = CloudWatchClient.getClient({ region: "us-east-1" });
```

#### Using Credentials from AWS Profiles
If the `USE_CREDENTIALS` environment variable is set to `true`, credentials will be loaded from the AWS credentials file using the `fromIni` provider.

```sh
export USE_CREDENTIALS=true
```

### Executing a Log Query
To run a log query against CloudWatch Logs, use the `startQuery` method.

```ts
async function fetchLogs() {
  const params = {
    logGroupName: "your-log-group",
    queryString: "fields @timestamp, @message | sort @timestamp desc",
    startTime: Math.floor(Date.now() / 1000) - 3600, // Last hour
    endTime: Math.floor(Date.now() / 1000),
  };

  try {
    const response = await CloudWatchClient.startQuery(params);
    console.log("Query started successfully:", response.queryId);
  } catch (error) {
    console.error("Failed to start CloudWatch query", error);
  }
}

fetchLogs();
```

### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

## Environment Variables
The following environment variables influence the behavior of `CloudWatchClient`:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for CloudWatch queries          |

## Error Handling
If CloudWatch Logs queries fail due to incorrect parameters or missing permissions, errors will be thrown. Ensure that the IAM role or user executing the queries has the necessary permissions.

Example error handling:
```ts
try {
  const result = await CloudWatchClient.startQuery(params);
} catch (error) {
  console.error("Error querying CloudWatch Logs:", error);
}
```
# DynamoDb

## Overview
`DynamoDb` is a utility class that provides convenient methods for interacting with AWS DynamoDB. It supports querying, scanning, and recursive fetching while also handling authentication and AWS X-Ray tracing.

## Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/credential-providers aws-xray-sdk
```

## Usage

### Importing the `DynamoDb` Class
```ts
import { DynamoDb } from '@dvsa/aws-utilities';
```

### Creating a DynamoDB Client
By default, the client is created with the `eu-west-1` region. You can override this by passing a custom configuration.

```ts
const dynamoClient = DynamoDb.getClient({ region: "us-east-1" });
```

#### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

For local development with `serverless-offline`, set `IS_OFFLINE=true` and provide a local endpoint:

```sh
export IS_OFFLINE=true
export DDB_OFFLINE_ENDPOINT=http://localhost:8000
```

### Scanning a DynamoDB Table
To perform a full scan of a DynamoDB table, use the `fullScan` method.

```ts
async function scanTable() {
  try {
    const items = await DynamoDb.fullScan({ TableName: "your-table-name" });
    console.log("Scanned items:", items);
  } catch (error) {
    console.error("Error scanning DynamoDB table", error);
  }
}

scanTable();
```

### Recursive Fetching of DynamoDB Data
The `recursiveFetch` method is useful for paginated queries or scans.

```ts
async function fetchAllItems() {
  try {
    const items = await DynamoDb.recursiveFetch(QueryCommand, {
      TableName: "your-table-name",
      KeyConditionExpression: "#pk = :pkValue",
      ExpressionAttributeNames: { "#pk": "partitionKey" },
      ExpressionAttributeValues: { ":pkValue": { S: "some-value" } },
    });
    console.log("Fetched items:", items);
  } catch (error) {
    console.error("Error querying DynamoDB table", error);
  }
}

fetchAllItems();
```

### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

## Environment Variables
The following environment variables affect `DynamoDb` behavior:

| Variable             | Description                                              |
|----------------------|----------------------------------------------------------|
| `USE_CREDENTIALS`   | Enables AWS credentials loading from `~/.aws/credentials` |
| `IS_OFFLINE`        | Uses credentials from `.env`/`serverless.yml` for local dev |
| `DDB_OFFLINE_ENDPOINT` | Sets the endpoint for local DynamoDB when `IS_OFFLINE=true` |
| `_X_AMZN_TRACE_ID`  | Enables AWS X-Ray tracing for DynamoDB operations       |

## Error Handling
Errors may occur if invalid parameters are passed or if the executing IAM role lacks required permissions.

Example error handling:
```ts
try {
  const result = await DynamoDb.fullScan({ TableName: "your-table-name" });
} catch (error) {
  console.error("Error scanning DynamoDB table:", error);
}
```






