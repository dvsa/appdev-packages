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
# @dvsa/appdev-api-common

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

# @dvsa/aws-utilities

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
# Rekognition

## Overview
`Rekognition` is a utility class that provides an easy interface for creating an AWS Rekognition client. It supports authentication and integrates with AWS X-Ray for tracing requests.

## Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-rekognition @aws-sdk/credential-providers aws-xray-sdk
```

## Usage

### Importing the `Rekognition` Class
```ts
import { Rekognition } from '@dvsa/aws-utilities';
```

### Creating a Rekognition Client
By default, the client is created with the `eu-west-1` region. You can override this by passing a custom configuration.

```ts
const rekognitionClient = Rekognition.getClient({ region: "us-east-1" });
```

#### Using Credentials from AWS Profiles
If the `USE_CREDENTIALS` environment variable is set to `true`, credentials will be loaded from the AWS credentials file using the `fromIni` provider.

```sh
export USE_CREDENTIALS=true
```

### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

## Environment Variables
The following environment variables affect `Rekognition` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for Rekognition requests        |

## Error Handling
Errors may occur if invalid parameters are passed or if the executing IAM role lacks required permissions.

Example error handling:
```ts
try {
  const client = Rekognition.getClient();
  // Call Rekognition API...
} catch (error) {
  console.error("Error using Rekognition client:", error);
}
```
# S3Storage

## Overview
`S3Storage` is a utility class that provides an easy interface for interacting with AWS S3. It supports retrieving objects from S3 buckets while optionally integrating with AWS X-Ray for request tracing.

## Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-s3 @aws-sdk/credential-providers aws-xray-sdk
```

## Usage

### Importing the `S3Storage` Class
```ts
import { S3Storage } from '@dvsa/aws-utilities';
```

### Creating an S3 Client
By default, the client is created with the `eu-west-1` region. You can override this configuration by passing a custom configuration.

```ts
const s3Client = S3Storage.getClient({ region: "us-east-1" });
```

#### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

### Downloading an Object from S3
To download an object from an S3 bucket, use the `download` method.

```ts
async function downloadFile() {
  try {
    const params = {
      Bucket: "your-bucket-name",
      Key: "your-file-key",
    };
    const response = await S3Storage.download(params);
    console.log("Downloaded file successfully:", response);
  } catch (error) {
    console.error("Error downloading file from S3", error);
  }
}

downloadFile();
```

### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

## Environment Variables
The following environment variables affect `S3Storage` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for S3 requests                 |

## Error Handling
Errors may occur if invalid parameters are passed or if the executing IAM role lacks required permissions.

Example error handling:
```ts
try {
  const params = { Bucket: "your-bucket-name", Key: "your-file-key" };
  const file = await S3Storage.download(params);
} catch (error) {
  console.error("Error downloading file from S3:", error);
}
```
# SecretsManager

## Overview
`SecretsManager` is a utility class that provides an easy interface for retrieving secrets from AWS Secrets Manager. It supports fetching and parsing secrets as JSON or YAML while integrating with AWS X-Ray for request tracing.

## Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-secrets-manager @aws-sdk/credential-providers aws-xray-sdk js-yaml
```

## Usage

### Importing the `SecretsManager` Class
```ts
import { SecretsManager } from '@dvsa/aws-utilities';
```

### Creating a Secrets Manager Client
By default, the client is created with the `eu-west-1` region. You can override this by passing a custom configuration.

```ts
const secretsClient = SecretsManager.getClient({ region: "us-east-1" });
```

#### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

### Retrieving a Secret from AWS Secrets Manager
To fetch a secret as a JSON-parsed object, use the `get` method.

```ts
async function fetchSecret() {
  try {
    const secret = await SecretsManager.get<{ username: string; password: string }>({
      SecretId: "your-secret-name",
    });
    console.log("Fetched secret:", secret);
  } catch (error) {
    console.error("Error retrieving secret", error);
  }
}

