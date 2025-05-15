interface VisitedColumn {
  name: string;
  type:
    | 'uuid'
    | 'string'
    | 'date'
    | 'datetime'
    | 'boolean'
    | 'number'
    | 'integer';
  default?: string | number | boolean;
  enum?: (string | number | boolean)[];
  description?: string;
}

export interface UnresolvedReference {
  name: string;
  reference: string;
  schemaPath: string[];
  oneToMany: boolean;
}

interface Reference {
  table: string;
  column: string;
}

export interface ResolvedReference {
  name: string;
  type: 'uuid' | 'string' | 'boolean' | 'integer';
  reference: Reference;
  oneToMany: boolean;
}

export interface VisitedTable {
  name: string;
  required?: string[];
  primaryKey?: string;
  visitedColumns: VisitedColumn[];
  unresolvedReferences: UnresolvedReference[];
}

export interface ResolvedTable extends VisitedTable {
  resolvedReferences: ResolvedReference[];
}

export interface ValidationError {
  path: string[];
  message: string;
}
