import { redirect } from "next/navigation";
import { login } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="sr-only">Laptop Clinic CRM</h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset */}
        <img src="/crm-full-logo.png" alt="Laptop Clinic CRM" width={220} style={{ height: "auto" }} className="mx-auto mb-4 block" />
        <p className="text-sm text-text-muted">Please sign in to continue</p>
      </div>
      <LoginForm action={login} />
    </>
  );
}
