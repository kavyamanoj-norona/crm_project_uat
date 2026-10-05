import { CheckCircle2, MessageSquare, FileText, AlertTriangle, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Portal Preview" };

const WHATSAPP_TEMPLATES = [
  {
    num: 1,
    title: "Acceptance form",
    detail: "(PDF) + portal magic link — at intake",
    highlight: true,
  },
  {
    num: 2,
    title: "Quotation approval request",
    detail: "+ portal link",
    highlight: false,
  },
  {
    num: 3,
    title: "Ready for delivery",
    detail: "— device, branch, jobsheet, total",
    highlight: false,
  },
  {
    num: 4,
    title: "Service report + receipt",
    detail: "(PDF) + Google review link",
    highlight: false,
  },
  {
    num: 5,
    title: "Collection reminder",
    detail: "— 30 / 60 / 90 days",
    highlight: false,
  },
];

const PROGRESS_STEPS = [
  { label: "Intake", done: true, active: false },
  { label: "Diagnosis", done: true, active: false },
  { label: "Pending approval", done: false, active: true },
  { label: "Awaiting stock", done: false, active: false },
  { label: "Quality check", done: false, active: false },
  { label: "Ready", done: false, active: false },
  { label: "Closed", done: false, active: false },
];

export default async function PortalPreviewPage() {
  await requirePageAccess(CUSTOMER_PATHS.portalPreview);

  return (
    <>
      <PageHeader
        title="Customer Portal — Preview"
        subtitle="Mobile-first · magic link from WhatsApp (zero typing) · fallback: phone + last 4 of jobsheet · no OTP cost"
        breadcrumbs={["Customers & Support", "Portal Preview"]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Mobile mock */}
        <div className="flex justify-center">
          <div className="w-full max-w-xs">
            {/* Phone shell */}
            <div className="overflow-hidden rounded-[2.5rem] border-[6px] border-brand-navy bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900">
              {/* Status bar */}
              <div className="bg-brand-navy px-5 py-3 dark:bg-slate-800">
                <p className="text-center text-[11px] font-semibold text-white">Laptop Clinic</p>
                <p className="text-center text-[10px] text-white/70">Jobsheet LC-EDP-2607-0143 · Edappally</p>
              </div>

              <div className="p-4">
                {/* Device name */}
                <p className="font-bold text-slate-800 dark:text-slate-100">Dell Inspiron 5518</p>

                {/* Progress bar */}
                <div className="mt-2 flex gap-0.5">
                  {PROGRESS_STEPS.map((step, i) => (
                    <div
                      key={i}
                      title={step.label}
                      className={`h-1.5 flex-1 rounded-full ${
                        step.done
                          ? "bg-primary"
                          : step.active
                            ? "bg-primary/50"
                            : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Status: <span className="font-medium">Being diagnosed</span> — we&apos;ll send your quote here.
                </p>

                {/* Quotation card */}
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Quotation — ₹7,850</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Keyboard ₹2,900 · Board repair ₹4,500 · Cleaning ₹450 · GST incl.
                  </p>
                  <button className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white">
                    Approve quote
                  </button>
                  <button className="mt-2 w-full rounded-lg border border-red-300 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400">
                    Reject
                  </button>
                </div>

                {/* Action links */}
                <div className="mt-3 space-y-2">
                  {[
                    { icon: FileText, label: "Acceptance form (PDF)" },
                    { icon: MessageSquare, label: "Talk to branch" },
                    { icon: AlertTriangle, label: "Raise a concern" },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Icon className="size-4 text-slate-400" />
                      {label}
                      <ChevronRight className="ml-auto size-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] text-text-muted">
              Front-end prototype for developer hand-off · data is illustrative
            </p>
          </div>
        </div>

        {/* WhatsApp templates info */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-1 font-bold text-brand-navy dark:text-text">
              Exactly five WhatsApp templates (cost-controlled)
            </h2>
            <p className="mb-4 text-xs text-text-muted">
              No status spam — intermediate states live in the portal. BSP swappable behind one typed client
              (Gupshup / AiSensy / MSG91 / WATI).
            </p>
            <ol className="space-y-3">
              {WHATSAPP_TEMPLATES.map((t) => (
                <li key={t.num} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {t.num}
                  </span>
                  <p className="text-sm">
                    <span className={t.highlight ? "font-bold" : "font-semibold"}>{t.title}</span>{" "}
                    <span className="text-text-muted">{t.detail}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-bold text-brand-navy dark:text-text">Portal access — zero friction</h2>
            <div className="space-y-3 text-sm">
              {[
                {
                  icon: CheckCircle2,
                  color: "text-green-500",
                  text: "Magic link in WhatsApp — tap to open, no typing required",
                },
                {
                  icon: CheckCircle2,
                  color: "text-green-500",
                  text: "Fallback: phone number + last 4 digits of jobsheet",
                },
                {
                  icon: CheckCircle2,
                  color: "text-green-500",
                  text: "No OTP cost — magic links are one-time and expire in 24h",
                },
                {
                  icon: CheckCircle2,
                  color: "text-green-500",
                  text: "Works on any browser — no app install needed",
                },
              ].map(({ icon: Icon, color, text }, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
                  <p className="text-text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
