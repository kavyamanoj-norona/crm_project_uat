import { redirect } from "next/navigation";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";

// Leads moved to the Telecaller module; keep old links and bookmarks working.
export default async function LeadsMovedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  redirect(qs ? `${CUSTOMER_PATHS.leads}?${qs}` : CUSTOMER_PATHS.leads);
}
