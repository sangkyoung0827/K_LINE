import "server-only";

import type { EccAccess } from "@/lib/eccAccess";
import { activities, publicActivities } from "@/data/activities";
import { activityBoards } from "@/data/activityBoards";
import { goods } from "@/data/goods";
import { projects } from "@/data/projects";
import { SupabaseConfigError, SupabaseRequestError, supabaseRequest } from "@/lib/supabaseServer";

type LocalBoardPostInput = {
  author?: unknown;
  boardId?: unknown;
  content?: unknown;
  createdAt?: unknown;
  id?: unknown;
  title?: unknown;
};

type SearchRecord = {
  author?: string;
  date?: string;
  href: string;
  source: string;
  status?: string;
  summary: string;
  title: string;
};

type ActivityPostRow = {
  id: string;
  created_at: string;
  title: string;
  category: string | null;
  author_name: string | null;
  content: string | null;
  tags: string[] | null;
  status: string;
};

type ProjectSubmissionRow = {
  id: string;
  created_at: string;
  title: string;
  english_title: string | null;
  team_or_author: string | null;
  short_description: string | null;
  full_description: string | null;
  tags: string[] | null;
  status: string;
};

type EccApplicationRow = {
  activity_id: string;
  activity_title: string | null;
  created_at: string;
  name: string;
  nationality: string;
  status: string;
};

const maxContextRecords = 8;

