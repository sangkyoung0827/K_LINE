import "server-only";

import { activities, publicActivities } from "@/data/activities";
import { activityBoards } from "@/data/activityBoards";
import { goods } from "@/data/goods";
import { projects } from "@/data/projects";
import { woohyukmonKnowledge } from "@/data/woohyukmonKnowledge";

type WoohyukmonContextOptions = {
  includeGoods?: boolean;
  includeProjects?: boolean;
};

export function buildWoohyukmonContext({
  includeGoods = false,
  includeProjects = false
}: WoohyukmonContextOptions = {}) {
  const goodsSummary = goods
    .map(
      (item) =>
        `- ${item.name} / ${item.koreanName}: ${item.shortDescription} (${item.dimensions}) URL: /goods/${item.slug}`
    )
    .join("\n");

  const projectSummary = projects
    .map(
      (project) =>
        `- ${project.title} / ${project.englishTitle}: ${project.shortDescription} URL: /k-culture-project/${project.slug}`
    )
    .join("\n");

  const visibleActivities = includeGoods ? activities : publicActivities;
  const activitySummary = visibleActivities
    .slice(0, 6)
    .map((post) => `- ${post.title}: ${post.excerpt} URL: /our-activities/${post.slug}`)
    .join("\n");

  const boardSummary = activityBoards
    .map((board) => `- ${board.label}: ${board.description} URL: /our-activities/${board.slug}`)
    .join("\n");

  // TODO: merge database-backed knowledge, admin-managed FAQ, uploaded document search,
  // vector retrieval, and public post search into this compact context.
  const publicContext = [
    "K_LINE KNOWLEDGE BASE",
    `Identity: ${woohyukmonKnowledge.identity.description}`,
    includeGoods
      ? `Tracks: ${woohyukmonKnowledge.tracks.summary}`
      : includeProjects
        ? "Visible tracks for this role: K-Culture Project and International Clubs."
        : "Visible track for regular members: International Clubs.",
    "",
    "Track URLs:",
    ...(includeGoods || includeProjects
      ? woohyukmonKnowledge.tracks.items
          .filter((track) => {
            if (track.href === "/goods") {
              return includeGoods;
            }

            if (track.href === "/k-culture-project") {
              return includeProjects;
            }

            return true;
          })
          .map((track) => `- ${track.name}: ${track.description} URL: ${track.href}`)
      : woohyukmonKnowledge.tracks.items
          .filter((track) => track.href === "/our-activities")
          .map((track) => `- ${track.name}: ${track.description} URL: ${track.href}`)),
    "",
    "International Clubs:",
    woohyukmonKnowledge.activities.summary,
    `Club writing URL: ${woohyukmonKnowledge.activities.writeHref}`,
    boardSummary,
    "",
    "ECC:",
    `${woohyukmonKnowledge.ecc.fullName}. ${woohyukmonKnowledge.ecc.description} URL: ${woohyukmonKnowledge.ecc.href}`,
    `ECC activity management URL: ${woohyukmonKnowledge.ecc.activityHref}`,
    `ECC free board URL: ${woohyukmonKnowledge.ecc.freeBoardHref}`,
    `ECC fund URL: ${woohyukmonKnowledge.ecc.fundHref}`,
    "",
    "Han-hwal:",
    `${woohyukmonKnowledge.hanHwal.keySentence} ${woohyukmonKnowledge.hanHwal.englishVersion}`,
    `Project URL: ${woohyukmonKnowledge.hanHwal.projectHref}`,
    `Activity board URL: ${woohyukmonKnowledge.hanHwal.activityHref}`,
    "",
    "Recent club examples:",
    activitySummary,
    "",
    "Writing help:",
    `Project structure: ${woohyukmonKnowledge.writingHelp.projectStructure.join(" / ")}`,
    `Club post structure: ${woohyukmonKnowledge.writingHelp.activityPostStructure.join(" / ")}`,
    "",
    `Contact URL: ${woohyukmonKnowledge.contact.href}`,
    "Rule: If information is missing, say it is not available yet and guide users to Contact."
  ];

  if (!includeGoods && !includeProjects) {
    publicContext.push(
      "Rule: Goods and K-Culture Project pages are hidden from regular member accounts. Do not guide regular members to those pages."
    );
    return publicContext.join("\n");
  }

  const restrictedContext: string[] = [...publicContext.slice(0, 8)];

  if (includeGoods) {
    restrictedContext.push("", "Goods:", goodsSummary);
  }

  if (includeProjects) {
    restrictedContext.push(
      "",
      "K-Culture Projects:",
      projectSummary,
      `Submission URL: ${woohyukmonKnowledge.kCultureProjects.submission.href}`
    );
  }

  return [...restrictedContext, "", ...publicContext.slice(8)].join("\n");
}
