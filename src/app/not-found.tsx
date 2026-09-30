import { StatusPage } from "@/components/feedback/status-page";

export default function PublicNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <StatusPage
        code="404"
        kind="not-found"
        title="Oops. This page was not found."
        message="The page you're looking for doesn't exist or was moved."
        primary={{ href: "/login", label: "Go to login" }}
        showBack
      />
    </main>
  );
}
