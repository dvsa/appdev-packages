# cvs-microservice-common

Common code used by the various serverless microservices within the Commercial Vehicle Services (CVS) system, published as a GitHub package.

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

### Publishing

In order to see the output of what will be published, run the following command:

```shell
npm publish --dry-run
```

There are two ways in which this package can/should be published:

###### Requires manual version bump via the PR

- Upon merge into `main` branch, the package will be published via a GHA workflow.

# Contents

## EnvironmentVariables

### Overview
`EnvironmentVariables` is a utility class for managing environment variables in a structured way. It ensures that required environment variables are present and provides default values when necessary.

### Usage

#### Importing the `EnvironmentVariables` Class
```ts
import { EnvironmentVariables } from '@dvsa/cvs-microservice-common';
```

#### Retrieving a Required Environment Variable
Use the `get` method to retrieve an environment variable. If the variable is missing, an error is thrown.

```ts
const apiKey = EnvironmentVariables.get("API_KEY");
console.log("API Key:", apiKey);
```

##### Example with Missing Variable
If `API_KEY` is not set in the environment, the following error will be thrown:
```sh
Error: Configuration item API_KEY was not provided with a value
```

#### Using a Default Value When a Variable is Absent
If an environment variable may be missing, you can use `defaultIfNotPresent` to provide a fallback value.

```ts
const logLevel = EnvironmentVariables.defaultIfNotPresent(process.env.LOG_LEVEL, "info");
console.log("Log Level:", logLevel);
```

#### Ensuring an Environment Variable is Set Before Proceeding
Use `throwIfNotPresent` when checking a variable's existence but wanting an explicit error if it's missing.

```ts
const dbHost = EnvironmentVariables.throwIfNotPresent(process.env.DB_HOST, "DB_HOST");
console.log("Database Host:", dbHost);
```

### Error Handling
- If `get` or `throwIfNotPresent` is used on an unset variable, an error is thrown.
- `defaultIfNotPresent` prevents errors by returning a default value when the variable is missing.

### Example `.env` File
```sh
API_KEY=my-secret-api-key
DB_HOST=database.example.com
LOG_LEVEL=debug
```
## Custom Routing Decorators

### Overview
This module provides custom decorators (`GET`, `POST`, and `PUT`) for `routing-controllers`, allowing API routes to be automatically prefixed with a branch name when the `BRANCH` environment variable is set.

### Installation
Ensure you have `routing-controllers` installed in your project:

```sh
npm install routing-controllers
```

### Usage

#### Importing the Custom Route Decorators
```ts
import { GET, POST, PUT } from '@dvsa/cvs-microservice-common/api/routing-decorators';
```

#### Defining API Endpoints with Branch-Aware Routing
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

#### Effect of `BRANCH` Environment Variable
If `BRANCH=feature-x`, the above routes will be accessible at:

- `GET /users/` → List users
- `GET /feature-x/users/` → List users (branch-prefixed)
- `POST /users/` → Create a user
- `POST /feature-x/users/` → Create a user (branch-prefixed)
- `PUT /users/:id` → Update a user
- `PUT /feature-x/users/:id` → Update a user (branch-prefixed)

#### Setting the `BRANCH` Environment Variable
To enable branch-prefixed routes, set the `BRANCH` environment variable:

```sh
export BRANCH=feature-x
```

### Benefits
- **Supports Feature Branching**: Easily test feature-specific API versions.
- **Automatic Routing Prefixing**: No need to manually adjust routes for different environments.
- **Seamless Integration**: Works with `routing-controllers` decorators.

## HttpStatus

### Overview
`HttpStatus` is an enumeration representing common HTTP status codes. It provides a readable and maintainable way to reference standard HTTP response codes in your application.

### Usage

#### Importing the `HttpStatus` Enum
```ts
import { HttpStatus } from '@domain/enums/HttpStatus.enum';
```

#### Using HTTP Status Codes in API Responses
The `HttpStatus` enum can be used to improve readability and maintainability in HTTP responses.

##### Example Usage in an Express API
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

#### Common Status Codes
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

### Benefits of Using `HttpStatus`
- **Improved Readability**: Instead of using magic numbers, named constants make code clearer.
- **Better Maintainability**: Centralized status codes make updates easier.
- **Reduced Errors**: Avoid mistyping HTTP status codes.

