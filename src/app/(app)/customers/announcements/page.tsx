import { Pin, Megaphone, FileText, CheckCircle2, Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Announcements" };

// Placeholder data — announcements will be backed by a DB model in a future sprint.
const PINNED_DOCS = [
  {
    id: "1",
    title: "Parts & Services Price List",
    version: "v14",
    updatedBy: "Purchase Manager",
    updatedAt: "1 Jul",
    seenBy: 41,
    total: 48,
    isNew: true,
  },
  {
    id: "2",
    title: "IT Products & Accessories",
    version: "v9",
    updatedBy: "Purchase Manager",
    updatedAt: "22 Jun",
    seenBy: 48,
    total: 48,
    isNew: false,
  },
];

const ANNOUNCEMENTS = [
  {
    id: "1",
    title: "Onam offer pricing goes live 20 Aug",
    author: "Admin",
    date: "6 Jul",
    requiresAck: true,
    acknowledged: false,
    detail: "acknowledge required",
  },
  {
    id: "2",
    title: "New minimum prices on display panels",
    author: "Purchase Manager",
    date: "3 Jul",
    requiresAck: false,
    acknowledged: true,
    detail: "price history: DP310 ₹4,600 → ₹4,900",
  },
];

export default async function AnnouncementsPage() {
  await requirePageAccess(CUSTOMER_PATHS.announcements);

  return (
    <>
      <PageHeader
        title="Catalog & Announcements"
        subtitle="One screen, two zones · shared catalog across all branches · price-change history retained"
        breadcrumbs={["Customers & Support", "Announcements"]}
      />

      {/* Pinned pricing documents */}
      <section className="mb-6 rounded-xl border-2 border-primary/30 bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Pin className="size-4 text-red-500" />
          <h2 className="font-bold text-brand-navy dark:text-text">Pinned pricing documents</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {PINNED_DOCS.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/40 p-4"
            >
              <div className="flex items-center gap-3">
                <FileText className="size-5 shrink-0 text-text-muted" />
                <div>
                  <p className="font-semibold">
                    {doc.title} — <span className="text-text-muted">{doc.version}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    Updated {doc.updatedAt} by {doc.updatedBy} · seen by {doc.seenBy}/{doc.total} staff
                    {!doc.isNew && " ✓"}
                  </p>
                </div>
              </div>
              {doc.isNew ? (
                <button className="shrink-0 rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-navy/90 dark:bg-primary">
                  Mark seen
                </button>
              ) : (
                <button className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted">
                  Open
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Announcements */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="size-4 text-text-muted" />
            <h2 className="font-bold text-brand-navy dark:text-text">Announcements</h2>
          </div>
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Bell className="size-3" />
            {ANNOUNCEMENTS.filter((a) => !a.acknowledged).length} unread
          </span>
        </div>
        <div className="divide-y divide-border">
          {ANNOUNCEMENTS.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-semibold">{a.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {a.author} · {a.date} · {a.detail}
                </p>
              </div>
              {a.acknowledged ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="size-3" /> Seen ✓
                </span>
              ) : (
                <button className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90">
                  Acknowledge
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-4 text-center text-xs text-text-muted">
        Announcements management is coming in the next release. Admin can pin documents and broadcast notices from here.
      </p>
    </>
  );
}