fetchSecret();
```

### Retrieving a YAML-Parsed Secret
If the secret is stored in YAML format, pass `{ fromYaml: true }` as an additional parameter.

```ts
async function fetchYamlSecret() {
  try {
    const secret = await SecretsManager.get<{ apiKey: string }>({
      SecretId: "your-secret-name",
    }, undefined, { fromYaml: true });
    console.log("Fetched YAML secret:", secret);
  } catch (error) {
    console.error("Error retrieving YAML secret", error);
  }
}

fetchYamlSecret();
```

### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

## Environment Variables
The following environment variables affect `SecretsManager` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for Secrets Manager requests    |

## Error Handling
Errors may occur if invalid parameters are passed or if the executing IAM role lacks required permissions.

Example error handling:
```ts
try {
  const secret = await SecretsManager.get({ SecretId: "your-secret-name" });
} catch (error) {
  console.error("Error retrieving secret:", error);
}
```
# SimpleEmailService

## Overview
`SimpleEmailService` is a utility class for sending emails using AWS Simple Email Service (SES). It provides an easy interface for sending HTML and text emails while integrating with AWS X-Ray for request tracing.

## Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-ses @aws-sdk/credential-providers aws-xray-sdk
```

## Usage

### Importing the `SimpleEmailService` Class
```ts
import { SimpleEmailService } from '@dvsa/aws-utilities';
```

### Creating an SES Client
By default, the client is created with the `eu-west-1` region. You can override this configuration by passing a custom configuration.

```ts
const sesClient = SimpleEmailService.getClient({ region: "us-east-1" });
```

#### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

### Sending an Email
To send an email, use the `send` method and provide the necessary parameters.

```ts
async function sendEmail() {
  try {
    const response = await SimpleEmailService.send({
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Test Email",
      htmlBody: "<p>This is a test email.</p>",
      textBody: "This is a test email.",
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
    });
    console.log("Email sent successfully:", response);
  } catch (error) {
    console.error("Error sending email", error);
  }
}

sendEmail();
```

### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

## Environment Variables
The following environment variables affect `SimpleEmailService` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for SES requests                |

## Error Handling
Errors may occur if invalid parameters are passed or if the executing IAM role lacks required permissions.

Example error handling:
```ts
try {
  const response = await SimpleEmailService.send({
    from: "sender@example.com",
    to: ["recipient@example.com"],
    subject: "Test Email",
    htmlBody: "This is a test email.",
    textBody: "This is a test email."
  });
} catch (error) {
  console.error("Error sending email:", error);
}
```

# @dvsa/cvs-microservice-common

# EnvironmentVariables

## Overview
`EnvironmentVariables` is a utility class for managing environment variables in a structured way. It ensures that required environment variables are present and provides default values when necessary.

## Installation
No additional dependencies are required. Simply include the class in your project.

## Usage

### Importing the `EnvironmentVariables` Class
```ts
import { EnvironmentVariables } from '@dvsa/cvs-microservice-common';
```

### Retrieving a Required Environment Variable
Use the `get` method to retrieve an environment variable. If the variable is missing, an error is thrown.

```ts
const apiKey = EnvironmentVariables.get("API_KEY");
console.log("API Key:", apiKey);
```

#### Example with Missing Variable
If `API_KEY` is not set in the environment, the following error will be thrown:
```sh
Error: Configuration item API_KEY was not provided with a value
```

### Using a Default Value When a Variable is Absent
If an environment variable may be missing, you can use `defaultIfNotPresent` to provide a fallback value.

```ts
const logLevel = EnvironmentVariables.defaultIfNotPresent(process.env.LOG_LEVEL, "info");
console.log("Log Level:", logLevel);
```

### Ensuring an Environment Variable is Set Before Proceeding
Use `throwIfNotPresent` when checking a variable's existence but wanting an explicit error if it's missing.

```ts
const dbHost = EnvironmentVariables.throwIfNotPresent(process.env.DB_HOST, "DB_HOST");
console.log("Database Host:", dbHost);
```

## Error Handling
- If `get` or `throwIfNotPresent` is used on an unset variable, an error is thrown.
- `defaultIfNotPresent` prevents errors by returning a default value when the variable is missing.

## Example `.env` File
```sh
API_KEY=my-secret-api-key
DB_HOST=database.example.com
LOG_LEVEL=debug
```
# Custom Routing Decorators

