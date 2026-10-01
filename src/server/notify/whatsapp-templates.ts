import { formatPaise } from "@/lib/money";

/** A parameter in a Meta template component. */
export type MetaTextParam = { type: "text"; text: string };
export type MetaComponent = {
  type: "header" | "body" | "button";
  sub_type?: string;
  index?: number;
  parameters: MetaTextParam[];
};

/** Data available when building a WhatsApp message from a service case. */
export type CaseMsgData = {
  customerName: string;
  jobsheetNo: string;
  device: string;
  estimatePaise: number | null;
  stageLabel: string;
  branchName: string;
};

export type WaTemplate = {
  /** Exact name as registered in Meta WABA — must match character for character. */
  name: string;
  language: string;
  /** Human-readable label shown in the UI dropdown. */
  label: string;
  buildComponents: (data: CaseMsgData) => MetaComponent[];
};

/**
 * Pre-approved Meta WhatsApp Business template catalog.
 *
 * Each entry must have a matching approved template in Meta Business Manager.
 * Template variable order in `buildComponents` must match the approved template body.
 */
export const WA_TEMPLATES: WaTemplate[] = [
  {
    name: "quote_ready",
    language: "en",
    label: "Quotation ready for approval",
    buildComponents: ({ customerName, device, estimatePaise, jobsheetNo, branchName }) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: customerName },
          { type: "text", text: device },
          { type: "text", text: estimatePaise !== null ? formatPaise(estimatePaise) : "—" },
          { type: "text", text: jobsheetNo },
          { type: "text", text: branchName },
        ],
      },
    ],
  },
  {
    name: "repair_complete",
    language: "en",
    label: "Repair completed — ready for pickup",
    buildComponents: ({ customerName, device, jobsheetNo }) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: customerName },
          { type: "text", text: device },
          { type: "text", text: jobsheetNo },
        ],
      },
    ],
  },
  {
    name: "pickup_reminder",
    language: "en",
    label: "Pickup reminder",
    buildComponents: ({ customerName, jobsheetNo, device }) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: customerName },
          { type: "text", text: jobsheetNo },
          { type: "text", text: device },
        ],
      },
    ],
  },
  {
    name: "general_status_update",
    language: "en",
    label: "General status update",
    buildComponents: ({ customerName, jobsheetNo, stageLabel }) => [
      {
        type: "body",
        parameters: [
          { type: "text", text: customerName },
          { type: "text", text: jobsheetNo },
          { type: "text", text: stageLabel },
        ],
      },
    ],
  },
];

/** Quick lookup: template name → WaTemplate (or undefined). */
export const WA_TEMPLATE_MAP = new Map(WA_TEMPLATES.map((t) => [t.name, t]));
