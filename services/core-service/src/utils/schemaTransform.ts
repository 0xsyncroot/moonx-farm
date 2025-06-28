import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

/**
 * Transform Zod schema to JSON Schema for Fastify
 */
export function transformZodToJsonSchema(zodSchema: z.ZodSchema): any {
  return zodToJsonSchema(zodSchema, {
    target: 'openApi3',
    definitionPath: '#/components/schemas',
    $refStrategy: 'none',
    removeAdditionalStrategy: 'passthrough',
    strictUnions: false
  });
}

/**
 * Create Fastify schema from Zod schemas
 */
export function createFastifySchema(schemas: {
  body?: z.ZodSchema;
  querystring?: z.ZodSchema;
  params?: z.ZodSchema;
  response?: Record<number, z.ZodSchema>;
  tags?: string[];
  summary?: string;
  description?: string;
}): any {
  const fastifySchema: any = {};

  if (schemas.body) {
    fastifySchema.body = transformZodToJsonSchema(schemas.body);
  }

  if (schemas.querystring) {
    fastifySchema.querystring = transformZodToJsonSchema(schemas.querystring);
  }

  if (schemas.params) {
    fastifySchema.params = transformZodToJsonSchema(schemas.params);
  }

  if (schemas.response) {
    fastifySchema.response = {};
    Object.entries(schemas.response).forEach(([statusCode, schema]) => {
      fastifySchema.response[statusCode] = transformZodToJsonSchema(schema);
    });
  }

  // Add Swagger metadata
  if (schemas.tags) {
    fastifySchema.tags = schemas.tags;
  }
  if (schemas.summary) {
    fastifySchema.summary = schemas.summary;
  }
  if (schemas.description) {
    fastifySchema.description = schemas.description;
  }

  return fastifySchema;
} 