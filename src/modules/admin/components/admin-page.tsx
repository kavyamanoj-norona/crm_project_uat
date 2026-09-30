import { PageHeader } from "@/components/layout/page-header";
import { CreatePanel } from "@/components/layout/create-panel";
import { FlashToast } from "@/components/feedback/flash-toast";

type SearchParams = Record<string, string | string[] | undefined>;

/** Reads a single string query param. */
export function param(sp: SearchParams, key: string) {
  const v = sp[key];
  return typeof v === "string" && v !== "" ? v : undefined;
}

export type AdminForm = {
  /** Button label, e.g. "Add User". */
  label: string;
  /** Record title when editing (panel opens and shows "Edit …"). */
  editingTitle?: string;
  /** List URL without ?edit, used by "Close edit". */
  cancelHref: string;
  content: React.ReactNode;
};

type AdminPageProps = {
  title: string;
  subtitle?: string;
  group?: string;
  /** `saved` query value; shows the flash and collapses the form after a save. */
  saved?: string;
  actions?: React.ReactNode;
  /** Section tabs shown under the header (e.g. Company · Branches). */
  nav?: React.ReactNode;
  /** Collapsible create/edit form; omit when the user can't create. */
  form?: AdminForm;
  children: React.ReactNode;
};

/** Header + collapsible form + "Saved" flash shared by the Master Settings screens. */
export function AdminPage({ title, subtitle, group = "Master Settings", saved, actions, nav, form, children }: AdminPageProps) {
  const header = <PageHeader title={title} subtitle={subtitle} breadcrumbs={[group, title]} actions={actions} />;

  return (
    <>
      <FlashToast flag={saved} message="Saved successfully." />
      {form ? (
        <CreatePanel
          // remount (and collapse) after each save or when switching records
          key={`${form.editingTitle ?? "new"}-${saved ?? ""}`}
          label={form.label}
          editing={Boolean(form.editingTitle)}
          cancelHref={form.cancelHref}
          header={<div className="[&>div]:mb-0">{header}</div>}
          between={nav}
        >
          {form.editingTitle && <h2 className="mb-4 text-base font-semibold">Edit {form.editingTitle}</h2>}
          {form.content}
        </CreatePanel>
      ) : (
        <>
          {header}
          {nav && <div className="mb-4">{nav}</div>}
        </>
      )}
      <div className="space-y-6">
        {children}
      </div>
    </>
  );
}