function cleanInput(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function recordText(record: SearchRecord) {
  return compact(
    [record.title, record.summary, record.source, record.author, record.status, record.href].join(" ")
  ).toLowerCase();
}

function queryTerms(query: string) {
  const normalized = query.toLowerCase();
  const terms = normalized
    .split(/[^0-9a-zA-Z가-힣_-]+/g)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  if (normalized.trim().length >= 2) {
    terms.push(normalized.trim());
  }

  return Array.from(new Set(terms)).slice(0, 16);
}

function scoreRecord(record: SearchRecord, query: string) {
  const terms = queryTerms(query);
  const haystack = recordText(record);

  if (terms.length === 0) {
    return 0;
  }

  return terms.reduce((score, term) => {
    if (!haystack.includes(term)) {
      return score;
    }

    const titleBoost = record.title.toLowerCase().includes(term) ? 4 : 0;
    const hrefBoost = record.href.toLowerCase().includes(term) ? 2 : 0;
    return score + 1 + titleBoost + hrefBoost;
  }, 0);
}

function formatRecord(record: SearchRecord) {
  return [
    `- [${record.source}] ${record.title}`,
    record.href ? `  URL: ${record.href}` : "",
    record.date ? `  Date: ${record.date}` : "",
    record.author ? `  Author: ${record.author}` : "",
    record.status ? `  Status: ${record.status}` : "",
    `  Summary: ${compact(record.summary).slice(0, 260)}`
  ]
    .filter(Boolean)
    .join("\n");
}

function localBoardRecords(posts: unknown): SearchRecord[] {
  if (!Array.isArray(posts)) {
    return [];
  }

  return posts.slice(0, 40).flatMap((post) => {
    const input = post as LocalBoardPostInput;
    const id = cleanInput(input.id, 120);
    const boardId = cleanInput(input.boardId, 40);
    const title = cleanInput(input.title, 180);
    const content = cleanInput(input.content, 900);

    if (!id || !title || !content || (boardId !== "ecc" && boardId !== "hanhwal")) {
      return [];
    }

    return [
      {
        author: cleanInput(input.author, 120),
        date: cleanInput(input.createdAt, 60),
        href: `/our-activities/${boardId}/${id}`,
        source: boardId === "ecc" ? "ECC browser free board" : "Hanhwal browser free board",
        summary: content,
        title
      }
    ];
  });
}

async function fetchSupabaseRecords(access: EccAccess) {
  const records: SearchRecord[] = [];
  const adminNotes: string[] = [];

  if (access.isSuperAdmin) {
    try {
      const rows = await supabaseRequest<ActivityPostRow[]>(
        "activity_posts?select=id,created_at,title,category,author_name,content,tags,status&order=created_at.desc&limit=30"
      );

      rows.forEach((row) => {
        records.push({
          author: row.author_name ?? "",
          date: row.created_at,
          href: "/admin",
          source: "Pending/review activity submission",
          status: row.status,
          summary: compact([row.category, row.content, ...(row.tags ?? [])].join(" ")),
          title: row.title
        });
      });
    } catch (error) {
      if (!(error instanceof SupabaseConfigError || error instanceof SupabaseRequestError)) {
        console.error("Woohyukmon activity submission search failed", error);
      }
    }

    try {
      const rows = await supabaseRequest<ProjectSubmissionRow[]>(
        "project_submissions?select=id,created_at,title,english_title,team_or_author,short_description,full_description,tags,status&order=created_at.desc&limit=30"
      );

      rows.forEach((row) => {
        records.push({
          author: row.team_or_author ?? "",
          date: row.created_at,
          href: "/admin",
          source: "Pending/review project submission",
          status: row.status,
          summary: compact(
            [
              row.english_title,
              row.short_description,
              row.full_description,
              ...(row.tags ?? [])
            ].join(" ")
          ),
          title: row.title
        });
      });
    } catch (error) {
      if (!(error instanceof SupabaseConfigError || error instanceof SupabaseRequestError)) {
        console.error("Woohyukmon project submission search failed", error);
      }
    }
  }

  if (!access.isAdmin) {
    return { adminNotes, records };
  }

  try {
    const rows = await supabaseRequest<EccApplicationRow[]>(
      "ecc_activity_applications?select=activity_id,activity_title,created_at,name,nationality,status&order=created_at.desc&limit=80"
    );
    const grouped = new Map<string, { paid: number; pending: number; recent: string[]; total: number }>();

    rows.forEach((row) => {
      const title = row.activity_title || row.activity_id;
      const current = grouped.get(title) ?? { paid: 0, pending: 0, recent: [], total: 0 };
      current.total += 1;
      if (row.status === "paid") {
        current.paid += 1;
      } else {
        current.pending += 1;
      }
      if (current.recent.length < 5) {
        current.recent.push(`${row.name} (${row.nationality}, ${row.status})`);
      }
      grouped.set(title, current);
    });

    if (grouped.size > 0) {
      adminNotes.push(
        "ECC application admin summary:",
        ...Array.from(grouped.entries()).map(
          ([title, item]) =>
            `- ${title}: total ${item.total}, paid ${item.paid}, pending/unpaid ${item.pending}. Recent: ${item.recent.join(", ")}`
        )
      );
    }
  } catch (error) {
    if (!(error instanceof SupabaseConfigError || error instanceof SupabaseRequestError)) {
      console.error("Woohyukmon ECC application summary failed", error);
    }
  }

  return { adminNotes, records };
}

function baseRecords(options: {
  includeGoods: boolean;
  includeProjects: boolean;
  localBoardPosts: unknown;
}) {
  const visibleActivities = options.includeGoods ? activities : publicActivities;
  const records: SearchRecord[] = [
    ...activityBoards.map((board) => ({
      href: `/our-activities/${board.slug}`,
      source: "Club board",
      summary: `${board.title} / ${board.koreanTitle}. ${board.description}`,
      title: board.label
    })),
    ...visibleActivities.map((post) => ({
      author: post.author,
      date: post.date,
      href: `/our-activities/${post.slug}`,
      source: "Published club record",
      summary: `${post.excerpt} ${post.content} ${post.tags.join(", ")}`,
      title: post.title
    })),
    ...localBoardRecords(options.localBoardPosts)
  ];

  if (options.includeProjects) {
    records.push(
      ...projects.map((project) => ({
        author: project.teamOrAuthor,
        date: project.date,
        href: `/k-culture-project/${project.slug}`,
        source: "K-Culture Project",
        summary: `${project.englishTitle}. ${project.shortDescription} ${project.fullDescription} ${project.tags.join(", ")}`,
        title: project.title
      }))
    );
  }

  if (options.includeGoods) {
    records.push(
      ...goods.map((item) => ({
        href: `/goods/${item.slug}`,
        source: "Developer-only goods draft",
        summary: `${item.koreanName}. ${item.shortDescription} ${item.fullDescription} ${item.materials.join(", ")}`,
        title: item.name
      }))
    );
  }

  return records;
}

function roleCapabilities(access: EccAccess, includeProjects: boolean, includeGoods: boolean) {
  const common = [
    "Can explain K_LINE pages, ECC, Han-hwal, official member registration, activity applications, free boards, and contact routes.",
    "Can draft KakaoTalk notices, event plans, weekly club schedules, checklists, meeting agendas, announcements, and polite Korean/English messages.",
    "Can search visible site records from the provided index and return titles with URLs."
  ];

  if (access.isOfficialMember) {
    common.push("Official member can be guided to ECC official pages, team chat, board, and activity applications.");
  }

  if (access.isAdmin) {
    common.push("Admin can receive operational guidance for ECC applications, member management, payment checks, team chat onboarding, and board moderation.");
  }

  if (access.isSuperAdmin) {
    common.push("Super admin can receive review guidance for pending project/activity submissions and admin approval workflows.");
  }

  if (includeProjects) {
    common.push("K-Culture Project pages are visible for this role.");
  }

  if (includeGoods) {
    common.push("Developer-only goods drafts and developer diagnostics are visible for this role.");
  }

  return common;
}

export async function buildWoohyukmonAssistantContext(options: {
  access: EccAccess;
  includeGoods: boolean;
  includeProjects: boolean;
  localBoardPosts?: unknown;
  query: string;
}) {
  const records = baseRecords({
    includeGoods: options.includeGoods,
    includeProjects: options.includeProjects,
    localBoardPosts: options.localBoardPosts
  });
  const supabase = await fetchSupabaseRecords(options.access);
  const allRecords = [...records, ...supabase.records];
  const scored = allRecords
    .map((record) => ({ record, score: scoreRecord(record, options.query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxContextRecords)
    .map((item) => item.record);

  const fallbackRecent = allRecords.slice(0, 5);
  const searchResults = scored.length > 0 ? scored : fallbackRecent;

  return [
    "WOOHYUKMON ROLE AND ADMIN ASSISTANT CONTEXT",
    `Current role: ${options.access.role}`,
    "Capabilities:",
    ...roleCapabilities(options.access, options.includeProjects, options.includeGoods).map(
      (capability) => `- ${capability}`
    ),
    "",
    "Administrative guidance rules:",
    "- Do not claim that you directly changed data unless the user used a real site form or admin page.",
    "- For actions that require clicking or saving, give the exact page path and a short checklist.",
    "- For announcements, provide copy-ready KakaoTalk text in the user's language.",
    "- For activity ideas, suggest practical campus-friendly plans with purpose, materials, flow, and follow-up.",
    "- For post search requests, list the best matching title, URL, source, and why it matches.",
    "- Never reveal developer-only goods or pending submission details unless the current role allows it.",
    "",
    "Relevant searchable records for this message:",
    ...searchResults.map(formatRecord),
    "",
    ...(supabase.adminNotes.length > 0 ? [...supabase.adminNotes, ""] : []),
    "Local free-board note: ECC/Hanhwal free-board posts are browser-stored right now. I can search the posts available in this browser session; full cross-user search needs future Supabase migration."
  ].join("\n");
}
