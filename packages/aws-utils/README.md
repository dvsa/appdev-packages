# aws-utils

Helper library for simplifying and standardising usage of AWS clients

### Pre-requisites

- Node.js (Please see `.nvmrc` in the root of the repo for a specific version)
- `npm` (If using [n](https://github.com/tj/n) or [nvm](https://github.com/nvm-sh/nvm), this will be automatically managed)
- Security
  - [Git secrets](https://github.com/awslabs/git-secrets)
  - [ScanRepo](https://github.com/UKHomeOffice/repo-security-scanner)
    - Unzip `repo-security-scanner_<version>_Darwin_<architercture>.tar.gz` and rename the executable inside the folder
      to `scanrepo` - Add executable to path (using `echo $PATH` to find your path)
---

### Getting started

###### Run the following command after cloning the project

1. `npm install` (or `npm i`)

---
### Publishing

###### The code that will be published lives inside the ./src directory.

In order to see the output of what will be published, run the following command:

```shell
npm publish --dry-run
```

There are two ways in which this package can/should be published:

SHOULD:
###### Requires manual version bump via the PR

- Upon merge into `main` branch, the package will be published via a GHA workflow.

CAN:
###### Requires manual version bump via the PR

- If you are an authenticated member of the DVSA `npm` account, you can manually publish changes, although this is discouraged.
---

# Contents

## CloudWatchClient

### Overview
`CloudWatchClient` is a utility class that provides an easy interface for interacting with AWS CloudWatch Logs. It supports executing log queries while optionally integrating with AWS X-Ray for request tracing.

### Installation
Ensure that you have the required AWS SDK dependencies installed:

```sh
npm install @aws-sdk/client-cloudwatch-logs @aws-sdk/credential-providers aws-xray-sdk
```

### Usage

#### Importing the `CloudWatchClient` Class
```ts
import { CloudWatchClient } from '@dvsa/aws-utilities';
```

#### Creating a CloudWatch Logs Client
By default, the client is created with the `eu-west-1` region. You can override this configuration by passing a custom configuration.

```ts
const cloudWatchClient = CloudWatchClient.getClient({ region: "us-east-1" });
```

##### Using Credentials from AWS Profiles
If the `USE_CREDENTIALS` environment variable is set to `true`, credentials will be loaded from the AWS credentials file using the `fromIni` provider.

```sh
export USE_CREDENTIALS=true
```

#### Executing a Log Query
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

#### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

### Environment Variables
The following environment variables influence the behavior of `CloudWatchClient`:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for CloudWatch queries          |

### Error Handling
If CloudWatch Logs queries fail due to incorrect parameters or missing permissions, errors will be thrown. Ensure that the IAM role or user executing the queries has the necessary permissions.

Example error handling:
```ts
try {
  const result = await CloudWatchClient.startQuery(params);
} catch (error) {
  console.error("Error querying CloudWatch Logs:", error);
}
```
## DynamoDb

### Overview
`DynamoDb` is a utility class that provides convenient methods for interacting with AWS DynamoDB. It supports querying, scanning, and recursive fetching while also handling authentication and AWS X-Ray tracing.

### Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/credential-providers aws-xray-sdk
```

### Usage

#### Importing the `DynamoDb` Class
```ts
import { DynamoDb } from '@dvsa/aws-utilities';
```

#### Creating a DynamoDB Client
By default, the client is created with the `eu-west-1` region. You can override this by passing a custom configuration.

```ts
const dynamoClient = DynamoDb.getClient({ region: "us-east-1" });
```

##### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

For local development with `serverless-offline`, set `IS_OFFLINE=true` and provide a local endpoint:

```sh
export IS_OFFLINE=true
export DDB_OFFLINE_ENDPOINT=http://localhost:8000
```

#### Scanning a DynamoDB Table
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

#### Recursive Fetching of DynamoDB Data
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

#### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

### Environment Variables
The following environment variables affect `DynamoDb` behavior:

| Variable             | Description                                              |
|----------------------|----------------------------------------------------------|
| `USE_CREDENTIALS`   | Enables AWS credentials loading from `~/.aws/credentials` |
| `IS_OFFLINE`        | Uses credentials from `.env`/`serverless.yml` for local dev |
| `DDB_OFFLINE_ENDPOINT` | Sets the endpoint for local DynamoDB when `IS_OFFLINE=true` |
| `_X_AMZN_TRACE_ID`  | Enables AWS X-Ray tracing for DynamoDB operations       |

### Error Handling
Errors may occur if invalid parameters are passed or if the executing IAM role lacks required permissions.

Example error handling:
```ts
try {
  const result = await DynamoDb.fullScan({ TableName: "your-table-name" });
} catch (error) {
  console.error("Error scanning DynamoDB table:", error);
}
```
## Rekognition

### Overview
`Rekognition` is a utility class that provides an easy interface for creating an AWS Rekognition client. It supports authentication and integrates with AWS X-Ray for tracing requests.

### Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-rekognition @aws-sdk/credential-providers aws-xray-sdk
```

### Usage

#### Importing the `Rekognition` Class
```ts
import { Rekognition } from '@dvsa/aws-utilities';
```

#### Creating a Rekognition Client
By default, the client is created with the `eu-west-1` region. You can override this by passing a custom configuration.

```ts
const rekognitionClient = Rekognition.getClient({ region: "us-east-1" });
```

##### Using Credentials from AWS Profiles
If the `USE_CREDENTIALS` environment variable is set to `true`, credentials will be loaded from the AWS credentials file using the `fromIni` provider.

```sh
export USE_CREDENTIALS=true
```

#### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

### Environment Variables
The following environment variables affect `Rekognition` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for Rekognition requests        |

### Error Handling
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
## S3Storage

### Overview
`S3Storage` is a utility class that provides an easy interface for interacting with AWS S3. It supports retrieving objects from S3 buckets while optionally integrating with AWS X-Ray for request tracing.

### Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-s3 @aws-sdk/credential-providers aws-xray-sdk
```

### Usage

#### Importing the `S3Storage` Class
```ts
import { S3Storage } from '@dvsa/aws-utilities';
```

#### Creating an S3 Client
By default, the client is created with the `eu-west-1` region. You can override this configuration by passing a custom configuration.

```ts
const s3Client = S3Storage.getClient({ region: "us-east-1" });
```

##### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

#### Downloading an Object from S3
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

#### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

### Environment Variables
The following environment variables affect `S3Storage` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for S3 requests                 |

### Error Handling
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
## SecretsManager

### Overview
`SecretsManager` is a utility class that provides an easy interface for retrieving secrets from AWS Secrets Manager. It supports fetching and parsing secrets as JSON or YAML while integrating with AWS X-Ray for request tracing.

### Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-secrets-manager @aws-sdk/credential-providers aws-xray-sdk js-yaml
```

### Usage

#### Importing the `SecretsManager` Class
```ts
import { SecretsManager } from '@dvsa/aws-utilities';
```

#### Creating a Secrets Manager Client
By default, the client is created with the `eu-west-1` region. You can override this by passing a custom configuration.

```ts
const secretsClient = SecretsManager.getClient({ region: "us-east-1" });
```

##### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

#### Retrieving a Secret from AWS Secrets Manager
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

#### Retrieving a YAML-Parsed Secret
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

#### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

### Environment Variables
The following environment variables affect `SecretsManager` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for Secrets Manager requests    |

### Error Handling
Errors may occur if invalid parameters are passed or if the executing IAM role lacks required permissions.

Example error handling:
```ts
try {
  const secret = await SecretsManager.get({ SecretId: "your-secret-name" });
} catch (error) {
  console.error("Error retrieving secret:", error);
}
```
## SimpleEmailService

### Overview
`SimpleEmailService` is a utility class for sending emails using AWS Simple Email Service (SES). It provides an easy interface for sending HTML and text emails while integrating with AWS X-Ray for request tracing.

### Installation
Ensure that the required AWS SDK dependencies are installed:

```sh
npm install @aws-sdk/client-ses @aws-sdk/credential-providers aws-xray-sdk
```

### Usage

#### Importing the `SimpleEmailService` Class
```ts
import { SimpleEmailService } from '@dvsa/aws-utilities';
```

#### Creating an SES Client
By default, the client is created with the `eu-west-1` region. You can override this configuration by passing a custom configuration.

```ts
const sesClient = SimpleEmailService.getClient({ region: "us-east-1" });
```

##### Using Credentials from AWS Profiles
If `USE_CREDENTIALS` is set to `true`, credentials will be loaded from the AWS credentials file.

```sh
export USE_CREDENTIALS=true
```

#### Sending an Email
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

#### AWS X-Ray Integration
If AWS X-Ray tracing is enabled (`_X_AMZN_TRACE_ID` is present in the environment variables), the client is automatically captured by AWS X-Ray for tracing requests.

```sh
export _X_AMZN_TRACE_ID=true
```

### Environment Variables
The following environment variables affect `SimpleEmailService` behavior:

| Variable           | Description                                               |
|--------------------|-----------------------------------------------------------|
| `USE_CREDENTIALS` | Enables AWS credentials loading from `~/.aws/credentials` |
| `_X_AMZN_TRACE_ID`| Enables AWS X-Ray tracing for SES requests                |

### Error Handling
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
