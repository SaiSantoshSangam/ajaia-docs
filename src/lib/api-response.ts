import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthorizationError } from "@/services/authorization";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof ZodError) {
    return jsonError("Validation failed", 400, error.flatten().fieldErrors);
  }

  if (error instanceof SyntaxError) {
    return jsonError("Invalid JSON request body", 400);
  }

  if (error instanceof Error) {
    if (error.message.includes("already the owner")) {
      return jsonError(error.message, 400);
    }
    return jsonError(error.message, 500);
  }

  return jsonError("An unexpected error occurred", 500);
}

