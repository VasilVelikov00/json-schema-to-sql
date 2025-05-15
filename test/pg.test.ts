import { describe, expect, it } from 'vitest';

import { generateSQLFromJSONSchema } from '../src';

describe('generateSqlFromJsonSchema', () => {
  it('returns an error for invalid JSON schema syntax', () => {
    const schema = {
      type: 'object',
      properties: {
        posts: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: -1 },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message: 'Invalid JSON Schema syntax',
        path: ['#'],
      },
    ]);
  });

  it('returns an error for invalid $ref format', () => {
    const schema = {
      type: 'object',
      properties: {
        posts: {
          type: 'object',
          properties: {
            user_id: { $ref: 'users/id' },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message: '$ref must start with "#/"',
        path: ['properties', 'posts', 'properties', 'user_id', '$ref'],
      },
      {
        message:
          '$ref must include at least one table and a column, e.g. "#/users/id"',
        path: ['properties', 'posts', 'properties', 'user_id', '$ref'],
      },
    ]);
  });

  it('returns an error for missing $ref table', () => {
    const schema = {
      type: 'object',
      properties: {
        posts: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { $ref: '#/users/id' },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message: '#/users/id references unknown table "users"',
        path: ['properties', 'posts', 'properties', 'user_id'],
      },
    ]);
  });

  it('returns an error for missing $ref column', () => {
    const schema = {
      type: 'object',
      properties: {
        posts: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_id: { $ref: '#/users/name' },
          },
        },
        users: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message:
          '#/users/name references unknown column "name" in table "users"',
        path: ['properties', 'posts', 'properties', 'user_id'],
      },
    ]);
  });

  it('returns an error for missing a required field', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['name'],
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message: 'Requires missing field "name"',
        path: ['properties', 'users'],
      },
    ]);
  });

  it('returns an error for missing primary key field', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          'x-primaryKey': 'name',
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message: 'Refers to unknown field "name"',
        path: ['properties', 'users'],
      },
    ]);
  });

  it('returns an error for $ref id when primary key is not explicitly defined', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        posts: {
          type: 'object',
          properties: {
            id: { $ref: '#/users/id' },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message:
          '"id" is considered a primary key when "x-primaryKey" is missing and cannot be a "$ref"',
        path: ['properties', 'posts'],
      },
    ]);
  });

  it('returns an error for disallowed id type when primary key is not explicitly defined', () => {
    const schema = {
      type: 'object',
      properties: {
        object_id: {
          type: 'object',
          properties: {
            id: { type: 'object', properties: {} },
          },
        },
        array_id: {
          type: 'object',
          properties: {
            id: { type: 'array', items: { type: 'string' } },
          },
        },
        number_id: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'object_id'],
        message:
          '"id" is considered a primary key when "x-primaryKey" is missing and cannot be of type "object"',
      },
      {
        path: ['properties', 'array_id'],
        message:
          '"id" is considered a primary key when "x-primaryKey" is missing and cannot be of type "array"',
      },
      {
        path: ['properties', 'number_id'],
        message:
          '"id" is considered a primary key when "x-primaryKey" is missing and cannot be of type "number"',
      },
    ]);
  });

  it('returns an error for disallowed id format when primary key is not explicitly defined', () => {
    const schema = {
      type: 'object',
      properties: {
        date_id: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'date' },
          },
        },
        datetime_id: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'datetime' },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'date_id'],
        message:
          '"id" is considered a primary key when "x-primaryKey" is missing and cannot be of type "string" format "date"',
      },
      {
        path: ['properties', 'datetime_id'],
        message:
          '"id" is considered a primary key when "x-primaryKey" is missing and cannot be of type "string" format "datetime"',
      },
    ]);
  });

  it('returns an error for $ref primary key', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        posts: {
          type: 'object',
          properties: {
            name: { $ref: '#/users/id' },
          },
          'x-primaryKey': 'name',
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        message: 'Primary key cannot be a "$ref"',
        path: ['properties', 'posts'],
      },
    ]);
  });

  it('returns an error for disallowed primary key type', () => {
    const schema = {
      type: 'object',
      properties: {
        object_id: {
          type: 'object',
          properties: {
            name: { type: 'object', properties: {} },
          },
          'x-primaryKey': 'name',
        },
        array_id: {
          type: 'object',
          properties: {
            name: { type: 'array', items: { type: 'string' } },
          },
          'x-primaryKey': 'name',
        },
        number_id: {
          type: 'object',
          properties: {
            name: { type: 'number' },
          },
          'x-primaryKey': 'name',
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'object_id'],
        message: 'Primary key cannot be of type "object"',
      },
      {
        path: ['properties', 'array_id'],
        message: 'Primary key cannot be of type "array"',
      },
      {
        path: ['properties', 'number_id'],
        message: 'Primary key cannot be of type "number"',
      },
    ]);
  });

  it('returns an error for disallowed primary key format', () => {
    const schema = {
      type: 'object',
      properties: {
        date_id: {
          type: 'object',
          properties: {
            name: { type: 'string', format: 'date' },
          },
          'x-primaryKey': 'name',
        },
        datetime_id: {
          type: 'object',
          properties: {
            name: { type: 'string', format: 'datetime' },
          },
          'x-primaryKey': 'name',
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'date_id'],
        message: 'Primary key cannot be of type "string" format "date"',
      },
      {
        path: ['properties', 'datetime_id'],
        message: 'Primary key cannot be of type "string" format "datetime"',
      },
    ]);
  });

  it('returns an error for referenced columns with disallowed types', () => {
    const schema = {
      type: 'object',
      properties: {
        posts: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_date_id: { $ref: '#/users/date_id' },
            user_datetime_id: { $ref: '#/users/date_id' },
            user_number_id: { $ref: '#/users/number_id' },
          },
        },
        users: {
          type: 'object',
          properties: {
            date_id: { type: 'string', format: 'date' },
            datetime_id: { type: 'string', format: 'datetime' },
            number_id: { type: 'number' },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'posts', 'properties', 'user_date_id'],
        message:
          '#/users/date_id references disallowed "date" type column "date_id" in table "users"',
      },
      {
        path: ['properties', 'posts', 'properties', 'user_datetime_id'],
        message:
          '#/users/date_id references disallowed "date" type column "date_id" in table "users"',
      },
      {
        path: ['properties', 'posts', 'properties', 'user_number_id'],
        message:
          '#/users/number_id references disallowed "number" type column "number_id" in table "users"',
      },
    ]);
  });

  it('returns an error on arrays in arrays', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            notes: {
              type: 'array',
              items: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'users', 'properties', 'notes'],
        message: 'Invalid input',
      },
    ]);
  });

  it('returns an error on nested objects without a primary key in the parent', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            settings: {
              type: 'object',
              properties: {
                theme: { type: 'string' },
              },
            },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'users'],
        message:
          'Must have an "id" property or a custom primary key via "x-primaryKey" because it has nested "settings" of type "object"',
      },
    ]);
  });

  it('returns an error on nested arrays without a primary key in the parent', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            notes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.queries).toBeNull();
    expect(result.errors).toStrictEqual([
      {
        path: ['properties', 'users'],
        message:
          'Must have an "id" property or a custom primary key via "x-primaryKey" because it has nested "notes" of type "array"',
      },
    ]);
  });

  it('generates basic table without a primary key', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
    };
    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users" ("name" varchar(255));',
    ]);
  });

  it('generates basic table with primary key', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
      },
    };
    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users" ("id" uuid, "name" varchar(255), constraint "users_pkey" primary key ("id"));',
    ]);
  });

  it('generates basic table where primary key overwrites id', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
          'x-primaryKey': 'name',
        },
      },
    };
    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users" ("id" uuid, "name" varchar(255), constraint "users_pkey" primary key ("name"));',
    ]);
  });

  it('generates a table with properties of different types', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date' },
            datetime: { type: 'string', format: 'datetime' },
            number: { type: 'number' },
          },
        },
      },
    };
    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users" ("date" date, "datetime" timestamptz, "number" real);',
    ]);
  });

  it('allows referencing columns with supported types', () => {
    const schema = {
      type: 'object',
      properties: {
        posts: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            user_string_id: { $ref: '#/users/string_id' },
            user_boolean_id: { $ref: '#/users/boolean_id' },
            user_integer_id: { $ref: '#/users/integer_id' },
          },
        },
        users: {
          type: 'object',
          properties: {
            string_id: { type: 'string' },
            boolean_id: { type: 'boolean' },
            integer_id: { type: 'integer' },
          },
        },
      },
    };
    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "posts" ("id" varchar(255), constraint "posts_pkey" primary key ("id"));',
      'create table "users" ("string_id" varchar(255), "boolean_id" boolean, "integer_id" integer);',
      'alter table "posts" add column "user_string_id" varchar(255), add column "user_boolean_id" boolean, add column "user_integer_id" integer;',
      'alter table "posts" add constraint "posts_user_string_id_foreign" foreign key ("user_string_id") references "users" ("string_id");',
      'alter table "posts" add constraint "posts_user_string_id_unique" unique ("user_string_id");',
      'alter table "posts" add constraint "posts_user_boolean_id_foreign" foreign key ("user_boolean_id") references "users" ("boolean_id");',
      'alter table "posts" add constraint "posts_user_boolean_id_unique" unique ("user_boolean_id");',
      'alter table "posts" add constraint "posts_user_integer_id_foreign" foreign key ("user_integer_id") references "users" ("integer_id");',
      'alter table "posts" add constraint "posts_user_integer_id_unique" unique ("user_integer_id");',
    ]);
  });

  it('handles nested objects and arrays as tables', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            settings: {
              type: 'object',
              properties: {
                theme: { type: 'string' },
              },
              required: ['theme'],
            },
            notes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  content: { type: 'string' },
                },
                required: ['content'],
              },
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['id'],
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users_settings" ("theme" varchar(255) not null);',
      'create table "users_notes" ("id" uuid, "content" varchar(255) not null, constraint "users_notes_pkey" primary key ("id"));',
      'create table "users_tags" ("value" varchar(255));',
      'create table "users" ("id" uuid not null, constraint "users_pkey" primary key ("id"));',
      'alter table "users_settings" add column "users_id" uuid;',
      'alter table "users_settings" add constraint "users_settings_users_id_foreign" foreign key ("users_id") references "users" ("id");',
      'alter table "users_settings" add constraint "users_settings_users_id_unique" unique ("users_id");',
      'alter table "users_notes" add column "users_id" uuid;',
      'alter table "users_notes" add constraint "users_notes_users_id_foreign" foreign key ("users_id") references "users" ("id");',
      'alter table "users_tags" add column "users_id" uuid;',
      'alter table "users_tags" add constraint "users_tags_users_id_foreign" foreign key ("users_id") references "users" ("id");',
    ]);
  });

  it('generates enum constraint correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
              enum: ['admin', 'user', 'guest'],
            },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      `create table "users" ("role" varchar(255), check (role IN ('admin', 'user', 'guest')));`,
    ]);
  });

  it('applies field descriptions as comments', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The full name of the user',
            },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users" ("name" varchar(255));',
      `comment on column "users"."name" is 'The full name of the user';`,
    ]);
  });

  it('applies default values to columns', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            age: {
              type: 'integer',
              default: 30,
            },
            is_active: {
              type: 'boolean',
              default: true,
            },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users" ("age" integer default \'30\', "is_active" boolean default \'1\');',
    ]);
  });

  it('handles deeply nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        company: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            departments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  employees: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        fullName: { type: 'string' },
                        title: { type: 'string' },
                      },
                      required: ['fullName'],
                    },
                  },
                },
                required: ['name'],
              },
            },
          },
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "company_departments_employees" ("id" uuid, "fullName" varchar(255) not null, "title" varchar(255), constraint "company_departments_employees_pkey" primary key ("id"));',
      'create table "company_departments" ("id" uuid, "name" varchar(255) not null, constraint "company_departments_pkey" primary key ("id"));',
      'create table "company" ("id" uuid, "name" varchar(255), constraint "company_pkey" primary key ("id"));',
      'alter table "company_departments_employees" add column "company_departments_id" uuid;',
      'alter table "company_departments_employees" add constraint "company_departments_employees_company_departments_id_foreign" foreign key ("company_departments_id") references "company_departments" ("id");',
      'alter table "company_departments" add column "company_id" uuid;',
      'alter table "company_departments" add constraint "company_departments_company_id_foreign" foreign key ("company_id") references "company" ("id");',
    ]);
  });

  it('accepts nested structures with a custom primary key in the parent', () => {
    const schema = {
      type: 'object',
      properties: {
        users: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            settings: {
              type: 'object',
              properties: {
                theme: { type: 'string' },
              },
            },
            notes: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          'x-primaryKey': 'name',
        },
      },
    };

    const result = generateSQLFromJSONSchema(schema);
    expect(result.errors).toBeNull();
    expect(result.queries).toStrictEqual([
      'create table "users_settings" ("theme" varchar(255));',
      'create table "users_notes" ("value" varchar(255));',
      'create table "users" ("name" varchar(255), constraint "users_pkey" primary key ("name"));',
      'alter table "users_settings" add column "users_name" varchar(255);',
      'alter table "users_settings" add constraint "users_settings_users_name_foreign" foreign key ("users_name") references "users" ("name");',
      'alter table "users_settings" add constraint "users_settings_users_name_unique" unique ("users_name");',
      'alter table "users_notes" add column "users_name" varchar(255);',
      'alter table "users_notes" add constraint "users_notes_users_name_foreign" foreign key ("users_name") references "users" ("name");',
    ]);
  });
});
