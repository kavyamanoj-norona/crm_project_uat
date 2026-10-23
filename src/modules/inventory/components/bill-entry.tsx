"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { PhotoInput } from "@/components/forms/photo-input";
import { DataTable } from "@/components/data/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SearchSelect } from "@/components/forms/search-select";
import {
  NEW_ITEM_TYPES,
  NEW_ITEM_TYPE_LABELS,
  billTotals,
  discountFromPercent,
  lineAmounts,
  parseBill,
  parseRupees,
  todayIst,
  type BillFormValues,
  type ScannedBill,
} from "../billing-schema";

type CatalogItem = { id: string; code: string; name: string; gstPercent: number; hsnSac: string | null };
type SupplierOption = {
  id: string;
  name: string;
  gstin: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};
/** Select value that switches a dropdown to "create a new one". */
const NEW = "__new__";

type ScanResult = {
  ok: boolean;
  message?: string;
  bill?: ScannedBill;
  imageUrl?: string;
  imageHash?: string;
  duplicate?: { id: string; code: string; billNo: string; supplier: string };
};

type BillEntryProps = {
  scanAction: (formData: FormData) => Promise<ScanResult>;
  confirmAction: (prev: FormState, formData: FormData) => Promise<FormState>;
  catalog: CatalogItem[];
  suppliers: SupplierOption[];
  /** The USID the first unit on this bill will get; the rest follow in order. */
  nextUsid: string;
  /** GST % choices from Inventory → Configuration. */
  gstRates: number[];
  /** Reusable warranty periods (Inventory → Manage Warranty). */
  warranties: { id: string; name: string }[];
  /** Active item categories (Inventory → Categories), for items created on the bill. */
  categories: { id: string; name: string }[];
};

type Notice = { tone: "info" | "error"; text: string; duplicate?: ScanResult["duplicate"] };

const blankLine = (): BillFormValues["lines"][number] => ({ itemId: "", newItem: false, newName: "", newType: "PART", newCategoryId: "", description: "", hsnSac: "", warrantyId: "", quantity: "1", rate: "", discountPct: "", discountAmt: "", gstPercent: "18" });

/** Paise as a plain rupee string for an input: 25000 → "250", 25050 → "250.5". */
const paiseToText = (p: number) => String(Number((p / 100).toFixed(2)));
/** Gross (quantity × price) of a form line, in paise. */
const lineGross = (l: { quantity: string; rate: string }) => (/^\d+$/.test(l.quantity) ? Number(l.quantity) : 0) * (parseRupees(l.rate) ?? 0);

const blankValues = (): BillFormValues => ({
  supplierMode: "existing",
  supplierId: "",
  supplierName: "",
  supplierGstin: "",
  supplierState: "",
  supplierPhone: "",
  supplierEmail: "",
  supplierAddress: "",
  billNo: "",
  billDate: "",
  lines: [blankLine()],
  roundOff: "",
  notes: "",
  isOfficeUse: false,
  officePurpose: "",
  paymentAmount: "",
  paymentMode: "",
  paymentRef: "",
  imageUrl: "",
  imageHash: "",
});

