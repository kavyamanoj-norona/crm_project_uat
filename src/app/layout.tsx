import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/feedback/toast";

// Brand typeface is Myriad Pro; Source Sans 3 is its open stand-in (brand guidelines).
const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Laptop Clinic CRM", template: "%s · Laptop Clinic CRM" },
  description: "Laptop Clinic CRM — Norona Tech LLP",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("lc_theme")?.value ?? "light";
  return (
    <html
      lang="en"
      data-theme={theme === "dark" ? "dark" : "light"}
      className={`${sourceSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
