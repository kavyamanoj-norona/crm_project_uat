import "server-only";
import type { CurrentUser } from "@/server/auth/session";

export type ApprovalKind = "MANUAL_APPROVAL" | "LAB_QUOTE";

/**
 * What a user works on in the Approval Inbox: the Purchase Manager reviews manual customer approvals from branches,
 * branch staff handle the chip-level lab's quotes for their branch, and admins see both.
 */
export function approvalKinds(user: CurrentUser): ApprovalKind[] {
  if (user.privilege.isSuperAdmin) return ["MANUAL_APPROVAL", "LAB_QUOTE"];
  if (user.privilege.code === "PURCHASE_MANAGER") return ["MANUAL_APPROVAL"];
  return ["LAB_QUOTE"];
}
