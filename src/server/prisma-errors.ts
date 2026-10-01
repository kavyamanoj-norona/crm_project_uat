import "server-only";
import { formValues, type FormState } from "@/lib/form";
import { ForbiddenError } from "@/server/rbac/guard";

/** Throw from an action write step to report a single field error. */
export class FieldError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}

/** Field names involved in a unique-constraint violation (P2002), if any. */
function uniqueFields(e: unknown): string[] | null {
  if (typeof e !== "object" || e === null || (e as { code?: string }).code !== "P2002") return null;
  const meta = (e as { meta?: Record<string, unknown> }).meta ?? {};
  if (Array.isArray(meta.target)) return meta.target as string[];
  // Driver-adapter shape: meta.driverAdapterError.cause.constraint.{fields | index}
  const cause = (meta.driverAdapterError as {
    cause?: { table?: string; constraint?: { fields?: string[]; index?: string } };
  })?.cause;
  const constraint = cause?.constraint;
  if (constraint?.fields) return constraint.fields.map((f) => f.replace(/"/g, ""));
  // Prisma names unique indexes <table>_<field>[_<field>…]_key, e.g. customer_phone_key.
  const index = constraint?.index;
  if (index && cause?.table && index.startsWith(`${cause.table}_`) && index.endsWith("_key")) {
    return index.slice(cause.table.length + 1, -4).split("_");
  }
  return [];
}

/** Turns known errors into a FormState; rethrows anything unexpected. */
export function handleActionError(
  e: unknown,
  labels: Record<string, string> = {},
  formData?: FormData,
): FormState {
  const values = formData ? formValues(formData) : undefined;
  if (e instanceof ForbiddenError) return { message: e.message, values };
  if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field]: [e.message] }, values };
  const fields = uniqueFields(e);
  if (fields) {
    const fieldErrors = Object.fromEntries(
      fields.map((f) => [f, [`${labels[f] ?? f} already exists`]]),
    );
    const names = fields.map((f) => labels[f] ?? f).join(", ");
    return { message: names ? `${names} already exists.` : "That record already exists.", fieldErrors, values };
  }
  throw e;
}
