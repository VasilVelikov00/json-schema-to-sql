import { generateSQL } from './generator';
import { resolveReferences } from './reference';
import { ValidationError, VisitedTable } from './types';
import { ajvValidate, zodParse } from './validator';
import { visitTable } from './visitor';

export function generateSQLFromJSONSchema(
  schema: unknown,
  dialect: 'pg' | 'mysql' = 'pg'
):
  | { queries: string[]; errors: null }
  | { queries: null; errors: ValidationError[] } {
  const isAjvValid = ajvValidate(schema);
  if (!isAjvValid) {
    return {
      queries: null,
      errors: [
        {
          path: ['#'],
          message: 'Invalid JSON Schema syntax',
        },
      ],
    };
  }

  const parseResult = zodParse(schema);
  if (!parseResult.success) {
    return {
      queries: null,
      errors: parseResult.error.issues.map((issue) => ({
        path: issue.path as string[],
        message: issue.message,
      })),
    };
  }

  const visitedTables: VisitedTable[] = [];
  for (const [tableName, table] of Object.entries(
    parseResult.data.properties
  )) {
    visitTable(visitedTables, tableName, table, [], ['properties']);
  }

  const resolutionResult = resolveReferences(visitedTables);
  if (!resolutionResult.success) {
    return {
      queries: null,
      errors: resolutionResult.errors,
    };
  }

  const queries = generateSQL(resolutionResult.resolvedTables, dialect);
  return { queries, errors: null };
}
