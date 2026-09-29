import { StatusPage } from "@/components/feedback/status-page";

export const metadata = { title: "No access" };

export default function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      title="You don't have access"
      message="Your role doesn't include this page. Ask an administrator if you need it."
      primary={{ href: "/", label: "Go to my home" }}
    />
  );
}
