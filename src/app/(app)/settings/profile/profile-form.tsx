"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Briefcase, Building2, Calendar, Camera, Clock, Hash, Loader2, Mail, Phone, Save, Trash2, User } from "lucide-react";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { validateForm, initialFormState, type FormState } from "@/lib/form";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

const schema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().optional(),
  email: z.string().email(),
});

export type ProfileInitial = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  userCode: string;
  imageUrl: string | null;
  roleName: string;
  branchName: string;
  departmentName: string;
  memberSince: string;
  lastSignIn: string;
};

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: ProfileInitial;
};

function inputCls(error?: string | string[]) {
  return `w-full rounded-lg border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 ${error ? "border-danger" : "border-border"}`;
}
const readonlyCls = "w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted";

function Fact({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function ProfileForm({ action, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(schema, fd, ["firstName", "lastName", "email"]),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  // A picked photo is shown right away; the object URL is released when it changes.
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const v = state.values ?? { firstName: initial.firstName, lastName: initial.lastName, email: initial.email };
  const shownImage = removed ? null : (preview ?? initial.imageUrl);
  const fullName = [String(v.firstName ?? ""), String(v.lastName ?? "")].filter(Boolean).join(" ") || initial.username;

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <input type="hidden" name="removeImage" value={removed ? "1" : ""} />

      {/* Identity card */}
      <aside className="overflow-hidden rounded-xl border border-border bg-surface xl:sticky xl:top-20">
        <div className="h-20 bg-gradient-to-r from-brand-navy to-primary" />
        <div className="-mt-12 px-5 pb-5">
          <div className="relative w-fit">
            <Avatar name={fullName} imageUrl={shownImage} className="size-24 text-2xl ring-4 ring-surface" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Change photo"
              className="absolute -right-1 bottom-0 inline-flex size-8 items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow-sm hover:text-primary"
            >
              <Camera className="size-4" />
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPreview(URL.createObjectURL(f));
                setRemoved(false);
              }
            }}
          />

          <h2 className="mt-3 truncate text-lg font-bold">{fullName}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone="primary">{initial.roleName}</Badge>
            <span className="text-xs text-text-muted">@{initial.username}</span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted">
              <Camera className="size-4" /> {shownImage ? "Change photo" : "Upload photo"}
            </button>
            {shownImage && (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setRemoved(true);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10"
              >
                <Trash2 className="size-4" /> Remove
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-text-muted">JPG, PNG or WebP, up to 2 MB. Saved when you press Save changes.</p>
          {errors.image && <p className="mt-1 text-xs text-danger">{errors.image[0]}</p>}

          <div className="mt-4 divide-y divide-border border-t border-border">
            <Fact icon={Hash} label="Employee code" value={initial.userCode} />
            <Fact icon={Building2} label="Branch" value={initial.branchName} />
            <Fact icon={Briefcase} label="Department" value={initial.departmentName} />
            <Fact icon={Calendar} label="Member since" value={initial.memberSince} />
            <Fact icon={Clock} label="Last sign-in" value={initial.lastSignIn} />
          </div>
        </div>
      </aside>

      {/* Details */}
      <div className="space-y-5">
        {state.ok && state.message && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">✓ {state.message}</div>
        )}
        {state.ok === false && state.message && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</div>}

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <User className="size-5 text-primary" /> Personal details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="firstName">
                First name <span className="text-danger">*</span>
              </label>
              <input id="firstName" name="firstName" placeholder="Enter first name" defaultValue={String(v.firstName ?? "")} className={inputCls(errors.firstName)} />
              {errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName[0]}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="lastName">
                Last name
              </label>
              <input id="lastName" name="lastName" placeholder="Enter last name" defaultValue={String(v.lastName ?? "")} className={inputCls()} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Mail className="size-5 text-primary" /> Contact
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
                Email <span className="text-danger">*</span>
              </label>
              <input id="email" name="email" type="email" placeholder="Enter email" defaultValue={String(v.email ?? "")} className={inputCls(errors.email)} />
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email[0]}</p>}
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                <Phone className="size-3.5 text-text-muted" /> Mobile
              </label>
              <input value={initial.mobile} disabled className={readonlyCls} />
              <p className="mt-1 text-xs text-text-muted">Contact admin to change mobile.</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Hash className="size-5 text-primary" /> Account
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Username</label>
              <input value={initial.username} disabled className={readonlyCls} />
              <p className="mt-1 text-xs text-text-muted">Username cannot be changed.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Employee code</label>
              <input value={initial.userCode} disabled className={readonlyCls} />
            </div>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-1 flex justify-end gap-3 rounded-xl border border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <button
            type="reset"
            onClick={() => {
              setPreview(null);
              setRemoved(false);
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
