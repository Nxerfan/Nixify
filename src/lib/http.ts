import { NextRequest } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { apiError, ERROR_CODES } from "@/lib/api-response";

/** Parse and validate a JSON request body. Returns [data, null] or [null, response]. */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
): Promise<[T, null] | [null, ReturnType<typeof apiError>]> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return [null, apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid JSON body", 400)];
  }
  try {
    const data = schema.parse(json);
    return [data as T, null];
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.issues.map((i) => i.message).join("; ");
      return [null, apiError(ERROR_CODES.VALIDATION_FAILED, message, 400)];
    }
    return [null, apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid request", 400)];
  }
}