/** One page: fill in the bill (or upload/capture the image and let it be read), review, confirm. */
export function BillEntry({ scanAction, confirmAction, catalog, suppliers, nextUsid, gstRates, warranties, categories }: BillEntryProps) {
  const [v, setV] = useState<BillFormValues>(blankValues);
  const [printedTotal, setPrintedTotal] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [scanning, setScanning] = useState(false);
  const [imageKey, setImageKey] = useState(0); // remounts the image picker on Reset
  const [clientErrors, setClientErrors] = useState<Record<string, string[]> | null>(null);
  const [state, formAction, pending] = useActionState(confirmAction, initialFormState);
  const scanId = useRef(0);

  const errors: Record<string, string[] | undefined> = clientErrors ?? state.fieldErrors ?? {};
  const err = (key: string) => errors[key]?.[0];
  const lineErr = (i: number, f: string) => err(`lines.${i}.${f}`);

  const set = <K extends keyof BillFormValues>(k: K, val: BillFormValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    if (clientErrors) setClientErrors(null);
  };
  const setLine = (i: number, patch: Partial<BillFormValues["lines"][number]>) =>
    setV((p) => ({
      ...p,
      lines: p.lines.map((l, j) => {
        if (j !== i) return l;
        let next = { ...l, ...patch };
        // Discount: typing the percent fills the amount and typing the amount fills the percent.
        // If price or quantity changes, the figure the user typed last (the percent, if any) is kept.
        const gross = lineGross(next);
        if (patch.discountPct !== undefined) {
          const pct = Number(patch.discountPct);
          next = { ...next, discountAmt: patch.discountPct.trim() === "" || !Number.isFinite(pct) || pct < 0 ? "" : paiseToText(discountFromPercent(gross, pct)) };
        } else if (patch.discountAmt !== undefined) {
          const amt = parseRupees(patch.discountAmt);
          next = { ...next, discountPct: amt === null || amt === 0 || gross === 0 ? "" : String(Number(((amt / gross) * 100).toFixed(2))) };
        } else if (patch.rate !== undefined || patch.quantity !== undefined) {
          if (next.discountPct.trim() !== "" && Number.isFinite(Number(next.discountPct))) {
            next = { ...next, discountAmt: paiseToText(discountFromPercent(gross, Number(next.discountPct))) };
          } else if (next.discountAmt.trim() !== "") {
            const amt = parseRupees(next.discountAmt);
            next = { ...next, discountPct: amt === null || amt === 0 || gross === 0 ? "" : String(Number(((amt / gross) * 100).toFixed(2))) };
          }
        }
        return next;
      }),
    }));
  /** The image picker reports its files; a new image is scanned and fills the form. */
  const onImage = (files: File[]) => {
    const id = ++scanId.current;
    if (files.length === 0) {
      setScanning(false);
      setNotice(null);
      setPrintedTotal(null);
      setV((p) => (p.imageUrl || p.imageHash ? { ...p, imageUrl: "", imageHash: "" } : p));
      return;
    }
    const fd = new FormData();
    fd.set("bill", files[0]!);
    setScanning(true);
    setNotice(null);
    scanAction(fd)
      .then((res) => {
        if (id !== scanId.current) return; // a newer image replaced this one
        setScanning(false);
        if (!res.ok) {
          setNotice({ tone: "error", text: res.message ?? "Couldn't scan this image.", duplicate: res.duplicate });
          setV((p) => ({ ...p, imageUrl: "", imageHash: "" }));
          return;
        }
        const b = res.bill;
        setNotice(res.message ? { tone: "info", text: res.message } : null);
        setPrintedTotal(b?.total ? parseRupees(b.total) : null);
        setClientErrors(null);
        // A scanned supplier that already exists is selected; otherwise it fills the "new supplier" form.
        const known = b
          ? suppliers.find(
              (x) =>
                (b.supplierGstin && x.gstin?.toUpperCase() === b.supplierGstin.toUpperCase()) ||
                (b.supplierName && x.name.toLowerCase() === b.supplierName.toLowerCase()),
            )
          : undefined;
        setV((p) => ({
          ...p,
          imageUrl: res.imageUrl ?? "",
          imageHash: res.imageHash ?? "",
          ...(b
            ? {
                supplierMode: known || !b.supplierName ? ("existing" as const) : ("new" as const),
                supplierId: known?.id ?? "",
                supplierName: known ? "" : b.supplierName,
                supplierGstin: known ? "" : b.supplierGstin,
                supplierState: known ? "" : b.supplierState,
                supplierPhone: known ? "" : b.supplierPhone,
                supplierEmail: known ? "" : b.supplierEmail,
                supplierAddress: known ? "" : b.supplierAddress,
                billNo: b.billNo,
                billDate: b.billDate,
                roundOff: b.roundOff,
                lines: b.lines.length
                  ? b.lines.map((l) => ({ ...blankLine(), ...l, gstPercent: l.gstPercent || "18" }))
                  : [blankLine()],
              }
            : {}),
        }));
      })
      .catch(() => {
        if (id !== scanId.current) return;
        setScanning(false);
        setNotice({ tone: "error", text: "Couldn't scan this image. Fill in the details below, or try again." });
      });
  };

  const reset = () => {
    scanId.current++;
    setV(blankValues());
    setNotice(null);
    setPrintedTotal(null);
    setScanning(false);
    setClientErrors(null);
    setImageKey((k) => k + 1);
  };

  const totals = useMemo(() => {
    const amounts = v.lines.map((l) => {
      const q = /^\d+$/.test(l.quantity) ? Number(l.quantity) : 0;
      const r = parseRupees(l.rate) ?? 0;
      const g = /^\d+$/.test(l.gstPercent) ? Number(l.gstPercent) : 0;
      return lineAmounts(q, r, g, parseRupees(l.discountAmt) ?? 0);
    });
    return { amounts, discountPaise: amounts.reduce((n, a) => n + a.discountPaise, 0), ...billTotals(amounts, parseRupees(v.roundOff, true) ?? 0) };
  }, [v.lines, v.roundOff]);

  const pickedSupplier = v.supplierMode === "existing" ? suppliers.find((x) => x.id === v.supplierId) : undefined;
  const supplierSelect = v.supplierMode === "new" ? NEW : v.supplierId;
  const chooseSupplier = (value: string) => {
    setV((p) => (value === NEW ? { ...p, supplierMode: "new", supplierId: "" } : { ...p, supplierMode: "existing", supplierId: value }));
    if (clientErrors) setClientErrors(null);
  };
  const cgst = Math.floor(totals.taxPaise / 2);
  const sgst = totals.taxPaise - cgst;

  const mismatch = printedTotal !== null && printedTotal > 0 && Math.abs(printedTotal - totals.totalPaise) > 100;

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const { errors: parsed } = parseBill(v);
    const found: Record<string, string[]> = { ...parsed };
    if (Object.keys(found).length > 0) {
      e.preventDefault();
      setClientErrors(found);
    }
  };

  const gstOptions = (cur: string) =>
    [...new Set([...gstRates.map(String), ...(cur ? [cur] : [])])].map((g) => ({ value: g, label: `${g}%` }));

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      // Enter in a field must not save a money form by accident.
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
      noValidate
      className="space-y-6"
    >
      <input type="hidden" name="payload" value={JSON.stringify(v)} />

      {(state.message || clientErrors) && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{clientErrors ? "Please fix the highlighted fields." : state.message}</span>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Supplier">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Supplier" htmlFor="supplierId" required error={err("supplierId")}>
                <SearchSelect
                  id="supplierId"
                  value={supplierSelect}
                  onChange={chooseSupplier}
                  pinned={[{ value: NEW, label: "+ Add new supplier" }]}
                  options={suppliers.map((x) => ({ value: x.id, label: x.gstin ? `${x.name} — ${x.gstin}` : x.name }))}
                  placeholder="Select supplier"
                  invalid={Boolean(err("supplierId"))}
                />
              </Field>
            </div>

            {pickedSupplier && (
              <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-lg bg-primary-soft p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["GSTIN", pickedSupplier.gstin],
                    ["State", pickedSupplier.state],
                    ["Phone", pickedSupplier.phone],
                    ["Email", pickedSupplier.email],
                    ["Address", pickedSupplier.address],
                  ] as const
                ).map(([k, val]) => (
                  <div key={k} className={k === "Address" ? "sm:col-span-2 lg:col-span-3" : undefined}>
                    <dt className="text-xs font-bold text-text-muted">{k}</dt>
                    <dd className="break-words">{val || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}

            {v.supplierMode === "new" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Supplier name" htmlFor="supplierName" required error={err("supplierName")}>
                  <Input id="supplierName" value={v.supplierName} onChange={(e) => set("supplierName", e.target.value)} placeholder="Enter supplier name" aria-invalid={err("supplierName") ? true : undefined} />
                </Field>
                <Field label="GSTIN" htmlFor="supplierGstin" error={err("supplierGstin")}>
                  <Input id="supplierGstin" value={v.supplierGstin} onChange={(e) => set("supplierGstin", e.target.value)} placeholder="Enter GSTIN" aria-invalid={err("supplierGstin") ? true : undefined} />
                </Field>
                <Field label="State" htmlFor="supplierState" error={err("supplierState")}>
                  <Input id="supplierState" value={v.supplierState} onChange={(e) => set("supplierState", e.target.value)} placeholder="Enter state" />
                </Field>
                <Field label="Phone" htmlFor="supplierPhone" error={err("supplierPhone")}>
                  <Input id="supplierPhone" value={v.supplierPhone} onChange={(e) => set("supplierPhone", e.target.value)} placeholder="Enter phone number" />
                </Field>
                <Field label="Email" htmlFor="supplierEmail" error={err("supplierEmail")}>
                  <Input id="supplierEmail" type="email" value={v.supplierEmail} onChange={(e) => set("supplierEmail", e.target.value)} placeholder="Enter email" aria-invalid={err("supplierEmail") ? true : undefined} />
                </Field>
                <Field label="Address" htmlFor="supplierAddress" error={err("supplierAddress")} className="sm:col-span-2 lg:col-span-3">
                  <Textarea id="supplierAddress" rows={3} value={v.supplierAddress} onChange={(e) => set("supplierAddress", e.target.value)} placeholder="Enter supplier address" />
                </Field>
                <p className="text-xs text-text-muted sm:col-span-2 lg:col-span-3">This supplier is saved when the bill is confirmed.</p>
              </div>
            )}
          </Card>

          <Card title="Bill Information">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Bill number" htmlFor="billNo" required error={err("billNo")}>
                <Input id="billNo" value={v.billNo} onChange={(e) => set("billNo", e.target.value)} placeholder="Enter bill number" aria-invalid={err("billNo") ? true : undefined} />
              </Field>
              <Field label="Bill date" htmlFor="billDate" required error={err("billDate")}>
                <Input id="billDate" type="date" max={todayIst()} value={v.billDate} onChange={(e) => set("billDate", e.target.value)} aria-invalid={err("billDate") ? true : undefined} />
              </Field>
            </div>
            <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={v.isOfficeUse} onChange={(e) => set("isOfficeUse", e.target.checked)} />
                <span>
                  <span className="font-semibold">Office use</span>
                  <span className="block text-xs text-text-muted">Bought for the office, not for service stock. Units get USIDs and show in Stock, but are never used on cases or sent to branches.</span>
                </span>
              </label>
              {v.isOfficeUse && (
                <Field label="Purpose" htmlFor="officePurpose" required error={err("officePurpose")}>
                  <Input id="officePurpose" value={v.officePurpose} onChange={(e) => set("officePurpose", e.target.value)} placeholder="Enter purpose" aria-invalid={err("officePurpose") ? true : undefined} />
                </Field>
              )}
            </div>
          </Card>

          <Card
            title="Items"
            actions={
              <Button variant="secondary" onClick={() => set("lines", [...v.lines, blankLine()])}>
                <Plus className="size-4" /> Add item
              </Button>
            }
          >
            <DataTable
              rows={v.lines.map((line, i) => ({ line, i }))}
              rowKey={(r) => String(r.i)}
              empty="No items yet."
              expand={({ line, i }) => {
                const newItemPanel = line.newItem ? (
                  <div className="rounded-lg border border-primary/30 bg-surface p-3">
                    <p className="mb-3 text-sm font-bold text-brand-navy dark:text-text">New item — added to the catalog when the bill is saved</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Item name" htmlFor={`new-name-${i}`} required error={lineErr(i, "newName")} className="lg:col-span-2">
                        <Input
                          id={`new-name-${i}`}
                          value={line.newName}
                          onChange={(e) => setLine(i, { newName: e.target.value })}
                          placeholder="Enter item name"
                          aria-invalid={lineErr(i, "newName") ? true : undefined}
                        />
                      </Field>
                      <Field label="Item type" htmlFor={`new-type-${i}`} required>
                        <Select
                          id={`new-type-${i}`}
                          value={line.newType}
                          onChange={(e) => setLine(i, { newType: e.target.value as (typeof NEW_ITEM_TYPES)[number] })}
                          options={NEW_ITEM_TYPES.map((t) => ({ value: t, label: NEW_ITEM_TYPE_LABELS[t] }))}
                          placeholder="Select item type"
                        />
                      </Field>
                      <Field label="Category" htmlFor={`new-category-${i}`} required error={lineErr(i, "newCategoryId")}>
                        <Select
                          id={`new-category-${i}`}
                          value={line.newCategoryId}
                          onChange={(e) => setLine(i, { newCategoryId: e.target.value })}
                          options={categories.map((c) => ({ value: c.id, label: c.name }))}
                          placeholder="Select category"
                          aria-invalid={lineErr(i, "newCategoryId") ? true : undefined}
                        />
                      </Field>
                    </div>
                    <p className="mt-2 text-xs text-text-muted">HSN/SAC and GST come from this line. Set the selling price later in the item catalog.</p>
                  </div>
                ) : null;
                return newItemPanel;
              }}
              columns={[
                { header: "#", cell: (r) => r.i + 1 },
                {
                  header: "Item",
                  required: true,
                  cell: ({ line, i }) => (
                    <div className="w-60">
                      <SearchSelect
                        aria-label={`Catalog item for line ${i + 1}`}
                        value={line.newItem ? NEW : line.itemId}
                        onChange={(picked) => {
                          if (picked === NEW) {
                            setLine(i, { itemId: "", newItem: true, newName: line.newName || line.description });
                            return;
                          }
                          const item = catalog.find((c) => c.id === picked);
                          setLine(i, {
                            itemId: picked,
                            newItem: false,
                            ...(item ? { gstPercent: String(item.gstPercent), hsnSac: line.hsnSac || item.hsnSac || "" } : {}),
                          });
                        }}
                        pinned={[{ value: NEW, label: "+ Add new item" }]}
                        options={catalog.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                        placeholder="Select item"
                        invalid={Boolean(lineErr(i, "itemId") || lineErr(i, "newName"))}
                      />
                      {lineErr(i, "itemId") && <p className="mt-1 text-xs text-danger">{lineErr(i, "itemId")}</p>}
                      {line.newItem && <p className="mt-1 text-xs text-primary">New item — fill in the details below</p>}
                    </div>
                  ),
                },
                {
                  header: "Warranty",
                  cell: ({ line, i }) => (
                    <Select
                      className="w-32"
                      aria-label={`Warranty for line ${i + 1}`}
                      value={line.warrantyId}
                      onChange={(e) => setLine(i, { warrantyId: e.target.value })}
                      options={warranties.map((w) => ({ value: w.id, label: w.name }))}
                      placeholder="No warranty"
                    />
                  ),
                },
                {
                  header: "HSN/SAC",
                  cell: ({ line, i }) => (
                    <Input className="w-24" aria-label={`HSN for line ${i + 1}`} value={line.hsnSac} onChange={(e) => setLine(i, { hsnSac: e.target.value })} placeholder="Enter HSN" />
                  ),
                },
                {
                  header: "Price (₹)",
                  required: true,
                  cell: ({ line, i }) => (
                    <div>
                      <Input className="w-28 text-right" inputMode="decimal" aria-label={`Price for line ${i + 1}`} value={line.rate} onChange={(e) => setLine(i, { rate: e.target.value })} placeholder="Enter price" aria-invalid={lineErr(i, "rate") ? true : undefined} />
                      {lineErr(i, "rate") && <p className="mt-1 text-xs text-danger">{lineErr(i, "rate")}</p>}
                    </div>
                  ),
                },
                {
                  header: "Qty",
                  required: true,
                  cell: ({ line, i }) => (
                    <div>
                      <Input className="w-20 text-right" inputMode="numeric" aria-label={`Quantity for line ${i + 1}`} value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="Enter qty" aria-invalid={lineErr(i, "quantity") ? true : undefined} />
                      {lineErr(i, "quantity") && <p className="mt-1 text-xs text-danger">{lineErr(i, "quantity")}</p>}
                    </div>
                  ),
                },
                {
                  header: "Total (₹)",
                  align: "right",
                  cell: ({ i }) => <span className="tabular-nums">{formatPaise(totals.amounts[i]?.grossPaise ?? 0, { symbol: false })}</span>,
                },
                {
                  header: "Disc. %",
                  cell: ({ line, i }) => (
                    <Input className="w-20 text-right" inputMode="decimal" aria-label={`Discount percent for line ${i + 1}`} value={line.discountPct} onChange={(e) => setLine(i, { discountPct: e.target.value })} placeholder="Enter %" />
                  ),
                },
                {
                  header: "Disc. Amt (₹)",
                  cell: ({ line, i }) => (
                    <div>
                      <Input className="w-24 text-right" inputMode="decimal" aria-label="Disc. Amt (₹) for line ${i + 1}" value={line.discountAmt} onChange={(e) => setLine(i, { discountAmt: e.target.value })} placeholder="Enter amount" aria-invalid={lineErr(i, "discountAmt") ? true : undefined} />
                      {lineErr(i, "discountAmt") && <p className="mt-1 text-xs text-danger">{lineErr(i, "discountAmt")}</p>}
                    </div>
                  ),
                },
                {
                  header: "GST %",
                  required: true,
                  cell: ({ line, i }) => (
                    <Select className="w-24" aria-label={`GST for line ${i + 1}`} value={line.gstPercent} onChange={(e) => setLine(i, { gstPercent: e.target.value })} options={gstOptions(line.gstPercent)} placeholder="Select GST" />
                  ),
                },
                {
                  header: "GST Amt (₹)",
                  align: "right",
                  cell: ({ i }) => <span className="tabular-nums">{formatPaise(totals.amounts[i]?.taxPaise ?? 0, { symbol: false })}</span>,
                },
                {
                  header: "Net (₹)",
                  align: "right",
                  cell: ({ i }) => <span className="font-semibold tabular-nums">{formatPaise(totals.amounts[i]?.lineTotalPaise ?? 0, { symbol: false })}</span>,
                },
                {
                  header: "Action",
                  align: "center",
                  cell: ({ i }) => (
                    <button
                      type="button"
                      aria-label={`Remove line ${i + 1}`}
                      disabled={v.lines.length === 1}
                      onClick={() => set("lines", v.lines.filter((_, j) => j !== i))}
                      className="mx-auto flex size-9 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-40"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ),
                },
              ]}
            />
            {err("lines") && <p className="mt-2 text-xs text-danger">{err("lines")}</p>}

            <p className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-xs text-text-muted">
              USIDs are generated automatically when the bill is saved, in order, one per unit. The next one is{" "}
              <span className="font-semibold tabular-nums text-text">{nextUsid}</span>.
            </p>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Bill (image or PDF)">
            <PhotoInput
              key={imageKey}
              name="bill"
              max={1}
              maxEdge={2400}
              allowUpload
              accept="image/*,application/pdf"
              dropzone={{ title: "Upload bill image or PDF" }}
              onChange={onImage}
            />
            {scanning && (
              <p className="mt-3 flex items-center gap-2 text-sm text-text-muted" role="status">
                <Loader2 className="size-4 animate-spin" /> Reading the bill…
              </p>
            )}
            {notice && (
              <div
                className={
                  notice.tone === "error"
                    ? "mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
                    : "mt-3 flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-sm"
                }
                role={notice.tone === "error" ? "alert" : "status"}
              >
                {notice.tone === "error" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Sparkles className="mt-0.5 size-4 shrink-0 text-info" />}
                <span>
                  {notice.text}{" "}
                  {notice.duplicate && (
                    <Link href={`/inventory/billing/${notice.duplicate.id}`} className="font-medium underline">
                      View {notice.duplicate.code}
                    </Link>
                  )}
                </span>
              </div>
            )}
          </Card>

          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              {totals.discountPaise > 0 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Discount</dt>
                  <dd className="tabular-nums">− {formatPaise(totals.discountPaise)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{totals.discountPaise > 0 ? "Subtotal (after discount)" : "Subtotal"}</dt>
                <dd className="tabular-nums">{formatPaise(totals.subtotalPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">CGST</dt>
                <dd className="tabular-nums">{formatPaise(cgst)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">SGST</dt>
                <dd className="tabular-nums">{formatPaise(sgst)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-muted">Round off (₹)</dt>
                <dd>
                  <Input className="w-28 text-right" inputMode="decimal" aria-label="Round off" value={v.roundOff} onChange={(e) => set("roundOff", e.target.value)} placeholder="Enter amount" aria-invalid={err("roundOff") ? true : undefined} />
                </dd>
              </div>
              {err("roundOff") && <p className="text-right text-xs text-danger">{err("roundOff")}</p>}
              <div className="-mx-2 flex justify-between gap-3 rounded-lg bg-primary-soft px-3 py-2.5 text-base font-bold text-brand-navy dark:text-text">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPaise(totals.totalPaise)}</dd>
              </div>
            </dl>
            {mismatch && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                The bill shows a total of {formatPaise(printedTotal)} but these items add up to {formatPaise(totals.totalPaise)}. Check quantities, rates and GST.
              </p>
            )}
          </Card>

          <Card title="Notes">
            <Textarea aria-label="Notes" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Enter notes" />
          </Card>
        </div>
      </div>

      {/* Always visible while the form scrolls, so saving never needs a scroll to the bottom. */}
      <div className="sticky bottom-0 z-20 -mx-3 -mb-3 mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:-mx-4 sm:-mb-4 sm:px-4 md:-mx-6 md:-mb-6 md:px-6 2xl:-mx-8 2xl:-mb-8 2xl:px-8">
        <Button variant="secondary" onClick={reset} disabled={pending}>
          <RotateCcw className="size-4" /> Reset
        </Button>
        <Button type="submit" disabled={pending || scanning}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Confirm &amp; save bill
        </Button>
      </div>
    </form>
  );
}
