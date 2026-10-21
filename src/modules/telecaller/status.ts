// Lead statuses, call outcomes and how an outcome moves a lead. Pure, so server and client share it.

export const LEAD_STATUSES = ["NEW", "CONTACTED", "HOT", "APPOINTMENT", "CONVERTED", "WALKED_IN", "BILLED", "LOST"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  HOT: "Hot",
  APPOINTMENT: "Appointment fixed",
  CONVERTED: "Converted",
  WALKED_IN: "Walked in",
  BILLED: "Billed",
  LOST: "Lost",
};

export const LEAD_STATUS_TONE: Record<LeadStatusValue, "neutral" | "primary" | "warning" | "danger" | "success" | "indigo" | "navy"> = {
  NEW: "neutral",
  CONTACTED: "primary",
  HOT: "danger",
  APPOINTMENT: "warning",
  CONVERTED: "indigo",
  WALKED_IN: "navy",
  BILLED: "success",
  LOST: "neutral",
};

/** A lead in these statuses needs no more calls. */
export const CLOSED_STATUSES: readonly LeadStatusValue[] = ["BILLED", "LOST"];
/** Converted or beyond: counted as a conversion. */
export const CONVERTED_STATUSES: readonly LeadStatusValue[] = ["CONVERTED", "WALKED_IN", "BILLED"];

export const CALL_OUTCOMES = ["INTERESTED", "NOT_INTERESTED", "CALL_BACK", "NO_ANSWER", "SWITCHED_OFF", "WRONG_NUMBER", "APPOINTMENT_FIXED", "OTHER"] as const;
export type CallOutcomeValue = (typeof CALL_OUTCOMES)[number];

export const CALL_OUTCOME_LABELS: Record<CallOutcomeValue, string> = {
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested",
  CALL_BACK: "Call back later",
  NO_ANSWER: "No answer",
  SWITCHED_OFF: "Switched off",
  WRONG_NUMBER: "Wrong number",
  APPOINTMENT_FIXED: "Appointment fixed",
  OTHER: "Other",
};

/** Outcomes that mean the lead is dead unless a follow-up is set. */
export const NEEDS_NO_FOLLOW_UP: readonly CallOutcomeValue[] = ["NOT_INTERESTED", "WRONG_NUMBER"];

/** The status a call moves a lead to (null = leave as is). Never reopens a closed or converted lead. */
export function statusAfterCall(current: LeadStatusValue, outcome: CallOutcomeValue): LeadStatusValue | null {
  if (CLOSED_STATUSES.includes(current) || CONVERTED_STATUSES.includes(current)) return null;
  switch (outcome) {
    case "INTERESTED":
      return "HOT";
    case "APPOINTMENT_FIXED":
      return "APPOINTMENT";
    case "NOT_INTERESTED":
    case "WRONG_NUMBER":
      return "LOST";
    default:
      return current === "NEW" ? "CONTACTED" : null;
  }
}
