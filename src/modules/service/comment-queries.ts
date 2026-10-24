import "server-only";
import { db } from "@/server/db";
import { getHeadOfficeBranch } from "@/modules/inventory/head-office";

export type CaseCommentRow = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  parent: { id: string; authorName: string; body: string } | null;
  mentions: { userId: string; name: string }[];
};

export type Mentionable = { id: string; name: string; role: string };

const fullName = (u: { firstName: string; lastName: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ");

/** Everything said on a case, oldest first. Anyone who can open the case sees it, whichever branch they work in. */
export async function listCaseComments(caseId: string): Promise<CaseCommentRow[]> {
  const rows = await db.caseComment.findMany({
    where: { caseId, isDelete: 0 },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { firstName: true, lastName: true, imageUrl: true } },
      parent: { select: { id: true, body: true, author: { select: { firstName: true, lastName: true } } } },
      mentions: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    authorId: c.authorId,
    authorName: fullName(c.author),
    authorImage: c.author.imageUrl,
    parent: c.parent ? { id: c.parent.id, authorName: fullName(c.parent.author), body: c.parent.body } : null,
    mentions: c.mentions.map((m) => ({ userId: m.userId, name: fullName(m.user) })),
  }));
}

/** Staff who can open this case: its own branch, Head Office (and the lab), and owner-level accounts. */
export async function caseMentionWhere(branchId: string) {
  const ho = await getHeadOfficeBranch();
  return {
    isActive: true,
    status: "WORKING" as const,
    OR: [{ branchId }, { branchId: ho.id }, { branchId: null }, { branch: { isVirtual: true } }, { privilege: { isBranchBound: false } }],
  };
}

export async function listMentionable(branchId: string): Promise<Mentionable[]> {
  const users = await db.user.findMany({
    where: await caseMentionWhere(branchId),
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, privilege: { select: { name: true } } },
  });
  return users.map((u) => ({ id: u.id, name: fullName(u), role: u.privilege.name }));
}

export type MentionNotice = { id: string; caseId: string; jobsheetNo: string; byName: string; body: string; at: string };

/** Unread @mentions of this user, newest first (for the bell). */
export async function listUnreadMentions(userId: string): Promise<{ count: number; items: MentionNotice[] }> {
  const where = { userId, readAt: null, comment: { isDelete: 0 } };
  const [count, rows] = await Promise.all([
    db.caseCommentMention.count({ where }),
    db.caseCommentMention.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { comment: { select: { body: true, author: { select: { firstName: true, lastName: true } }, case: { select: { id: true, jobsheetNo: true } } } } },
    }),
  ]);
  return {
    count,
    items: rows.map((m) => ({
      id: m.id,
      caseId: m.comment.case.id,
      jobsheetNo: m.comment.case.jobsheetNo,
      byName: fullName(m.comment.author),
      body: m.comment.body,
      at: m.createdAt.toISOString(),
    })),
  };
}
