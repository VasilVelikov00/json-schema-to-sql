import Ajv from 'ajv';
import { JSONSchema7 } from 'json-schema';

import { DatabaseSchema } from './definitions';

const ajv = new Ajv();

export function ajvValidate(schema: unknown) {
  try {
    return ajv.validateSchema(schema as JSONSchema7, true);
  } catch {
    return;
  }
}

export function zodParse(schema: unknown) {
  return DatabaseSchema.safeParse(schema);
}
