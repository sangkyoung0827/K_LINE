"use client";

import {
  Banknote,
  CheckCircle2,
  HeartHandshake,
  Save,
  Send,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { I18nText, useLanguage } from "@/components/LanguageProvider";
import { adminStorageKeys } from "@/lib/adminStorageKeys";

const initialState = {
  name: "",
  email: "",
  affiliation: "",
  amountKrw: "",
  message: ""
};

type DonationPledge = {
  id: string;
  name: string;
  email: string;
  affiliation: string;
  amountKrw: number;
  message: string;
  status: "pledged" | "received";
  createdAt: string;
};

type BankDisplay = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  totalDonationKrw: number;
  displayedBalance: number;
  updatedAt: string;
};

const defaultBankDisplay: BankDisplay = {
  bankName: process.env.NEXT_PUBLIC_DONATION_BANK_NAME ?? "",
  accountNumber: process.env.NEXT_PUBLIC_DONATION_ACCOUNT_NUMBER ?? "",
  accountHolder: process.env.NEXT_PUBLIC_DONATION_ACCOUNT_HOLDER ?? "",
  totalDonationKrw: Number(process.env.NEXT_PUBLIC_DONATION_TOTAL_KRW ?? 0),
  displayedBalance: Number(process.env.NEXT_PUBLIC_DONATION_BALANCE_KRW ?? 0),
  updatedAt: ""
};

