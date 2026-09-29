import { PageHeader } from "@/components/layout/page-header";
import { FormMessage } from "@/components/forms/form-message";

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads a single string query param. */
export function param(sp: SearchParams, key: string) {
  const v = sp[key];
  return typeof v === "string" && v !== "" ? v : undefined;
}

type AdminPageProps = {
  title: string;
  subtitle?: string;
  group?: string;
  saved?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

/** Header + "Saved" flash shared by the Master Settings screens. */
export function AdminPage({ title, subtitle, group = "Master Settings", saved, actions, children }: AdminPageProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} breadcrumbs={[group, title]} actions={actions} />
      <div className="space-y-6">
        {saved && <FormMessage ok message="Saved successfully." />}
        {children}
      </div>
    </>
  );
}
