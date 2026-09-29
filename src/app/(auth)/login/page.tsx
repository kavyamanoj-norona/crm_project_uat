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
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-navy text-lg font-bold text-white">
          LC
        </div>
        <h1 className="text-2xl font-semibold">
          Laptop <span className="text-primary">Clinic</span>
        </h1>
        <p className="mt-1 text-sm text-text-muted">Please sign in to continue</p>
      </div>
      <LoginForm action={login} />
    </>
  );
}
