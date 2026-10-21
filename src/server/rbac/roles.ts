// Role codes the code itself has to know about (everything else is plain menu permissions).

/** Field staff who only raise on-site cases: New Case (Intake) and nothing else. */
export const ONSITE_PICKUP = "ONSITE_PICKUP";

export const isOnsitePickup = (user: { privilege: { code: string } }) => user.privilege.code === ONSITE_PICKUP;

/** Engineers diagnose and QC their own assigned cases; they never request stock (that is Front Desk / Branch Manager). */
export const ENGINEER = "SERVICE_ENGINEER";

export const isEngineer = (user: { privilege: { code: string } }) => user.privilege.code === ENGINEER;

/** Head Office telecallers: work their own assigned leads and see only their own incentives. */
export const TELECALLER = "TELECALLER";

export const isTelecaller = (user: { privilege: { code: string } }) => user.privilege.code === TELECALLER;
