import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

/**
 * Global error handler middleware
 *
 * SECURITY RULES:
 * - NEVER expose stack traces in production
 * - NEVER expose database internals
 * - NEVER expose filesystem paths
 * - NEVER expose sensitive configuration
 * - NEVER expose JWT secrets or tokens
 * - NEVER expose passwords or hashes
 * - Keep error messages generic and safe
 */

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

interface PrismaLikeError {
  code: string;
}

/**
 * Check if an error looks like a Prisma client error without importing
 * Prisma's runtime namespace. Prisma 7's ESM client does not expose the
 * legacy `Prisma` namespace from `@prisma/client` in this deployment shape.
 */
function isPrismaError(error: unknown): error is PrismaLikeError {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^P\d{4}$/.test(code);
}

/**
 * Get safe error message from a Prisma error
 * NEVER expose database schema, table names, or field names
 */
function getSafePrismaMessage(error: PrismaLikeError): string {
  switch (error.code) {
    case "P2002":
      return "A record with that information already exists.";
    case "P2025":
      return "The requested resource was not found.";
    case "P2003":
      return "The operation could not be completed due to a data relationship.";
    case "P2014":
      return "Invalid data relationship.";
    default:
      return "A database error occurred.";
  }
}

/**
 * Main error handler middleware
 * Should be the last middleware in the chain
 */
export function errorHandler(
  error: ErrorWithStatus,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  console.error("Error caught by global handler:", error);

  const statusCode = error.status || error.statusCode || 500;
  const isProduction = env.NODE_ENV === "production";

  let message: string;

  if (isPrismaError(error)) {
    message = getSafePrismaMessage(error);
  } else if (statusCode >= 400 && statusCode < 500) {
    message = error.message || "Bad request.";
  } else if (isProduction) {
    message = "An internal server error occurred.";
  } else {
    message = error.message || "An internal server error occurred.";
  }

  const response: {
    success: false;
    message: string;
    error?: string;
    stack?: string;
  } = {
    success: false,
    message,
  };

  if (!isProduction) {
    response.error = error.name;
    if (error.stack) {
      response.stack = error.stack;
    }
  }

  res.status(statusCode).json(response);
}

/**
 * 404 handler for unknown routes
 * Should be added after all route handlers but before error handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: "The requested endpoint was not found.",
  });
}
