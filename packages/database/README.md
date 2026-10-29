# database-operations

Database wrapper to help with connection creation and use of MyBatis, published as a GitHub package.

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

# MyBatisSession

## Overview
`MyBatisSession` is a utility class that integrates MyBatis mapping with MySQL, allowing for structured and efficient query execution. It supports query execution, result transformation, and silent error handling while providing debugging capabilities.

## Usage

### Importing the `MyBatisSession` Class
```ts
import { MyBatisSession } from "@dvsa/database-helpers";
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

### Parameters
`#{name}` values (including `<foreach>` items and nested properties such as `#{item.id}`) are sent to the database as bound parameters (`?` for MySQL, `:1`, `:2`… for Oracle), never written into the SQL text. `<if>` and `<when>` tests still see the real values.

- `${name}` is still substituted into the SQL as-is, so only use it for trusted values you have validated yourself, such as an integer `LIMIT`.
- A statement that uses `#{}` must not also contain a literal `?` (for example inside a string literal), because the driver would treat it as a placeholder. The session throws if it finds one.
- Values are bound as the same text mybatis-mapper used to write between the quotes: numbers and booleans as strings, objects as JSON, `null` as `NULL`.
- The session renders from its own copy of the namespace, so calling `MyBatis.getStatement` directly still behaves as before.

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
