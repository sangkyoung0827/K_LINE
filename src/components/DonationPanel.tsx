"use client";

import { Banknote, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { I18nText, useLanguage } from "@/components/LanguageProvider";

type FundDisplay = {
  displayedBalance: number;
  updatedAt: string;
};

const emptyFund: FundDisplay = {
  displayedBalance: 0,
  updatedAt: ""
};

function formatKrw(value: number, locale: "en" | "ko") {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string, locale: "en" | "ko") {
  if (!value) {
    return locale === "ko" ? "아직 업데이트되지 않음" : "Not updated yet";
  }

  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DonationPanel({ canEdit }: { canEdit: boolean }) {
  const { language } = useLanguage();
  const [fund, setFund] = useState<FundDisplay>(emptyFund);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"error" | "saved" | "">("");

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/fund", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("ECC fund request failed");
        }
        return (await response.json()) as { fund?: Partial<FundDisplay> | null };
      })
      .then((data) => {
        if (!active) return;
        const nextFund = {
          displayedBalance: Number(data.fund?.displayedBalance ?? 0),
          updatedAt: data.fund?.updatedAt ?? ""
        };
        setFund(nextFund);
        setAmount(String(nextFund.displayedBalance || ""));
      })
      .catch(() => {
        if (active) setMessage("error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const saveFund = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || saving) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/ecc/fund", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayedBalance: Number(amount || 0) })
      });

      if (!response.ok) {
        throw new Error("ECC fund update failed");
      }

      const data = (await response.json()) as { fund?: Partial<FundDisplay> | null };
      const nextFund = {
        displayedBalance: Number(data.fund?.displayedBalance ?? amount ?? 0),
        updatedAt: data.fund?.updatedAt ?? new Date().toISOString()
      };
      setFund(nextFund);
      setAmount(String(nextFund.displayedBalance || ""));
      setMessage("saved");
    } catch {
      setMessage("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`grid gap-6 ${canEdit ? "lg:grid-cols-2" : "max-w-2xl"}`}>
      {canEdit ? (
        <form onSubmit={saveFund} className="paper-panel p-6 md:p-8">
          <p className="text-sm font-semibold uppercase text-brass">
            <I18nText en="Admin input" ko="관리자 입력" />
          </p>
          <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
            <I18nText en="Enter Current Fund" ko="현재 자금 수동 입력" />
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink/64">
            <I18nText
              en="Administrators can enter the current ECC balance manually."
              ko="관리자 이상 권한에서 현재 ECC 자금을 직접 입력할 수 있습니다."
            />
          </p>
          <label className="mt-6 block text-sm font-semibold text-ink" htmlFor="ecc-fund-amount">
            <I18nText en="Current fund (KRW)" ko="현재 자금 (원)" />
          </label>
          <input
            id="ecc-fund-amount"
            className="form-field mt-2 w-full"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value.replace(/[^0-9]/g, ""));
              setMessage("");
            }}
          />
          <button
            type="submit"
            disabled={saving}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save aria-hidden className="h-4 w-4" />
            {saving ? (
              <I18nText en="Saving..." ko="저장 중..." />
            ) : (
              <I18nText en="Save Current Fund" ko="현재 자금 저장" />
            )}
          </button>
          {message === "saved" ? (
            <p className="mt-4 text-sm font-semibold text-pine">
              <I18nText en="The current fund has been saved." ko="현재 자금이 저장되었습니다." />
            </p>
          ) : null}
          {message === "error" ? (
            <p className="mt-4 text-sm font-semibold text-red-700">
              <I18nText
                en="The fund could not be saved. Please try again."
                ko="자금을 저장하지 못했습니다. 다시 시도해 주세요."
              />
            </p>
          ) : null}
        </form>
      ) : null}

      <section className="paper-panel p-6 md:p-8" aria-live="polite">
        <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper">
          <Banknote aria-hidden className="h-5 w-5" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase text-brass">
          <I18nText en="ECC balance" ko="ECC 잔액" />
        </p>
        <h2 className="mt-3 font-serif text-3xl font-semibold text-ink">
          <I18nText en="Remaining Amount" ko="남은 금액" />
        </h2>
        <p className="mt-6 font-serif text-4xl font-semibold text-ink md:text-5xl">
          {loading ? "-" : formatKrw(fund.displayedBalance, language)}
        </p>
        <p className="mt-5 text-xs text-ink/50">
          <I18nText en="Last update" ko="마지막 업데이트" />: {formatDate(fund.updatedAt, language)}
        </p>
        {!canEdit && message === "error" ? (
          <p className="mt-4 text-sm text-red-700">
            <I18nText
              en="The remaining amount is temporarily unavailable."
              ko="남은 금액을 일시적으로 불러올 수 없습니다."
            />
          </p>
        ) : null}
      </section>
    </div>
  );
}
