import type { ZodSchema } from "zod";

import { HttpError } from "./http-error.js";

export function parseOrThrow<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(400, "Validation failed", result.error.flatten());
  }

  return result.data;
}
