import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, ClipboardCheck, FileText, Mail, MapPin, Pencil, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PayeeWorkspace } from "@/modules/finance/components/payee-workspace";
import { paySelectedBills, recordSupplierPayment } from "@/modules/finance/actions";
import { uploadSupplierDocument } from "@/modules/finance/payables-actions";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { PAYMENT_TERM_DAYS, supplierWorkspace, vendorWorkspace } from "@/modules/finance/payables";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { getMenuPermission, requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Payables" };

function Fact({ icon, label, children, className }: { icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-start gap-3 ${className ?? ""}`}>
      <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted [&_svg]:size-[18px]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <div className="text-sm font-semibold break-words text-brand-navy dark:text-text">{children}</div>
      </div>
    </div>
  );
}

export default async function PayeePage({ params }: PageProps<"/finance/payables/[type]/[id]">) {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.payables);
  const { type, id } = await params;
  if (type !== "supplier" && type !== "vendor") notFound();
  const isSupplier = type === "supplier";

  const data = isSupplier ? await supplierWorkspace(id) : await vendorWorkspace(id);
  if (!data) notFound();
  const party = "supplier" in data ? data.supplier : data.vendor;

  // Details are edited where they are kept: the Suppliers page, or the Chip-Level Lab's Vendors page.
  const editPath = isSupplier ? INVENTORY_PATHS.suppliers : SERVICE_PATHS.vendors;
  const canEdit = (await getMenuPermission(user, editPath)).canEdit;
  const terms = "supplier" in data ? data.supplier.paymentTermDays : null;

  return (
    <>
      <div className="mb-4">
        <ol className="mb-2 flex flex-wrap items-center gap-1 text-xs text-text-muted">
          <li>Finance</li>
          <ChevronRight className="size-3" />
          <li>
            <Link href={FINANCE_PATHS.payables} className="hover:text-text hover:underline">
              Payables
            </Link>
          </li>
          <ChevronRight className="size-3" />
          <li className="font-medium text-text">{party.name}</li>
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={FINANCE_PATHS.payables}
              aria-label="Back to payables"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text hover:bg-surface-muted"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="min-w-0 text-xl font-black break-words text-brand-navy sm:text-2xl dark:text-text">{party.name}</h1>
            <Badge tone={isSupplier ? "primary" : "danger"}>{isSupplier ? "Supplier" : "Vendor"}</Badge>
            {"vendor" in data && <Badge tone={data.vendor.isActive ? "success" : "neutral"}>{data.vendor.isActive ? "Active" : "Inactive"}</Badge>}
          </div>
          {canEdit && (
            <Link
              href={`${editPath}?edit=${id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-text hover:bg-surface-muted"
            >
              <Pencil className="size-4" /> Edit details
            </Link>
          )}
        </div>
      </div>

      <section className="mb-6 grid gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:grid-cols-2 sm:p-5 xl:grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] xl:items-center">
        {"supplier" in data ? (
          <Fact icon={<FileText />} label="GSTIN">
            {data.supplier.gstin ?? "—"}
          </Fact>
        ) : (
          <Fact icon={<User />} label="Contact person">
            {data.vendor.contactName ?? "—"}
          </Fact>
        )}
        <Fact icon={<Phone />} label="Phone">
          {party.phone ?? "—"}
        </Fact>
        <Fact icon={<Mail />} label="Email">
          {party.email ? (
            <a href={`mailto:${party.email}`} className="text-primary hover:underline">
              {party.email}
            </a>
          ) : (
            "—"
          )}
        </Fact>
        <Fact icon={<MapPin />} label="Address" className="sm:col-span-2 xl:col-span-1">
          {party.address ?? "—"}
        </Fact>
      </section>

      <PayeeWorkspace
        kind={isSupplier ? "supplier" : "vendor"}
        bills={data.bills}
        payments={data.payments}
        ledger={"ledger" in data ? data.ledger : []}
        documents={"documents" in data ? data.documents : []}
        contact={{ phone: party.phone, email: party.email }}
        canPay={permission.canEdit && isSupplier}
        paySelected={isSupplier ? paySelectedBills : undefined}
        recordPayment={isSupplier ? recordSupplierPayment.bind(null, id) : undefined}
        uploadDocument={isSupplier ? uploadSupplierDocument.bind(null, id) : undefined}
        exportName={party.name.replace(/[^\w]+/g, "-").toLowerCase()}
      />
    </>
  );
}
