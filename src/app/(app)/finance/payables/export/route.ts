import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getMenuPermission } from "@/server/rbac/guard";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { filterPayees, listPayees, PAYEE_STATUS_LABEL, type PayeeStatus } from "@/modules/finance/payables";

const TYPES = { suppliers: "SUPPLIER", vendors: "VENDOR" } as const;
const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
const rupees = (paise: number) => (paise / 100).toFixed(2);

/** The Payables list as a CSV, with the same tab / status / search the page was showing. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !(await getMenuPermission(user, FINANCE_PATHS.payables)).canView) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url).searchParams;
  const status = url.get("status") ?? "";
  const { payees } = await listPayees();
  const rows = filterPayees(payees, {
    type: TYPES[(url.get("tab") ?? "") as keyof typeof TYPES],
    status: status in PAYEE_STATUS_LABEL ? (status as PayeeStatus) : undefined,
    q: (url.get("q") ?? "").trim(),
    sort: "name",
    dir: "asc",
  });
  const lines = [
    ["Name", "Type", "Total bills (INR)", "Paid (INR)", "Outstanding (INR)", "Last bill date", "Status"].map(cell).join(","),
    ...rows.map((p) =>
      [p.name, p.type === "SUPPLIER" ? "Supplier" : "Vendor", rupees(p.totalPaise), rupees(p.paidPaise), rupees(p.duePaise), p.lastDate ? p.lastDate.toISOString().slice(0, 10) : "", PAYEE_STATUS_LABEL[p.status]]
        .map(cell)
        .join(","),
    ),
  ];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="payables-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