function formatKrw(value: number, locale: "en" | "ko" = "en") {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string, locale: "en" | "ko" = "en") {
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

function readDonationPledges() {
  try {
    const raw = window.localStorage.getItem(adminStorageKeys.donationPledges);
    return raw ? (JSON.parse(raw) as DonationPledge[]) : [];
  } catch {
    return [];
  }
}

export function DonationPanel() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);
  const [donations, setDonations] = useState<DonationPledge[]>([]);
  const [bankDisplay, setBankDisplay] = useState(defaultBankDisplay);
  const [bankForm, setBankForm] = useState({
    ...defaultBankDisplay,
    totalDonationKrw: String(defaultBankDisplay.totalDonationKrw || ""),
    displayedBalance: String(defaultBankDisplay.displayedBalance || "")
  });
  const { isSuperAdmin } = useSuperAdmin();
  const { language } = useLanguage();

  useEffect(() => {
    setDonations(readDonationPledges());

    try {
      const raw = window.localStorage.getItem(adminStorageKeys.bankSnapshot);
      if (!raw) {
        return;
      }
      const snapshot = JSON.parse(raw) as {
        bankName?: string;
        accountNumber?: string;
        accountHolder?: string;
        totalDonationKrw?: number;
        displayBalanceKrw?: number;
        updatedAt?: string;
      };
      const nextDisplay: BankDisplay = {
        bankName: snapshot.bankName ?? "",
        accountNumber: snapshot.accountNumber ?? "",
        accountHolder: snapshot.accountHolder ?? "",
        totalDonationKrw: snapshot.totalDonationKrw ?? 0,
        displayedBalance: snapshot.displayBalanceKrw ?? 0,
        updatedAt: snapshot.updatedAt ?? ""
      };
      setBankDisplay(nextDisplay);
      setBankForm({
        ...nextDisplay,
        totalDonationKrw: String(nextDisplay.totalDonationKrw || ""),
        displayedBalance: String(nextDisplay.displayedBalance || "")
      });
    } catch {
      // Keep the environment-configured display values.
    }
  }, []);

  const { accountHolder, accountNumber, bankName, displayedBalance, totalDonationKrw } =
    bankDisplay;
  const hasAccount = Boolean(bankName && accountNumber && accountHolder);

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pledge: DonationPledge = {
      id: `donation-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      affiliation: form.affiliation.trim(),
      amountKrw: Number(form.amountKrw || 0),
      message: form.message.trim(),
      status: "pledged",
      createdAt: new Date().toISOString()
    };
    const nextDonations = [pledge, ...donations];
    window.localStorage.setItem(adminStorageKeys.donationPledges, JSON.stringify(nextDonations));
    setDonations(nextDonations);
    setForm(initialState);
    setSuccess(true);
  };

  const saveBankDisplay = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextDisplay: BankDisplay = {
      bankName: bankForm.bankName.trim(),
      accountNumber: bankForm.accountNumber.trim(),
      accountHolder: bankForm.accountHolder.trim(),
      totalDonationKrw: Number(bankForm.totalDonationKrw || 0),
      displayedBalance: Number(bankForm.displayedBalance || 0),
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(
      adminStorageKeys.bankSnapshot,
      JSON.stringify({
        bankName: nextDisplay.bankName,
        accountNumber: nextDisplay.accountNumber,
        accountHolder: nextDisplay.accountHolder,
        totalDonationKrw: nextDisplay.totalDonationKrw,
        displayBalanceKrw: nextDisplay.displayedBalance,
        updatedAt: nextDisplay.updatedAt
      })
    );
    setBankDisplay(nextDisplay);
    setBankForm({
      ...nextDisplay,
      totalDonationKrw: String(nextDisplay.totalDonationKrw || ""),
      displayedBalance: String(nextDisplay.displayedBalance || "")
    });
  };

  const updateDonationStatus = (donationId: string, status: DonationPledge["status"]) => {
    const nextDonations = donations.map((donation) =>
      donation.id === donationId ? { ...donation, status } : donation
    );
    window.localStorage.setItem(adminStorageKeys.donationPledges, JSON.stringify(nextDonations));
    setDonations(nextDonations);
  };

  const deleteDonation = (donationId: string) => {
    const nextDonations = donations.filter((donation) => donation.id !== donationId);
    window.localStorage.setItem(adminStorageKeys.donationPledges, JSON.stringify(nextDonations));
    setDonations(nextDonations);
  };

  const updateBankForm = (field: keyof typeof bankForm, value: string) => {
    setBankForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="grid gap-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="paper-panel p-6 md:p-8">
          <div className="flex h-12 w-12 items-center justify-center bg-navy text-paper">
            <Banknote aria-hidden className="h-5 w-5" />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase text-brass">Donation account</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">
            <I18nText en="ECC Donations and Fund Status" ko="ECC 후원과 자금 현황" />
          </h2>
          <p className="mt-5 text-sm leading-7 text-ink/68">
            <I18nText
              en="Donations support ECC activities, K-culture projects, international clubs, and community programs."
              ko="후원금은 ECC 활동, K-컬처 프로젝트, 국제 학생 클럽, 커뮤니티 프로그램 운영 준비에 사용됩니다."
            />
          </p>

          <div className="mt-7 grid gap-3 border border-ink/10 bg-white/60 p-5 text-sm text-ink/70">
            {hasAccount ? (
              <>
                <p>
                  <span className="font-semibold text-ink">Bank:</span> {bankName}
                </p>
                <p>
                  <span className="font-semibold text-ink">Donation account:</span>{" "}
                  {accountNumber}
                </p>
                <p>
                  <span className="font-semibold text-ink">Holder:</span> {accountHolder}
                </p>
              </>
            ) : (
              <p className="leading-7">
                <I18nText
                  en="Donation account information has not been published yet. When the super admin enters it on this same page, it will appear here."
                  ko="후원 계좌 정보는 아직 공개 설정되지 않았습니다. 슈퍼관리자가 같은 페이지에서 계좌 정보를 입력하면 이곳에 표시됩니다."
                />
              </p>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="border border-brass/30 bg-brass/10 p-5">
              <p className="text-xs font-semibold uppercase text-ink/60">Total donations</p>
              <p className="mt-2 font-serif text-3xl font-semibold text-ink">
                {formatKrw(totalDonationKrw, language)}
              </p>
              <p className="mt-2 text-xs leading-6 text-ink/58">
                <I18nText
                  en="Total donation amount entered manually by the super admin."
                  ko="슈퍼관리자가 직접 입력한 후원금 총액입니다."
                />
              </p>
            </div>
            <div className="border border-brass/30 bg-brass/10 p-5">
              <p className="text-xs font-semibold uppercase text-ink/60">Remaining amount</p>
              <p className="mt-2 font-serif text-3xl font-semibold text-ink">
                {formatKrw(displayedBalance, language)}
              </p>
              <p className="mt-2 text-xs leading-6 text-ink/58">
                <I18nText
                  en="Public remaining amount entered manually by the super admin."
                  ko="일반회원에게 공개되는 남은 금액이며, 슈퍼관리자가 직접 입력합니다."
                />
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink/50">
            <I18nText en="Last update" ko="마지막 업데이트" />:{" "}
            {formatDate(bankDisplay.updatedAt, language)}
          </p>
        </section>

        <form onSubmit={submit} className="paper-panel grid gap-4 p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border border-ink/14">
              <HeartHandshake aria-hidden className="h-5 w-5 text-brass" />
            </span>
            <div>
              <h2 className="font-serif text-3xl font-semibold text-ink">
                <I18nText en="Donation Pledge" ko="후원 의향 등록" />
              </h2>
              <p className="text-sm text-ink/58">
                <I18nText
                  en="For professors, donors, and partner organizations"
                  ko="교수님, 후원자, 협력기관용"
                />
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <input
              required
              className="form-field"
              placeholder={language === "ko" ? "이름" : "Name"}
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
            placeholder={language === "ko" ? "대학 / 소속" : "University / affiliation"}
            value={form.affiliation}
            onChange={(event) => update("affiliation", event.target.value)}
          />
          <input
            required
            inputMode="numeric"
            className="form-field"
            placeholder={language === "ko" ? "후원 금액 KRW" : "Donation amount KRW"}
            value={form.amountKrw}
            onChange={(event) => update("amountKrw", event.target.value.replace(/[^0-9]/g, ""))}
          />
          <textarea
            className="form-field min-h-32"
            placeholder={language === "ko" ? "메시지" : "Message"}
            value={form.message}
            onChange={(event) => update("message", event.target.value)}
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy"
          >
            <Send aria-hidden className="h-4 w-4" />
            <I18nText en="Save Pledge" ko="후원 의향 저장" />
          </button>
          {success ? (
            <p className="text-sm font-semibold text-pine">
              <I18nText
                en="Donation pledge saved. Transfer confirmation, receipts, tax handling, and accounting still require the future admin process and official payment/accounting integration."
                ko="후원 의향이 저장되었습니다. 실제 이체 확인, 영수증, 세금 처리는 추후 관리자 절차와 공식 결제/회계 연동이 필요합니다."
              />
            </p>
          ) : null}
        </form>
      </div>

      {isSuperAdmin ? (
        <section className="paper-panel p-6 md:p-8">
          <p className="text-sm font-semibold uppercase text-brass">Super admin controls</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold text-ink">
            <I18nText en="Manage Donation Account and Displayed Amounts" ko="후원 계좌와 표시 금액 관리" />
          </h2>
          <p className="mt-4 text-sm leading-7 text-ink/64">
            <I18nText
              en="This admin area appears only when you are logged in as the super admin on the same ECC fund page. Total donations and remaining balance can be entered manually here."
              ko="같은 ECC 자금관리 주소에서 슈퍼관리자로 로그인한 경우에만 보이는 관리 영역입니다. 후원금 총액과 계좌 잔액은 여기서 직접 입력해 표시할 수 있습니다."
            />
          </p>

          <form onSubmit={saveBankDisplay} className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="form-field"
                placeholder="Bank name"
                value={bankForm.bankName}
                onChange={(event) => updateBankForm("bankName", event.target.value)}
              />
              <input
                className="form-field"
                placeholder="Account holder"
                value={bankForm.accountHolder}
                onChange={(event) => updateBankForm("accountHolder", event.target.value)}
              />
            </div>
            <input
              className="form-field"
              placeholder="Donation account number"
              value={bankForm.accountNumber}
              onChange={(event) => updateBankForm("accountNumber", event.target.value)}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="form-field"
                inputMode="numeric"
                placeholder="Total donations KRW"
                value={bankForm.totalDonationKrw}
                onChange={(event) =>
                  updateBankForm("totalDonationKrw", event.target.value.replace(/[^0-9]/g, ""))
                }
              />
              <input
                className="form-field"
                inputMode="numeric"
                placeholder="Remaining amount KRW"
                value={bankForm.displayedBalance}
                onChange={(event) =>
                  updateBankForm("displayedBalance", event.target.value.replace(/[^0-9]/g, ""))
                }
              />
            </div>
            <button
              type="submit"
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-ink px-5 py-3 text-sm font-semibold text-paper transition hover:bg-navy"
            >
              <Save aria-hidden className="h-4 w-4" />
              <I18nText en="Save Donation Display" ko="후원 표시 저장" />
            </button>
          </form>

          <div className="mt-8">
            <h3 className="font-serif text-3xl font-semibold text-ink">
              <I18nText en="Donation Pledge Management" ko="후원 의향 관리" />
            </h3>
            {donations.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {donations.map((donation) => (
                  <article key={donation.id} className="border border-ink/10 bg-white/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{donation.name}</p>
                        <p className="mt-1 text-sm text-ink/62">
                          {donation.email} /{" "}
                          {donation.affiliation ||
                            (language === "ko" ? "소속 없음" : "No affiliation")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-ink">
                          {formatKrw(donation.amountKrw, language)} / {donation.status}
                        </p>
                        <p className="mt-1 text-xs text-ink/50">
                          {formatDate(donation.createdAt, language)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateDonationStatus(donation.id, "received")}
                          className="inline-flex h-10 w-10 items-center justify-center border border-pine/20 text-pine hover:bg-pine/10"
                          aria-label="Mark donation received"
                        >
                          <CheckCircle2 aria-hidden className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDonation(donation.id)}
                          className="inline-flex h-10 w-10 items-center justify-center border border-red-900/20 text-red-700 hover:bg-red-50"
                          aria-label="Delete donation pledge"
                        >
                          <Trash2 aria-hidden className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {donation.message ? (
                      <p className="mt-3 text-sm leading-7 text-ink/62">{donation.message}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-ink/62">
                <I18nText
                  en="No donation pledges are saved in this browser yet."
                  ko="아직 이 브라우저에 저장된 후원 의향이 없습니다."
                />
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
