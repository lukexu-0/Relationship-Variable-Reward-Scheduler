import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";

import { isHttpError } from "../lib/http-error.js";

const logger = pino({ name: "api-error-handler" });

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (isHttpError(error)) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  logger.error({ error }, "Unhandled API error");
  res.status(500).json({
    error: {
      message: "Internal server error"
    }
  });
}
