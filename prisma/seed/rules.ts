// Default business rules (Master Settings → Rules). Created once; values
// edited in the UI are never overwritten by a re-seed.
export const DEFAULT_RULES = [
  { code: "DISCOUNT_CAP_PERCENT", name: "Discount cap before approval", category: "Pricing", valueType: "PERCENT", value: "10", description: "Discounts above this need Branch Manager approval" },
  { code: "MEMBER_DISCOUNT_PERCENT", name: "Member auto-discount", category: "Pricing", valueType: "PERCENT", value: "5", description: "Applied automatically for active members" },
  { code: "ALLOW_BELOW_MSP", name: "Allow billing below MSP with approval", category: "Pricing", valueType: "BOOLEAN", value: "true", description: "When off, below-MSP billing is refused outright" },
  { code: "DEFAULT_GST_PERCENT", name: "Default GST rate", category: "Tax", valueType: "PERCENT", value: "18", description: "Used when an item has no GST rate of its own" },
  { code: "GST_INCLUSIVE_PRICING", name: "Prices include GST", category: "Tax", valueType: "BOOLEAN", value: "true", description: "Inclusive (true) or exclusive (false) price entry" },
  { code: "TAT_DIAGNOSIS_HOURS", name: "Diagnosis", category: "Service TAT", valueType: "HOURS", value: "24", description: "Intake to diagnosis complete" },
  { code: "TAT_APPROVAL_FOLLOWUP_HOURS", name: "Quote approval follow-up", category: "Service TAT", valueType: "HOURS", value: "12", description: "Remind the customer when a quote is pending this long" },
  { code: "TAT_REPAIR_HOURS", name: "Repair", category: "Service TAT", valueType: "HOURS", value: "72", description: "Approval to repair complete" },
  { code: "TAT_CHIP_LEVEL_HOURS", name: "Chip-level repair", category: "Service TAT", valueType: "HOURS", value: "120", description: "Lab inbound to lab outbound" },
  { code: "UNCOLLECTED_AFTER_DAYS", name: "Uncollected device after", category: "Service TAT", valueType: "NUMBER", value: "15", description: "Days after 'ready' before a device counts as uncollected" },
  { code: "LOGIN_MAX_ATTEMPTS", name: "Failed sign-ins before lockout", category: "Security", valueType: "NUMBER", value: "5", description: "0 turns automatic lockout off" },
  { code: "LOGIN_LOCK_MINUTES", name: "Lockout duration", category: "Security", valueType: "MINUTES", value: "15", description: "How long an account stays locked" },
  { code: "SESSION_HOURS", name: "Session length", category: "Security", valueType: "HOURS", value: "12", description: "Without 'Remember me'" },
] as const;
