import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { Prisma } from "@prisma/client";

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

/**
 * Check if error is a known Prisma error
 */
function isPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

/**
 * Get safe error message from Prisma error
 * NEVER expose database schema, table names, or field names
 */
function getSafePrismaMessage(error: Prisma.PrismaClientKnownRequestError): string {
  switch (error.code) {
    case "P2002":
      // Unique constraint violation
      return "A record with that information already exists.";
    case "P2025":
      // Record not found
      return "The requested resource was not found.";
    case "P2003":
      // Foreign key constraint failed
      return "The operation could not be completed due to a data relationship.";
    case "P2014":
      // Invalid relation
      return "Invalid data relationship.";
    default:
      // Generic safe message for all other Prisma errors
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
  // Log full error server-side for debugging
  console.error("Error caught by global handler:", error);

  // Determine status code
  const statusCode = error.status || error.statusCode || 500;

  // In production, use safe generic messages
  const isProduction = env.NODE_ENV === "production";

  let message: string;

  if (isPrismaError(error)) {
    // Handle Prisma errors safely
    message = getSafePrismaMessage(error);
  } else if (statusCode >= 400 && statusCode < 500) {
    // Client errors - use the error message if it exists and is safe
    // These are typically validation errors or business logic errors
    message = error.message || "Bad request.";
  } else {
    // Server errors - always use generic message in production
    if (isProduction) {
      message = "An internal server error occurred.";
    } else {
      // In development, expose more details for debugging
      message = error.message || "An internal server error occurred.";
    }
  }

  // Build safe response
  const response: {
    success: false;
    message: string;
    error?: string;
    stack?: string;
  } = {
    success: false,
    message,
  };

  // ONLY in development: add error type and stack trace
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
