import type { ComponentType, CSSProperties } from "react";
import type { ClubDocument, ClubSection } from "@/types/club-page";
import { THEME_PRESETS } from "@/lib/club-page/config";
import { SECTION_RENDERERS } from "./renderer-registry";
import styles from "./club-page.module.css";

export function ClubWebsiteRenderer({ document }: { document: ClubDocument }) {
  const theme = THEME_PRESETS.find(item => item.id === document.themeId) || THEME_PRESETS[0];
  const variables = { "--club-primary": theme.primary, "--club-on-primary": theme.id === "warm" || theme.id === "nature" ? "#111111" : "#ffffff", "--club-background": theme.background, "--club-foreground": theme.foreground, "--club-muted": theme.muted, "--club-surface": theme.surface } as CSSProperties;
  return <div className={styles.website} style={variables}>
    {document.sections.map(section => {
      // The discriminated schema is validated before rendering. Registry keys retain that pairing.
      const Renderer = SECTION_RENDERERS[section.type] as ComponentType<{ data: ClubSection["data"] }>;
      return <Renderer key={section.id} data={section.data} />;
    })}
  </div>;
}
