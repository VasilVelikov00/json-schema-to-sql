import {
  ResolvedReference,
  ResolvedTable,
  UnresolvedReference,
  ValidationError,
  VisitedTable,
} from './types';

function resolveReference(
  visitedTables: VisitedTable[],
  unresolvedReference: UnresolvedReference
):
  | { resolvedReference: ResolvedReference; error: null }
  | { resolvedReference: null; error: ValidationError } {
  const [, ...referencePath] = unresolvedReference.reference.split('/');
  const tablePath = referencePath.slice(0, -1);
  const referencedColumnName = referencePath.at(-1);

  const referencedTable = visitedTables.find(
    (table) => table.name === tablePath.join('_')
  );

  if (!referencedTable) {
    return {
      resolvedReference: null,
      error: {
        path: [...unresolvedReference.schemaPath, unresolvedReference.name],
        message: `${unresolvedReference.reference} references unknown table "${tablePath}"`,
      },
    };
  }

  const referencedColumn = referencedTable.visitedColumns.find(
    (column) => column.name === referencedColumnName
  );

  if (!referencedColumn) {
    return {
      resolvedReference: null,
      error: {
        path: [...unresolvedReference.schemaPath, unresolvedReference.name],
        message: `${unresolvedReference.reference} references unknown column "${referencedColumnName}" in table "${[tablePath].join('_')}"`,
      },
    };
  }

  if (
    referencedColumn.type === 'date' ||
    referencedColumn.type === 'datetime' ||
    referencedColumn.type === 'number'
  ) {
    return {
      resolvedReference: null,
      error: {
        path: [...unresolvedReference.schemaPath, unresolvedReference.name],
        message: `${unresolvedReference.reference} references disallowed "${referencedColumn.type}" type column "${referencedColumnName}" in table "${tablePath}"`,
      },
    };
  }

  return {
    resolvedReference: {
      name: unresolvedReference.name,
      type: referencedColumn.type,
      reference: {
        table: referencedTable.name,
        column: referencedColumn.name,
      },
      oneToMany: unresolvedReference.oneToMany,
    },
    error: null,
  };
}

export function resolveReferences(
  visitedTables: VisitedTable[]
):
  | { success: true; resolvedTables: ResolvedTable[]; errors: null }
  | { success: false; resolvedTables: null; errors: ValidationError[] } {
  const resolvedTables: ResolvedTable[] = [];
  const validationErrors: ValidationError[] = [];

  for (const visitedTable of visitedTables) {
    const resolvedTable: ResolvedTable = {
      ...visitedTable,
      resolvedReferences: [],
    };

    for (const unresolvedReference of visitedTable.unresolvedReferences) {
      const { resolvedReference, error } = resolveReference(
        visitedTables,
        unresolvedReference
      );

      if (error) {
        validationErrors.push(error);
      } else {
        resolvedTable.resolvedReferences.push(resolvedReference);
      }
    }
    resolvedTables.push(resolvedTable);
  }

  if (validationErrors.length > 0) {
    return { success: false, resolvedTables: null, errors: validationErrors };
  }

  return { success: true, resolvedTables, errors: null };
}
