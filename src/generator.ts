import knex from 'knex';

import { ResolvedTable } from './types';

export function generateSQL(
  resolvedTables: ResolvedTable[],
  dialect: 'pg' | 'mysql' = 'pg'
): string[] {
  const db = knex({ client: dialect });
  const queries: string[] = [];

  for (const resolvedTable of resolvedTables) {
    const builder = db.schema.createTable(resolvedTable.name, (table) => {
      for (const visitedColumn of resolvedTable.visitedColumns) {
        const { type, name } = visitedColumn;
        let col;
        switch (type) {
          case 'uuid':
            col = table.uuid(name);
            break;
          case 'string':
            col = table.string(name);
            break;
          case 'boolean':
            col = table.boolean(name);
            break;
          case 'date':
            col = table.date(name);
            break;
          case 'datetime':
            col = table.datetime(name);
            break;
          case 'number':
            col = table.float(name);
            break;
          case 'integer':
            col = table.integer(name);
            break;
        }

        if (resolvedTable.required?.includes(name)) {
          col.notNullable();
        }

        if (visitedColumn.default) {
          col.defaultTo(visitedColumn.default);
        }

        if (visitedColumn.description) {
          col.comment(visitedColumn.description);
        }

        if (visitedColumn.enum) {
          const values = visitedColumn.enum.map((v) => `'${v}'`).join(', ');
          table.check(`${name} IN (${values})`);
        }
      }

      if (resolvedTable.primaryKey) {
        table.primary([resolvedTable.primaryKey]);
      } else if (resolvedTable.visitedColumns.find((c) => c.name === 'id')) {
        table.primary(['id']);
      }
    });
    queries.push(...builder.toSQL().map((q) => `${q.sql};`));
  }

  for (const resolvedTable of resolvedTables) {
    const builder = db.schema.alterTable(resolvedTable.name, (table) => {
      for (const resolvedReference of resolvedTable.resolvedReferences) {
        const { type, name, reference, oneToMany } = resolvedReference;
        switch (type) {
          case 'uuid':
            table
              .uuid(name)
              .references(reference.column)
              .inTable(reference.table);
            break;
          case 'string':
            table
              .string(name)
              .references(reference.column)
              .inTable(reference.table);
            break;
          case 'boolean':
            table
              .boolean(name)
              .references(reference.column)
              .inTable(reference.table);
            break;
          case 'integer':
            table
              .integer(name)
              .references(reference.column)
              .inTable(reference.table);
            break;
        }

        if (!oneToMany) {
          table.unique(name);
        }
      }
    });
    queries.push(...builder.toSQL().map((q) => `${q.sql};`));
  }

  return queries;
}
