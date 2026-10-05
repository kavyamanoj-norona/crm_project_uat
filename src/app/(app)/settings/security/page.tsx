import { PasswordForm } from "./password-form";

export const metadata = { title: "Password & Security" };

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-text">Password &amp; Security</h1>
        <p className="text-sm text-text-muted">Active sessions and update password section.</p>
      </div>

      {/* Password Reset */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Password Reset</h2>
        <p className="mb-4 text-sm text-text-muted">Update your password here. Enter your current and new password.</p>
        <PasswordForm />
      </div>

      {/* Accounts Security */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">Accounts Security</h2>
        <p className="mb-4 text-sm text-text-muted">Manage your linked accounts and their permissions.</p>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              MF
            </div>
            <span className="text-sm font-medium">Multi-factor authentication</span>
          </div>
          <span className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-600">
            Not Connected
          </span>
        </div>
      </div>
    </div>
  );
}
