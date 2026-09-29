import { StatusPage } from "@/components/feedback/status-page";

export default function PublicNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <StatusPage
        code="404"
        title="Page not found"
        message="The page or record you're looking for doesn't exist or was moved."
        primary={{ href: "/login", label: "Go to login" }}
      />
    </main>
  );
}