## Overview
This module provides custom decorators (`GET`, `POST`, and `PUT`) for `routing-controllers`, allowing API routes to be automatically prefixed with a branch name when the `BRANCH` environment variable is set.

## Installation
Ensure you have `routing-controllers` installed in your project:

```sh
npm install routing-controllers
```

## Usage

### Importing the Custom Route Decorators
```ts
import { GET, POST, PUT } from '@dvsa/cvs-microservice-common/api/routing-decorators';
```

### Defining API Endpoints with Branch-Aware Routing
These decorators extend `routing-controllers`' `@Get`, `@Post`, and `@Put` decorators by applying both the original route and a prefixed route (if `BRANCH` is set).

```ts
import { JsonController } from "routing-controllers";
import { GET, POST, PUT } from "@dvsa/cvs-microservice-common/api/routing-decorators";

@JsonController("/users")
export class UserController {
  @GET("/")
  getUsers() {
    return { message: "List of users" };
  }

  @POST("/")
  createUser() {
    return { message: "User created" };
  }

  @PUT("/:id")
  updateUser() {
    return { message: "User updated" };
  }
}
```

### Effect of `BRANCH` Environment Variable
If `BRANCH=feature-x`, the above routes will be accessible at:

- `GET /users/` → List users
- `GET /feature-x/users/` → List users (branch-prefixed)
- `POST /users/` → Create a user
- `POST /feature-x/users/` → Create a user (branch-prefixed)
- `PUT /users/:id` → Update a user
- `PUT /feature-x/users/:id` → Update a user (branch-prefixed)

### Setting the `BRANCH` Environment Variable
To enable branch-prefixed routes, set the `BRANCH` environment variable:

```sh
export BRANCH=feature-x
```

## Benefits
- **Supports Feature Branching**: Easily test feature-specific API versions.
- **Automatic Routing Prefixing**: No need to manually adjust routes for different environments.
- **Seamless Integration**: Works with `routing-controllers` decorators.

# HttpStatus

## Overview
`HttpStatus` is an enumeration representing common HTTP status codes. It provides a readable and maintainable way to reference standard HTTP response codes in your application.

## Usage

### Importing the `HttpStatus` Enum
```ts
import { HttpStatus } from '@domain/enums/HttpStatus.enum';
```

### Using HTTP Status Codes in API Responses
The `HttpStatus` enum can be used to improve readability and maintainability in HTTP responses.

#### Example Usage in an Express API
```ts
import express from "express";
import { HttpStatus } from "@domain/enums/HttpStatus.enum";

const app = express();

app.get("/status", (req, res) => {
  res.status(HttpStatus.OK).json({ message: "Success" });
});

app.use((req, res) => {
  res.status(HttpStatus.NOT_FOUND).json({ error: "Not Found" });
});

app.listen(3000, () => console.log("Server running on port 3000"));
```

### Common Status Codes
| Status Code | Enum Value                 | Description                        |
|------------|--------------------------|--------------------------------|
| 200        | `HttpStatus.OK`           | Request was successful         |
| 201        | `HttpStatus.CREATED`      | Resource was successfully created |
| 202        | `HttpStatus.ACCEPTED`     | Request has been accepted but not processed yet |
| 204        | `HttpStatus.NO_CONTENT`   | Request was successful but no content returned |
| 400        | `HttpStatus.BAD_REQUEST`  | Client error - invalid request |
| 401        | `HttpStatus.UNAUTHORIZED` | Authentication required         |
| 403        | `HttpStatus.FORBIDDEN`    | Insufficient permissions        |
| 404        | `HttpStatus.NOT_FOUND`    | Resource not found              |
| 500        | `HttpStatus.INTERNAL_SERVER_ERROR` | Server error |
| 502        | `HttpStatus.BAD_GATEWAY`  | Invalid response from upstream server |
| 504        | `HttpStatus.GATEWAY_TIMEOUT` | Upstream server timeout |

