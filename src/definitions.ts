import { z } from 'zod';

export type RefColumn = z.infer<typeof RefColumnSchema>;

type LiteralColumn = z.infer<typeof LiteralColumnSchema>;

type StringColumn = z.infer<typeof StringColumnSchema>;

interface ArrayColumn {
  type: 'array';
  items: Column;
}

export interface Table {
  type: 'object';
  properties: Record<string, Column>;
  required?: string[];
  'x-primaryKey'?: string;
}

type NonArrayColumn = Table | LiteralColumn | StringColumn | RefColumn;

export type Column = NonArrayColumn | ArrayColumn;

const RefColumnSchema = z.object({
  $ref: z
    .string()
    .refine((val) => val.startsWith('#/'), {
      message: '$ref must start with "#/"',
    })
    .refine((val) => val.split('/').length >= 3, {
      message:
        '$ref must include at least one table and a column, e.g. "#/users/id"',
    }),
});

const NonRefColumnSchema = z.object({
  default: z.optional(z.union([z.string(), z.number(), z.boolean()])),
  enum: z.optional(z.array(z.union([z.string(), z.number(), z.boolean()]))),
  description: z.optional(z.string()),
});

const LiteralColumnSchema = NonRefColumnSchema.extend({
  type: z.union([
    z.literal('boolean'),
    z.literal('number'),
    z.literal('integer'),
  ]),
});

const StringColumnSchema = NonRefColumnSchema.extend({
  type: z.literal('string'),
  format: z.optional(
    z.union([z.literal('uuid'), z.literal('date'), z.literal('datetime')])
  ),
});

const ArrayColumnSchema: z.ZodType<ArrayColumn> = z.object({
  type: z.literal('array'),
  items: z.lazy(() => NonArrayColumnSchema),
});

const NonArrayColumnSchema: z.ZodType<NonArrayColumn> = z.lazy(() =>
  z.union([
    LiteralColumnSchema,
    StringColumnSchema,
    RefColumnSchema,
    TableSchema,
  ])
);

const ColumnSchema: z.ZodType<Column> = z.lazy(() =>
  z.union([
    LiteralColumnSchema,
    StringColumnSchema,
    ArrayColumnSchema,
    RefColumnSchema,
    TableSchema,
  ])
);

const TableSchema = z
  .object({
    type: z.literal('object'),
    properties: z.lazy(() => z.record(z.string(), ColumnSchema)),
    required: z.optional(z.array(z.string())),
    'x-primaryKey': z.optional(z.string()),
  })
  .superRefine((arg, ctx) => {
    if (arg.properties.id && !arg['x-primaryKey']) {
      if ('$ref' in arg.properties.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"id" is considered a primary key when "x-primaryKey" is missing and cannot be a "$ref"`,
        });
      }

      if ('type' in arg.properties.id) {
        const id = arg.properties.id;
        if (
          id.type === 'object' ||
          id.type === 'array' ||
          id.type === 'number'
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"id" is considered a primary key when "x-primaryKey" is missing and cannot be of type "${id.type}"`,
          });
        }

        if (
          id.type === 'string' &&
          (id.format === 'date' || id.format === 'datetime')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `"id" is considered a primary key when "x-primaryKey" is missing and cannot be of type "${id.type}" format "${id.format}"`,
          });
        }
      }
    }

    const [nestedName, nested] =
      Object.entries(arg.properties).find(
        ([, column]) =>
          'type' in column &&
          (column.type === 'object' || column.type === 'array')
      ) ?? [];

    if (nestedName && !arg.properties.id && !arg['x-primaryKey']) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Must have an "id" property or a custom primary key via "x-primaryKey" because it has nested "${nestedName}" of type "${'type' in nested! && nested.type}"`,
      });
    }

    if (arg.required && arg.required?.length > 0) {
      for (const field of arg.required) {
        if (!arg.properties[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Requires missing field "${field}"`,
          });
        }
      }
    }

    if (arg['x-primaryKey']) {
      const pk = arg['x-primaryKey'];
      if (!arg.properties[pk]) {
        return ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Refers to unknown field "${pk}"`,
        });
      }

      if ('$ref' in arg.properties[pk]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Primary key cannot be a "$ref"`,
        });
      }

      if ('type' in arg.properties[pk]) {
        const id = arg.properties[pk];
        if (
          id.type === 'object' ||
          id.type === 'array' ||
          id.type === 'number'
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Primary key cannot be of type "${id.type}"`,
          });
        }

        if (
          id.type === 'string' &&
          (id.format === 'date' || id.format === 'datetime')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Primary key cannot be of type "${id.type}" format "${id.format}"`,
          });
        }
      }
    }
  });

export const DatabaseSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), TableSchema),
});
