# json-schema-to-sql

[![Tests](https://github.com/VasilVelikov00/json-schema-to-sql/actions/workflows/tests.yaml/badge.svg)](https://github.com/VasilVelikov00/json-schema-to-sql/actions/workflows/tests.yaml)
[![npm](https://img.shields.io/npm/v/json-schema-to-sql.svg)](https://img.shields.io/npm/v/json-schema-to-sql.svg)
[![node](https://img.shields.io/node/v/json-schema-to-sql.svg)](https://img.shields.io/node/v/json-schema-to-sql.svg)
[![license](https://img.shields.io/npm/l/json-schema-to-sql.svg)](https://img.shields.io/npm/l/json-schema-to-sql.svg)

Convert a [JSON schema](https://json-schema.org/overview/what-is-jsonschema) into SQL statements for provisioning a database.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
  - [JSON Schema Compatible](#json-schema-compatible)
    - [JSON Schema Extensions](#json-schema-extensions)
    - [Unmapped Features](#unmapped-features)
  - [Fully Typed](#fully-typed)
  - [Supported Dialects](#supported-dialects)
  - [Nested Structures](#nested-structures)
    - [Objects](#objects)
    - [Arrays of Objects](#arrays-of-objects)
    - [Arrays of Literals](#arrays-of-literals)
  - [Validation](#validation)
- [Caveats](#caveats)
  - [Inferred Primary Keys](#inferred-primary-keys)
- [Limitations](#limitations)
  - [Composite Primary Keys](#composite-primary-keys)
  - [Arrays in Arrays](#arrays-in-arrays)
- [Contributing](#contributing)

## Installation

```shell
npm install json-schema-to-sql
```

## Usage

```typescript
import { generateSQLFromJSONSchema } from "json-schema-to-sql";

const myDatabaseJsonSchema = {
  type: 'object',
  properties: {
    users: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
      },
      required: ['id'],
      'x-primaryKey': ['id'],
    },
  },
};

const { queries, errors } = generateSQLFromJSONSchema(myDatabaseJsonSchema);
```

## Features

### JSON Schema Compatible

The library aims to map features of the JSON Schema spec as closely as possible to their logical counterpart in
relational databases.

A few examples:

| JSON Schema Feature | Database Feature                         |
|---------------------|------------------------------------------|
| `type` + `format`   | Type of the column                       |
| `required`          | Non nullable columns                     |
| `enum`              | CHECK constraint for the possible values |
| `default`           | Default value of the column              |
| `description`       | Column comment                           |

#### JSON Schema Extensions

Where a logical mapping is not possible, the library extends the JSON Schema spec using [the `x-` syntax](https://json-schema.org/blog/posts/custom-annotations-will-continue#what's-the-solution)

For example:

| JSON Schema Feature | Database Feature               |
|---------------------|--------------------------------|
| `x-primaryKey`      | Sets primary keys in the table |

In the future, things like `x-onDelete` and `x-onUpdate` will be added to support cascades.

#### Unmapped Features

JSON Schema features, which are not yet implemented or will never be implemented are just ignored by the converter.

### Fully Typed

All the internals use TypeScript.

### Supported Dialects

Currently, it supports [PostgreSQL](https://www.postgresql.org) and [MySQL](https://www.mysql.com) by passing `pg` and `mysql` respectively to the function. Default is `pg`.

Every example in this README will be using PostgreSQL.

### Nested Structures

Nested structures are normalized into tables, which reference their parent table by a dynamically generated [foreign key](https://www.w3schools.com/SQL/sql_ref_foreign_key.asp).

For example, let's take the following JSON schema:

```typescript
import { JSONSchema7 } from 'json-schema';

const mySchema = {
  type: 'object',
  properties: {
    users: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        settings: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'system'],
            },
          },
        },
        notes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              content: { type: 'string' },
            },
          },
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
} satisfies JSONSchema7
```

In this schema:
- `settings` is a nested object
- `notes` is a nested array of objects
- `tags` is a nested array of strings

The library will take care of the nesting by mapping each of the nested structures into a table. This table will have
its name prefixed by the name of the parent table like `<parent-table-name>_<table-name>`. An additional column with
name in the format `<parent-table-name>_<parent-table-primary-key>` will be added as a foreign key to the parent in each
table generated from a nested structure. Depending on the type of the nested structure, each table will be handled
differently:

#### Objects

Each property will be treated as a column of the nested table. A [unique constraint](https://www.w3schools.com/sqL/sql_unique.asp) will be added for the foreign key to
the parent table. This relationship is considered [1:1 (One-to-One)](https://www.geeksforgeeks.org/relationships-in-sql-one-to-one-one-to-many-many-to-many/).

#### Arrays of Objects

Each property will be treated as a column of the nested table. This relationship is considered [1:N (One-to-Many)](https://www.geeksforgeeks.org/relationships-in-sql-one-to-one-one-to-many-many-to-many/).

#### Arrays of Literals

A table with a single column called `value` with the type of the items will be created. This relationship is considered [1:N (One-to-Many)](https://www.geeksforgeeks.org/relationships-in-sql-one-to-one-one-to-many-many-to-many/).

Below are the resulting SQL queries:

```typescript
[
  `create table "users_settings" ("theme" varchar(255), check (theme IN ('light', 'dark', 'system')));`,
  'create table "users_notes" ("content" varchar(255));',
  'create table "users_tags" ("value" varchar(255));',
  'create table "users" ("id" uuid, constraint "users_pkey" primary key ("id"));',
  'alter table "users_settings" add column "users_id" uuid;',
  'alter table "users_settings" add constraint "users_settings_users_id_foreign" foreign key ("users_id") references "users" ("id");',
  'alter table "users_settings" add constraint "users_settings_users_id_unique" unique ("users_id");',
  'alter table "users_notes" add column "users_id" uuid;',
  'alter table "users_notes" add constraint "users_notes_users_id_foreign" foreign key ("users_id") references "users" ("id");',
  'alter table "users_tags" add column "users_id" uuid;',
  'alter table "users_tags" add constraint "users_tags_users_id_foreign" foreign key ("users_id") references "users" ("id");'
]

```

### Validation

Incoming schemas are treated as of type `unknown`. Internally, there are three steps of validation happening
sequentially:

1. Syntax validation with [Ajv](https://ajv.js.org)
2. Structural validation using [Zod](https://zod.dev)
3. Semantic validation for resolving references between tables

If somewhere along the validation sequence there is an error, it's collected and reported in the result of the function
with the following interface:

```typescript
interface ValidationError {
  message: string;   // The error message 
  path: string[];    // The place in the schema where the error occured
}
```

## Caveats

### Inferred Primary Keys

If a table has an `id` property, it will be considered a primary key, unless otherwise specified with `x-primaryKey`.

## Limitations

### Composite Primary Keys

Specifying multiple keys in `x-primaryKey` is currently not supported due to the complex logic required to map the
foreign keys of nested structures to them.

### Arrays in Arrays

Arrays nested in arrays are not supported and are considered an error in the schema due to a lack of a proper relational
database representation. I'm open to suggestions for implementing this.

## Contributing

The project is open to contributions. Just create a pull request at https://github.com/VasilVelikov00/json-schema-to-sql/pulls