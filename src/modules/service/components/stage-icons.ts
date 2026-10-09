import { AlertTriangle, Ban, ClipboardCheck, ClipboardList, Cpu, Flag, FlaskConical, Hourglass, Inbox, Package, PackageCheck, Settings, Truck, Wrench, type LucideIcon } from "lucide-react";
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
  // Chip-level lab track
  CHIP_TRANSFER: FlaskConical,
  CHIP_LAB_RECEIVED: Inbox,
  CHIP_LAB_DIAGNOSIS: Cpu,
  CHIP_LAB_PENDING_APPROVAL: Hourglass,
  CHIP_LAB_SERVICING: Wrench,
  CHIP_LAB_READY_DISPATCH: PackageCheck,
  CHIP_LAB_QUALITY_CHECK: ClipboardCheck,
  CHIP_BRANCH_RECEIVED: Truck,
  NON_REPAIRABLE: AlertTriangle,
};