## Benefits of Using `HttpStatus`
- **Improved Readability**: Instead of using magic numbers, named constants make code clearer.
- **Better Maintainability**: Centralized status codes make updates easier.
- **Reduced Errors**: Avoid mistyping HTTP status codes.

# @dvsa/database

# MyBatisSession

## Overview
`MyBatisSession` is a utility class that integrates MyBatis mapping with MySQL, allowing for structured and efficient query execution. It supports query execution, result transformation, and silent error handling while providing debugging capabilities.

## Installation
Ensure that the required dependencies are installed:

```sh
npm install mybatis-mapper mysql2 class-transformer
```

## Usage

### Importing the `MyBatisSession` Class
```ts
import { MyBatisSession } from "./utils/mybatis-session";
import { createConnection } from "mysql2/promise";
```

### Initializing a MyBatis Session
To use MyBatis, you need a MySQL connection, a namespace, and mapper files.

```ts
async function initializeSession() {
  const connection = await createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "test_db",
  });

  const session = new MyBatisSession(connection, "UserNamespace", ["./mappers/user.xml"], true);
  return session;
}
```

### Executing a Query
```ts
async function fetchUsers() {
  const session = await initializeSession();
  const users = await session.query("getUsers", {});
  console.log("Users:", users);
  await session.end();
}

fetchUsers();
```

### Selecting a Single Record and Mapping to a Model
```ts
class User {
  id!: number;
  name!: string;
}

async function getUserById(id: number) {
  const session = await initializeSession();
  const user = await session.selectOne("getUserById", { id }, User);
  console.log("User:", user);
  await session.end();
}

getUserById(1);
```

### Selecting Multiple Records and Mapping to a Model
```ts
async function getAllUsers() {
  const session = await initializeSession();
  const users = await session.selectList("getAllUsers", {}, User);
  console.log("Users:", users);
  await session.end();
}

getAllUsers();
```

### Handling Errors Silently
If you want to execute a query and return an empty array on failure, use `selectAndCatchSilently`.

```ts
async function getUsersSafely() {
  const session = await initializeSession();
  const users = await session.selectAndCatchSilently("getAllUsers", {}, User);
  console.log("Users:", users);
  await session.end();
}

getUsersSafely();
```

### Closing the Connection
```ts
async function closeSession() {
  const session = await initializeSession();
  await session.end();
}
```

## Debugging Mode
If `debugMode` is enabled (`true`), queries will be logged before execution.

```sh
*** Query for namespace: UserNamespace & mapperID: getUsers ***
SELECT * FROM users;
***
```

## Error Handling
Errors will be thrown if:
- A query fails due to an invalid SQL statement or missing parameters.
- A MyBatis mapper file is incorrect.
- The MySQL connection is unavailable.

Using `selectAndCatchSilently`, errors will be logged but return an empty array.

```ts
try {
  const result = await session.query("invalidQuery", {});
} catch (error) {
  console.error("Error executing query:", error);
}
```
# @dvsa/openapi-schema-generator

# TypescriptToOpenApiSpec

## Overview
`TypescriptToOpenApiSpec` is a utility class that converts TypeScript interfaces into OpenAPI 3.0 schemas. It supports processing multiple interfaces, extracting definitions, handling nested references, and generating OpenAPI-compliant schemas.

## Installation
Ensure that the required dependencies are installed:

```sh
npm install openapi3-ts typescript
```

## Usage

### Importing the `TypescriptToOpenApiSpec` Class
```ts
import { TypescriptToOpenApiSpec } from "./utils/typescript-to-openapi";
```

### Generating OpenAPI Schemas from TypeScript Interfaces

#### Converting Specific Interfaces from Multiple Files
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

#### Converting All Interfaces from Multiple Files
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

### Handling Nested and Referenced Models
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

### Output Example
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

### Handling Enums
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

### Debugging and Logging
If you need to debug schema generation, add logging when processing definitions:
```ts
console.log("Generated OpenAPI schema:", JSON.stringify(schemas, null, 2));
```

## Error Handling
- If a referenced model is not found, an error is thrown.
- If an invalid TypeScript file is provided, an error is logged.
- If an interface is not found in the specified file, an error is thrown.




