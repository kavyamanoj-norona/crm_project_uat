import Link from "next/link";
import { Building2, Network, Store, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { ADMIN_PATHS } from "../paths";

const TABS = [
  { key: "companies", label: "Company", href: ADMIN_PATHS.companies, Icon: Building2 },
  { key: "branches", label: "Branches", href: ADMIN_PATHS.branches, Icon: Store },
  { key: "domains", label: "Domains", href: ADMIN_PATHS.domains, Icon: Network },
  { key: "departments", label: "Departments", href: ADMIN_PATHS.departments, Icon: UsersRound },
] as const;

export type CompanyTab = (typeof TABS)[number]["key"];

/** Company structure lives under one menu item: company → branches, domains → departments. */
export function CompanyTabs({ active }: { active: CompanyTab }) {
  return (
    <nav aria-label="Company sections" className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map(({ key, label, href, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors",
            key === active
              ? "border-primary font-medium text-primary"
              : "border-transparent text-text-muted hover:text-text",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
