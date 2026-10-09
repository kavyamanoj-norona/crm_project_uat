import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { logActivity } from "@/server/security/activity";
import { leadSchema } from "@/modules/customers/lead-schemas";
import { createLeadRecord } from "@/modules/customers/service";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { revalidatePath } from "next/cache";

// Website enquiries enter the CRM as leads. The website's server posts here
// with the shared key:
//
//   POST /api/leads/website
//   x-api-key: <WEBSITE_LEADS_API_KEY>
//   { "name": "…", "phone": "…", "purpose": "…", "email": "…" (optional) }
//
// `message` is accepted in place of `purpose`. A phone that is already a lead is
// not duplicated (the enquiry is added to its notes and a closed lead reopens);
// a phone that already belongs to a customer is acknowledged and ignored.
//
// Browser forms can call it directly if WEBSITE_LEADS_ORIGIN is set to the
// site's origin (CORS), but the key would then be public — prefer server-to-server.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

/** Small per-IP limiter (per server instance) to blunt form-spam. */
function rateLimited(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function keyMatches(given: string | null) {
  const expected = process.env.WEBSITE_LEADS_API_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function corsHeaders(request: Request): Record<string, string> {
  const allowed = process.env.WEBSITE_LEADS_ORIGIN;
  if (!allowed || request.headers.get("origin") !== allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "content-type, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

const text = (v: unknown, max = 1000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

  if (!process.env.WEBSITE_LEADS_API_KEY) {
    return json({ error: "Website leads are not configured — add WEBSITE_LEADS_API_KEY to .env" }, 503);
  }
  if (!keyMatches(request.headers.get("x-api-key"))) return json({ error: "Unauthorized" }, 401);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "Too many requests" }, 429);

  let body: Record<string, unknown>;
  try {
    const type = request.headers.get("content-type") ?? "";
    body = type.includes("application/json")
      ? ((await request.json()) as Record<string, unknown>)
      : Object.fromEntries(await request.formData());
  } catch {
    return json({ error: "Send the enquiry as JSON or a form" }, 400);
  }

  // Hidden "website" field filled in = a bot; pretend it worked.
  if (text(body.website)) return json({ ok: true, status: "ignored" });

  const message = text(body.message, 2000);
  const purpose = text(body.purpose, 500) || message.slice(0, 500) || "Website enquiry";
  const parsed = leadSchema.safeParse({
    name: text(body.name, 200),
    phone: text(body.phone ?? body.mobile, 30),
    purpose,
    email: text(body.email, 200),
    source: "WEBSITE",
    notes: message && message !== purpose ? message : "",
  });
  if (!parsed.success) {
    return json({ error: "Invalid enquiry", fields: parsed.error.flatten().fieldErrors }, 400);
  }
  const data = parsed.data;
  const stamp = new Date().toISOString().slice(0, 10);

  const existing = await db.customer.findUnique({
    where: { phone: data.phone },
    select: { id: true, code: true, kind: true, notes: true, isActive: true },
  });

  if (existing?.kind === "CUSTOMER") {
    return json({ ok: true, status: "existing_customer", code: existing.code });
  }

  if (existing) {
    // Same person enquiring again: keep one lead, note the new enquiry.
    const line = `[${stamp}] Website enquiry: ${data.purpose}`;
    await db.customer.update({
      where: { id: existing.id },
      data: { notes: existing.notes ? `${existing.notes}\n${line}` : line, isActive: true },
    });
    await logActivity({ action: "lead.website-repeat", entity: "Customer", entityId: existing.id, detail: existing.code });
    revalidatePath(CUSTOMER_PATHS.leads, "layout");
    return json({ ok: true, status: "duplicate_lead", code: existing.code });
  }

  try {
    const lead = await db.$transaction((tx) => createLeadRecord(tx, data, { branchId: null, actorId: null }));
    await logActivity({ action: "lead.website", entity: "Customer", entityId: lead.id, detail: lead.code });
    revalidatePath(CUSTOMER_PATHS.leads, "layout");
    revalidatePath(CUSTOMER_PATHS.leadReports, "layout");
    return json({ ok: true, status: "created", code: lead.code }, 201);
  } catch (e) {
    // Two identical enquiries at once: the unique phone index let only one through.
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return json({ ok: true, status: "duplicate_lead" });
    }
    console.error("website lead failed", e);
    return json({ error: "Could not save the enquiry" }, 500);
  }
}
