import { StatusPage } from "@/components/feedback/status-page";

export default function AppNotFound() {
  return (
    <StatusPage
      code="404"
      kind="not-found"
      title="Oops. This page was not found."
      message="The page or record you're looking for doesn't exist or was moved."
      primary={{ href: "/", label: "Back to home" }}
      showBack
    />
  );
}
