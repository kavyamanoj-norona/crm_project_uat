import "server-only";
import type OpenAI from "openai";
import { db } from "@/server/db";
import type { BranchScope } from "@/server/branch-scope";

// ─── Tool definitions (JSON Schema for OpenAI function calling) ──────────────

export const KIRAN_TOOL_DEFINITIONS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_case_stats",
      description:
        "Get service case statistics for a time period: new cases created, cases closed, and a breakdown of currently open cases by stage.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "year"],
            description: "The period to summarise",
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_revenue_summary",
      description:
        "Get payment and revenue totals for a time period, broken down by payment mode (UPI, CASH, CARD, OTHER). All amounts are in paise (₹1 = 100 paise).",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "week", "month", "year"],
          },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_open_cases",
      description:
        "List currently open service cases, optionally filtered by stage. Returns jobsheet number, device, customer name, current stage, and how many hours the case has been in its current stage.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [
              "INTAKE",
              "DIAGNOSIS",
              "PENDING_APPROVAL",
              "AWAITING_STOCK",
              "QUALITY_CHECK",
              "READY_FOR_DELIVERY",
            ],
            description:
              "Filter to one specific stage (omit for all open cases)",
          },
          limit: {
            type: "number",
            description: "Max results (default 20, max 50)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_case_by_jobsheet",
      description:
        "Get full details of a specific case by its jobsheet number.",
      parameters: {
        type: "object",
        properties: {
          jobsheetNo: {
            type: "string",
            description: "Jobsheet number, e.g. LC-EDP-2609-0001",
          },
        },
        required: ["jobsheetNo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_customer",
      description: "Find a customer by phone number or name (partial match).",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Phone number (digits only)" },
          name: {
            type: "string",
            description: "Customer name or partial name",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_summary",
      description:
        "Get current stock levels for items at the branch. Use lowStockOnly=true to show items with 3 or fewer units.",
      parameters: {
        type: "object",
        properties: {
          lowStockOnly: {
            type: "boolean",
            description: "When true, only return items with quantity ≤ 3",
          },
        },
      },
    },
  },
];

// ─── Period helper ────────────────────────────────────────────────────────────

function periodRange(period: "today" | "week" | "month" | "year") {
  const now = new Date();
  const from = new Date(now);
  switch (period) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "week":
      from.setDate(from.getDate() - 7);
      break;
    case "month":
      from.setMonth(from.getMonth() - 1);
      break;
    case "year":
      from.setFullYear(from.getFullYear() - 1);
      break;
  }
  return { from, to: now };
}

// ─── Tool executor ────────────────────────────────────────────────────────────

