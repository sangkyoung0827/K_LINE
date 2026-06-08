import { activities } from "@/data/activities";
import { activityBoards } from "@/data/activityBoards";
import { goods } from "@/data/goods";
import { projects } from "@/data/projects";
import { woohyukmonKnowledge } from "@/data/woohyukmonKnowledge";

export function buildWoohyukmonContext() {
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

  const activitySummary = activities
    .slice(0, 6)
    .map((post) => `- ${post.title}: ${post.excerpt} URL: /our-activities/${post.slug}`)
    .join("\n");

  const boardSummary = activityBoards
    .map((board) => `- ${board.label}: ${board.description} URL: /our-activities/${board.slug}`)
    .join("\n");

  // TODO: merge database-backed knowledge, admin-managed FAQ, uploaded document search,
  // vector retrieval, and public post search into this compact context.
  return [
    "K_LINE KNOWLEDGE BASE",
    `Identity: ${woohyukmonKnowledge.identity.description}`,
    `Tracks: ${woohyukmonKnowledge.tracks.summary}`,
    "",
    "Track URLs:",
    ...woohyukmonKnowledge.tracks.items.map(
      (track) => `- ${track.name}: ${track.description} URL: ${track.href}`
    ),
    "",
    "Goods:",
    goodsSummary,
    "",
    "K-Culture Projects:",
    projectSummary,
    `Submission URL: ${woohyukmonKnowledge.kCultureProjects.submission.href}`,
    "",
    "International Clubs:",
    woohyukmonKnowledge.activities.summary,
    `Club writing URL: ${woohyukmonKnowledge.activities.writeHref}`,
    boardSummary,
    "",
    "ECC:",
    `${woohyukmonKnowledge.ecc.fullName}. ${woohyukmonKnowledge.ecc.description} URL: ${woohyukmonKnowledge.ecc.href}`,
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
  ].join("\n");
}
