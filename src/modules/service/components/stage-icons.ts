import { Ban, ClipboardList, Flag, Hourglass, Package, Settings, Truck, Wrench, type LucideIcon } from "lucide-react";
import type { CaseStatusValue } from "../case-schema";

/** One icon per case stage, used by the stage rail and the timeline. */
export const STAGE_ICONS: Record<CaseStatusValue, LucideIcon> = {
  INTAKE: ClipboardList,
  DIAGNOSIS: Wrench,
  PENDING_APPROVAL: Hourglass,
  AWAITING_STOCK: Package,
  QUALITY_CHECK: Settings,
  READY_FOR_DELIVERY: Truck,
  CLOSED: Flag,
  CANCELLED: Ban,
};
