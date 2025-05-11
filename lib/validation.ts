import { ZodSchema, ZodError } from "zod";

/**
 * Validates data against a Zod schema. Throws a standardized error on failure.
 * Usage: const data = validate(schema, input)
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      // Standardized error for API error handler
      throw {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.errors,
      };
    }
    throw err;
  }
} 