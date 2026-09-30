import { cn } from "@/lib/cn";

export type IllustrationKind = "not-found" | "forbidden" | "error";

type StatusIllustrationProps = {
  /** Three characters, e.g. "404". The middle one is drawn as a laptop. */
  code: string;
  kind: IllustrationKind;
  className?: string;
};

/**
 * Laptop-themed status illustration in brand colours (blueprint §9).
 * Colours come from the theme tokens, so it follows light/dark mode.
 */
export function StatusIllustration({ code, kind, className }: StatusIllustrationProps) {
  const [left = "", , right = ""] = [...code];

  return (
    <svg viewBox="0 0 480 300" role="img" aria-label={`Error ${code}`} className={cn("h-auto w-full max-w-md", className)}>
      {/* soft backdrop */}
      <ellipse cx="240" cy="150" rx="200" ry="120" className="fill-primary-soft" />
      <ellipse cx="240" cy="262" rx="130" ry="12" className="fill-brand-navy opacity-10" />

      {/* floating decorations */}
      <g className="motion-safe:animate-float">
        <Gear x={62} y={48} />
        <Chip x={392} y={40} />
      </g>
      <g className="motion-safe:animate-float-slow">
        <circle cx="420" cy="215" r="6" className="fill-primary opacity-60" />
        <circle cx="52" cy="220" r="4" className="fill-brand-navy opacity-40" />
        <path d="M430 110h12M436 104v12" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 150h10M45 145v10" className="stroke-brand-navy opacity-50" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* side digits with a 3D offset */}
      <Digit x={105} char={left} />
      <Digit x={375} char={right} />

      {/* laptop as the middle digit */}
      <g>
        <rect x="178" y="92" width="124" height="90" rx="10" className="fill-surface stroke-brand-navy" strokeWidth="7" />
        <rect x="190" y="104" width="100" height="66" rx="4" className="fill-primary-soft" />
        <path d="M156 190h168l-10 16a8 8 0 0 1-7 4H173a8 8 0 0 1-7-4z" className="fill-brand-navy" />
        <rect x="222" y="190" width="36" height="5" rx="2.5" className="fill-primary opacity-70" />
        <ScreenContent kind={kind} />
      </g>
    </svg>
  );
}

function Digit({ x, char }: { x: number; char: string }) {
  const common = {
    x,
    y: 205,
    textAnchor: "middle" as const,
    fontSize: 190,
    fontWeight: 900,
    style: { fontFamily: "var(--font-geist-sans), system-ui, sans-serif" },
  };
  return (
    <g aria-hidden>
      <text {...common} x={x + 7} y={212} className="fill-brand-navy">
        {char}
      </text>
      <text {...common} className="fill-primary">
        {char}
      </text>
    </g>
  );
}

function ScreenContent({ kind }: { kind: IllustrationKind }) {
  if (kind === "forbidden") {
    return (
      <g>
        <path d="M228 132v-10a12 12 0 0 1 24 0v10" fill="none" className="stroke-brand-navy" strokeWidth="6" strokeLinecap="round" />
        <rect x="220" y="130" width="40" height="30" rx="6" className="fill-primary" />
        <circle cx="240" cy="143" r="4" className="fill-surface" />
        <rect x="238" y="145" width="4" height="8" rx="2" className="fill-surface" />
      </g>
    );
  }

  if (kind === "error") {
    return (
      <g>
        <path d="M240 114l26 44h-52z" className="fill-warning" strokeLinejoin="round" />
        <rect x="237.5" y="128" width="5" height="16" rx="2.5" className="fill-surface" />
        <circle cx="240" cy="150" r="3" className="fill-surface" />
        <path d="M200 116h18M200 124h10" className="stroke-brand-navy opacity-30" strokeWidth="4" strokeLinecap="round" />
      </g>
    );
  }

  // not-found: code lines on screen with a magnifying glass sweeping over them
  return (
    <g>
      <path
        d="M200 116h40M200 127h58M200 138h30M200 149h48M200 160h22"
        className="stroke-brand-navy opacity-25"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g className="motion-safe:animate-search">
        <line x1="282" y1="152" x2="318" y2="192" className="stroke-brand-navy" strokeWidth="13" strokeLinecap="round" />
        <circle cx="262" cy="128" r="32" className="fill-surface/70 stroke-primary" strokeWidth="10" />
        <path d="M248 112a20 20 0 0 1 16-6" fill="none" className="stroke-surface" strokeWidth="5" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Gear({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <circle r="18" fill="none" className="stroke-brand-navy opacity-40" strokeWidth="8" strokeDasharray="7 5" />
      <circle r="11" fill="none" className="stroke-brand-navy opacity-40" strokeWidth="4" />
    </g>
  );
}

function Chip({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden className="opacity-70">
      <path d="M6 -4v-6M14 -4v-6M22 -4v-6M6 32v6M14 32v6M22 32v6M-4 6h-6M-4 14h-6M-4 22h-6M32 6h6M32 14h6M32 22h6" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <rect x="-4" y="-4" width="36" height="36" rx="6" className="fill-surface stroke-primary" strokeWidth="4" />
      <rect x="7" y="7" width="14" height="14" rx="2" className="fill-primary" />
    </g>
  );
}
