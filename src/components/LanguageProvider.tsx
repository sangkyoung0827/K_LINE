"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type SiteLanguage = "en" | "ko";

type LanguageContextValue = {
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
  pick: (copy: { en: string; ko: string }) => string;
};

const languageStorageKey = "k_line_site_language";

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): SiteLanguage {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(languageStorageKey);

  if (stored === "ko" || stored === "en") {
    return stored;
  }

  return window.navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>("en");

  useEffect(() => {
    setLanguageState(getInitialLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "ko" ? "ko" : "en";
    window.localStorage.setItem(languageStorageKey, language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      pick: (copy) => copy[language]
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}

export function I18nText({ en, ko }: { en: string; ko: string }) {
  const { language } = useLanguage();

  return <>{language === "ko" ? ko : en}</>;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex border border-navy/12 bg-white/40 p-1" aria-label="Language selector">
      {(["en", "ko"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          className={`min-h-8 px-2.5 text-xs font-semibold transition ${
            language === item ? "bg-ink text-paper" : "text-ink/60 hover:bg-brass/15 hover:text-ink"
          }`}
          aria-pressed={language === item}
        >
          {item === "en" ? "EN" : "KR"}
        </button>
      ))}
    </div>
  );
}
