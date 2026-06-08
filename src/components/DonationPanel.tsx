"use client";

import { Banknote, HeartHandshake, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { adminStorageKeys } from "@/lib/adminStorageKeys";

const initialState = {
  name: "",
  email: "",
  affiliation: "",
  amountKrw: "",
  message: ""
};

function formatKrw(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

export function DonationPanel() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);
  const [bankDisplay, setBankDisplay] = useState({
    bankName: process.env.NEXT_PUBLIC_DONATION_BANK_NAME ?? "",
    accountNumber: process.env.NEXT_PUBLIC_DONATION_ACCOUNT_NUMBER ?? "",
    accountHolder: process.env.NEXT_PUBLIC_DONATION_ACCOUNT_HOLDER ?? "",
    displayedBalance: Number(process.env.NEXT_PUBLIC_DONATION_BALANCE_KRW ?? 0)
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(adminStorageKeys.bankSnapshot);
      if (!raw) {
        return;
      }
      const snapshot = JSON.parse(raw) as {
        bankName?: string;
        accountNumber?: string;
        accountHolder?: string;
        displayBalanceKrw?: number;
      };
      setBankDisplay({
        bankName: snapshot.bankName ?? "",
        accountNumber: snapshot.accountNumber ?? "",
        accountHolder: snapshot.accountHolder ?? "",
        displayedBalance: snapshot.displayBalanceKrw ?? 0
      });
    } catch {
      // Keep the environment-configured display values.
    }
  }, []);

  const { accountHolder, accountNumber, bankName, displayedBalance } = bankDisplay;
  const hasAccount = Boolean(bankName && accountNumber && accountHolder);

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pledge = {
      id: `donation-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      affiliation: form.affiliation.trim(),
      amountKrw: Number(form.amountKrw || 0),
      message: form.message.trim(),
      status: "pledged",
      createdAt: new Date().toISOString()
    };
    const existing = JSON.parse(
      window.localStorage.getItem(adminStorageKeys.donationPledges) ?? "[]"
    ) as typeof pledge[];
    window.localStorage.setItem(adminStorageKeys.donationPledges, JSON.stringify([pledge, ...existing]));
    setForm(initialState);
    setSuccess(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="paper-panel p-6 md:p-8">
        <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper">
          <Banknote aria-hidden className="h-5 w-5" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase text-brass">Donation account</p>
        <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">Support K_LINE</h2>
        <p className="mt-5 text-sm leading-7 text-ink/68">
          후원금은 K-culture project, student activities, goods prototyping, and community programs
          운영 준비에 사용됩니다.
        </p>

        <div className="mt-7 grid gap-3 border border-ink/10 bg-white/60 p-5 text-sm text-ink/70">
          {hasAccount ? (
            <>
              <p>
                <span className="font-semibold text-ink">Bank:</span> {bankName}
              </p>
              <p>
                <span className="font-semibold text-ink">Account:</span> {accountNumber}
              </p>
              <p>
                <span className="font-semibold text-ink">Holder:</span> {accountHolder}
              </p>
            </>
          ) : (
            <p className="leading-7">
              후원 계좌 정보는 아직 공개 설정되지 않았습니다. 관리자에게 계좌 정보를 설정해 달라고
              요청해 주세요.
            </p>
          )}
        </div>

        <div className="mt-5 border border-brass/30 bg-brass/10 p-5">
          <p className="text-xs font-semibold uppercase text-ink/60">Displayed balance</p>
          <p className="mt-2 font-serif text-3xl font-semibold text-ink">
            {formatKrw(displayedBalance)}
          </p>
          <p className="mt-2 text-xs leading-6 text-ink/58">
            This is a manually configured public display value until official bank API integration is connected.
          </p>
        </div>
      </section>

      <form onSubmit={submit} className="paper-panel grid gap-4 p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center border border-ink/14">
            <HeartHandshake aria-hidden className="h-5 w-5 text-brass" />
          </span>
          <div>
            <h2 className="font-serif text-3xl font-semibold text-ink">Donation Pledge</h2>
            <p className="text-sm text-ink/58">교수님, 후원자, 협력기관용</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            required
            className="form-field"
            placeholder="Name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
          />
          <input
            required
            type="email"
            className="form-field"
            placeholder="Email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </div>
        <input
          className="form-field"
          placeholder="University / affiliation"
          value={form.affiliation}
          onChange={(event) => update("affiliation", event.target.value)}
        />
        <input
          required
          inputMode="numeric"
          className="form-field"
          placeholder="Donation amount KRW"
          value={form.amountKrw}
          onChange={(event) => update("amountKrw", event.target.value.replace(/[^0-9]/g, ""))}
        />
        <textarea
          className="form-field min-h-32"
          placeholder="Message"
          value={form.message}
          onChange={(event) => update("message", event.target.value)}
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy"
        >
          <Send aria-hidden className="h-4 w-4" />
          Save Pledge
        </button>
        {success ? (
          <p className="text-sm font-semibold text-pine">
            후원 의향이 저장되었습니다. 실제 이체 확인, 영수증, 세금 처리는 추후 관리자 절차와
            공식 결제/회계 연동이 필요합니다.
          </p>
        ) : null}
      </form>
    </div>
  );
}
