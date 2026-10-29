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
`#{name}` values, including `<foreach>` items and paths such as `#{item.id}` or `#{list.length}`, are no longer escaped into the SQL by mybatis-mapper, whose escaping could be broken out of. `<if>` and `<when>` tests still see the real values, and the parameters object is used as before (getters, class instances and `<foreach>`/`<bind>` writes all behave the same).

- **How values reach the database**
  - MySQL `query`/`selectOne`/`selectList`: each value is escaped by mysql2 itself (`connection.escape`, the same escaping its client-side `?` placeholders use) and the statement is sent as text. This relies on the default `sql_mode`, without `NO_BACKSLASH_ESCAPES`. Reads are kept off server-side prepared statements because mysql2 caches those per connection.
  - MySQL `execute`: server-side prepared statement with `?` placeholders.
  - Oracle: positional `:1`, `:2`… binds.
- **`${name}`** is still substituted into the SQL as-is. Only use it for trusted values you have validated yourself, such as an integer `LIMIT`.
- **Value types:**
  - strings are passed as they are;
  - numbers and booleans are passed as the same text as before (`'25'`, `'true'`), so a number compared with a `VARCHAR` column still uses its index;
  - `Date` and `Buffer` values are passed to the driver as they are;
  - objects and arrays are passed as JSON;
  - `null` becomes `NULL`.
- **Escaping changes:**
  - a `%` or `_` in a value is no longer escaped, so it is a wildcard if the value is used in a `LIKE` pattern. Use `escapeLikePattern(value)` (exported alongside `MyBatisSession`) to match it literally, e.g. `LIKE CONCAT('%', #{name}, '%')` with `name: escapeLikePattern(input)`;
  - double quotes are no longer altered.
- **Placeholder limits:** where placeholders are used (MySQL `execute`, Oracle), a `#{}` must sit where the database accepts a bind value. Forms like `IS #{v}` or `DATE #{d}` only work on MySQL reads.
- **Namespace copy:** the session renders from a copy of its namespace, registered as `<namespace>::bound` and kept in step with the original, so calling `MyBatis.getStatement` directly behaves as before.
- **Dependency:** mybatis-mapper is pinned to an exact version because this relies on its internals.

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
