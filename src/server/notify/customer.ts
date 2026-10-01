import { formatPaise } from "@/lib/money";
import type { MetaComponent } from "./whatsapp-templates";

export type QuoteNotifyArgs = {
  customerName: string;
  customerPhone: string;
  jobsheetNo: string;
  device: string;
  estimatePaise: number;
  branchName: string;
};

/** Builds a WhatsApp click-to-chat URL — no BSP account needed, staff clicks it. */
export function quoteWhatsAppLink({ customerPhone, customerName, jobsheetNo, device, estimatePaise, branchName }: QuoteNotifyArgs): string {
  const digits = customerPhone.replace(/\D/g, "");
  const e164 = digits.startsWith("91") ? digits : `91${digits}`;
  const text = [
    `Hello ${customerName} 👋`,
    ``,
    `Your device *${device}* has been diagnosed at *${branchName}*.`,
    ``,
    `*Quotation:* ${formatPaise(estimatePaise)}`,
    `*Jobsheet:* ${jobsheetNo}`,
    ``,
    `Please reply to let us know if you'd like to proceed with the repair.`,
    ``,
    `Thank you,`,
    `Laptop Clinic`,
  ].join("\n");
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}

/**
 * Sends the quote notification via a WhatsApp BSP (e.g. Gupshup, MSG91, WATI).
 * Requires WHATSAPP_API_URL + WHATSAPP_API_KEY in your .env.
 *
 * The request body below follows a generic template-message format.
 * Replace it with your BSP's payload shape; the function signature stays the same.
 *
 * If neither env var is set this is a no-op — staff uses the wa.me link manually.
 */
export async function sendQuoteNotification(args: QuoteNotifyArgs): Promise<void> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;
  if (!apiUrl || !apiKey) return;

  try {
    const phone = args.customerPhone.replace(/\D/g, "");
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        to: phone.startsWith("91") ? phone : `91${phone}`,
        type: "template",
        template: {
          name: "quote_ready",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: args.customerName },
                { type: "text", text: args.device },
                { type: "text", text: formatPaise(args.estimatePaise) },
                { type: "text", text: args.jobsheetNo },
                { type: "text", text: args.branchName },
              ],
            },
          ],
        },
      }),
    });
  } catch (err) {
    // Never fail the main action if the notification errors
    console.error("[notify] WhatsApp send failed:", err);
  }
}

/**
 * Sends a pre-approved WhatsApp Business template via the Meta Cloud API.
 * Requires WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN in your .env.
 *
 * Throws on missing config or non-2xx response — callers should catch and
 * persist the error rather than letting it bubble up to the user.
 */
export async function sendMetaWhatsAppTemplate(args: {
  phone: string;
  templateName: string;
  language: string;
  components: MetaComponent[];
}): Promise<{ messageId: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp not configured: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.");
  }

  const digits = args.phone.replace(/\D/g, "");
  const e164 = `+${digits.startsWith("91") ? digits : `91${digits}`}`;

  const body = {
    messaging_product: "whatsapp",
    to: e164,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: args.language },
      components: args.components,
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    let detail = "";
    try {
      const json = (await res.json()) as { error?: { message?: string } };
      detail = json.error?.message ?? "";
    } catch {
      // ignore parse errors
    }
    throw new Error(`Meta API error ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const json = (await res.json()) as { messages?: { id: string }[] };
  const messageId = json.messages?.[0]?.id ?? "";
  return { messageId };
}
