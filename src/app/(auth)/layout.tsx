// Centred card on a soft brand-gradient background, no app shell (blueprint §6).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-navy/10 via-transparent to-primary/12"
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 w-full text-primary/15 motion-reduce:hidden"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path fill="none" stroke="currentColor" strokeWidth="2" d="M0,224L80,202.7C160,181,320,139,480,149.3C640,160,800,224,960,229.3C1120,235,1280,181,1360,154.7L1440,128" />
        <path fill="none" stroke="currentColor" strokeWidth="2" d="M0,256L80,245.3C160,235,320,213,480,202.7C640,192,800,192,960,208C1120,224,1280,256,1360,272L1440,288" />
      </svg>

      <div className="relative w-full max-w-[480px] rounded-2xl bg-surface p-8 shadow-xl sm:p-10">{children}</div>

      <footer className="relative mt-8 text-center text-xs text-text-muted">
        <p>© 2026 Laptop Clinic CRM. All rights reserved.</p>
        <p className="mt-1">Powered by Norona Tech LLP</p>
      </footer>
    </div>
  );
}