export async function executeKiranTool(
  name: string,
  args: Record<string, unknown>,
  scope: BranchScope,
): Promise<unknown> {
  const bf = scope.branchId ? { branchId: scope.branchId } : {};

  switch (name) {
    case "get_case_stats": {
      const period = args.period as "today" | "week" | "month" | "year";
      const { from, to } = periodRange(period);
      const [byStatus, newInPeriod, closedInPeriod] = await Promise.all([
        db.case.groupBy({
          by: ["status"],
          where: { ...bf, status: { notIn: ["CLOSED", "CANCELLED"] } },
          _count: { _all: true },
        }),
        db.case.count({ where: { ...bf, createdAt: { gte: from, lt: to } } }),
        db.case.count({
          where: { ...bf, status: "CLOSED", updatedAt: { gte: from, lt: to } },
        }),
      ]);
      const totalOpen = byStatus.reduce((s, r) => s + r._count._all, 0);
      return {
        period,
        newCasesCreated: newInPeriod,
        closedCases: closedInPeriod,
        totalOpenCases: totalOpen,
        openByStage: byStatus.map((r) => ({
          stage: r.status,
          count: r._count._all,
        })),
      };
    }

    case "get_revenue_summary": {
      const period = args.period as "today" | "week" | "month" | "year";
      const { from, to } = periodRange(period);
      const [total, byMode] = await Promise.all([
        db.payment.aggregate({
          where: { ...bf, createdAt: { gte: from, lt: to } },
          _sum: { amountPaise: true },
        }),
        db.payment.groupBy({
          by: ["mode"],
          where: { ...bf, createdAt: { gte: from, lt: to } },
          _sum: { amountPaise: true },
          _count: { _all: true },
        }),
      ]);
      return {
        period,
        totalPaise: total._sum.amountPaise ?? 0,
        totalRupees: ((total._sum.amountPaise ?? 0) / 100).toFixed(2),
        byMode: byMode.map((r) => ({
          mode: r.mode,
          amountPaise: r._sum.amountPaise ?? 0,
          transactions: r._count._all,
        })),
      };
    }

    case "get_open_cases": {
      const status = args.status as string | undefined;
      const limit = Math.min(Number(args.limit ?? 20), 50);
      const cases = await db.case.findMany({
        where: {
          ...bf,
          status: status
            ? (status as "INTAKE")
            : { notIn: ["CLOSED", "CANCELLED"] as const },
        },
        take: limit,
        orderBy: { stageChangedAt: "asc" },
        select: {
          jobsheetNo: true,
          status: true,
          brand: true,
          model: true,
          estimatedCostPaise: true,
          stageChangedAt: true,
          customer: { select: { name: true, phone: true } },
        },
      });
      const now = Date.now();
      return cases.map((c) => ({
        jobsheetNo: c.jobsheetNo,
        stage: c.status,
        device: `${c.brand}${c.model ? " " + c.model : ""}`,
        customer: c.customer.name,
        stageAgeHours: Math.floor(
          (now - c.stageChangedAt.getTime()) / 3_600_000,
        ),
        estimatedCostPaise: c.estimatedCostPaise,
      }));
    }

    case "get_case_by_jobsheet": {
      const jobsheetNo = String(args.jobsheetNo ?? "");
      const c = await db.case.findFirst({
        where: { jobsheetNo, ...bf },
        select: {
          jobsheetNo: true,
          status: true,
          brand: true,
          model: true,
          problemReported: true,
          estimatedCostPaise: true,
          stageChangedAt: true,
          createdAt: true,
          customer: { select: { name: true, phone: true } },
          payments: { select: { amountPaise: true } },
        },
      });
      if (!c) return { error: `Case ${jobsheetNo} not found` };
      const totalPaid = c.payments.reduce((s, p) => s + p.amountPaise, 0);
      return {
        jobsheetNo: c.jobsheetNo,
        stage: c.status,
        device: `${c.brand}${c.model ? " " + c.model : ""}`,
        problem: c.problemReported,
        customer: c.customer.name,
        customerPhone: c.customer.phone,
        estimatedCostPaise: c.estimatedCostPaise,
        totalPaidPaise: totalPaid,
        balancePaise: (c.estimatedCostPaise ?? 0) - totalPaid,
        stageAgeHours: Math.floor(
          (Date.now() - c.stageChangedAt.getTime()) / 3_600_000,
        ),
        createdAt: c.createdAt.toISOString(),
      };
    }

    case "find_customer": {
      const phone = args.phone as string | undefined;
      const name = args.name as string | undefined;
      if (!phone && !name) return { error: "Provide phone or name to search" };
      const where = phone
        ? { phone: { contains: phone.replace(/\D/g, "") } }
        : { name: { contains: name, mode: "insensitive" as const } };
      const customers = await db.customer.findMany({
        where: { ...where, kind: "CUSTOMER" as const, isActive: true },
        take: 5,
        select: {
          name: true,
          phone: true,
          email: true,
          type: true,
          visitCount: true,
          lastVisitAt: true,
        },
      });
      return customers;
    }

    case "get_inventory_summary": {
      const lowStockOnly = Boolean(args.lowStockOnly);
      const stockItems = await db.stockItem.findMany({
        where: {
          ...bf,
          ...(lowStockOnly ? { quantity: { lte: 3 } } : {}),
        },
        include: { item: { select: { name: true, code: true, type: true } } },
        orderBy: { quantity: "asc" },
        take: 50,
      });
      return stockItems.map((s) => ({
        itemCode: s.item.code,
        itemName: s.item.name,
        type: s.item.type,
        quantity: s.quantity,
      }));
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
