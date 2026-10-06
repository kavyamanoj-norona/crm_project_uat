import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: 'AI Agents — "The Seven"' };

type Agent = {
  key: string;
  name: string;
  role: string;
  wave: string;
  delivery: string;
  description: string;
  color: string;
};

const AGENTS: Agent[] = [
  {
    key: "meera",
    name: "Meera",
    role: "Daily / Weekly / Monthly Reports",
    wave: "Wave 1",
    delivery: "Telegram + email",
    description:
      "EOD revenue net of refunds, closing-cash flags, aging by branch; Sunday branch comparison; monthly vs same month last year. Data pack + executive narrative + 3 things needing attention.",
    color: "bg-[#1a2a6c]",
  },
  {
    key: "arjun",
    name: "Arjun",
    role: "TAT Watcher",
    wave: "Wave 1",
    delivery: "continuous",
    description:
      "Rules find breaches against the TAT standards table; AI ranks worst offenders with reasons and next actions, spots chronic branch/engineer patterns and ping-ponging cases. Badges on cases.",
    color: "bg-[#2980b9]",
  },
  {
    key: "vikram",
    name: "Vikram",
    role: "Leakage Watchdog",
    wave: "Wave 1",
    delivery: "private",
    description:
      "Weekly anomaly scan: discounts by staff, below-minimum overrides, refund patterns, cash-vs-UPI mix shifts, CS mismatches, cancellations. Evidence-based findings to a private owner channel.",
    color: "bg-[#1a6c4a]",
  },
  {
    key: "kiran",
    name: "Kiran",
    role: "Ask-the-CRM",
    wave: "Wave 2",
    delivery: "in-app",
    description:
      "Natural-language Q&A over live data, role-scoped and read-only, always shows the underlying numbers. Lives in the ask bar at the top of every screen.",
    color: "bg-[#1a4a6c]",
  },
  {
    key: "ravi",
    name: "Ravi",
    role: "Stock Intelligence",
    wave: "Wave 3",
    delivery: "monthly",
    description:
      "Dead stock ₹ by branch, stockout predictions from consumption rates, purchase-fulfilment lag. Delivered to the Purchase Manager.",
    color: "bg-[#6c3a1a]",
  },
  {
    key: "priya",
    name: "Priya",
    role: "CS Prioritizer",
    wave: "Wave 2",
    delivery: "CS workspace",
    description:
      "Ranks the morning callback queue: mismatch-risk verifications first, lapse-risk members, unhappy-signal customers.",
    color: "bg-[#4a1a6c]",
  },
  {
    key: "anjali",
    name: "Anjali",
    role: "Review Reply Drafter",
    wave: "Wave 3",
    delivery: "on-demand",
    description:
      "Drafts responses to pasted Google reviews, tone-matched to rating; a human always posts. Feeds the Phase-2 reputation module.",
    color: "bg-[#2e7d32]",
  },
];

const WAVE_COLORS: Record<string, string> = {
  "Wave 1": "bg-blue-50 text-blue-700 border-blue-200",
  "Wave 2": "bg-purple-50 text-purple-700 border-purple-200",
  "Wave 3": "bg-amber-50 text-amber-700 border-amber-200",
};

function AgentAvatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${color} text-sm font-bold text-white`}
    >
      {name[0]}
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const waveClass = WAVE_COLORS[agent.wave] ?? "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AgentAvatar name={agent.name} color={agent.color} />
          <div>
            <p className="font-semibold text-text">
              {agent.name}{" "}
              <span className="font-normal text-primary">· {agent.role}</span>
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${waveClass}`}>
          {agent.wave} · {agent.delivery}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-text-muted">{agent.description}</p>
    </div>
  );
}

export default async function AiAgentsPage() {
  await requirePageAccess("/company/agents");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text">AI agents — &ldquo;the seven&rdquo;</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          AI narrates; the database calculates. Deterministic triggers, intelligent commentary.
          Read-only, human-in-the-loop. Internal delivery on Telegram; WhatsApp stays customer-only.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {AGENTS.map((agent) => (
          <AgentCard key={agent.key} agent={agent} />
        ))}

      </div>

      <p className="text-center text-[11px] text-text-muted">
        Laptop Clinic CRM · AI Agents — Phase 1 rollout · data is illustrative
      </p>
    </div>
  );
}
