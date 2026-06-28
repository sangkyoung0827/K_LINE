"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

const initialForm = {
  currentStatus: "previous ECC member",
  departmentOrMajor: "",
  fullName: "",
  kakaoDisplayName: "",
  kakaoId: "",
  message: "",
  nationality: "",
  studentId: ""
};

export function EccRejoinRequestForm() {
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/ecc-alumni/rejoin-requests")
      .then((response) => response.json())
      .then((data) => {
        setEligible(Boolean(data.eligible));
        setLoggedIn(Boolean(data.access?.isLoggedIn));
      })
      .catch(() => setEligible(false));
  }, []);

  const update = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/ecc-alumni/rejoin-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Rejoin request could not be submitted.");
      }

      setForm(initialForm);
      setMessage("Your rejoin request has been submitted. Please wait for officer review and payment confirmation.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="paper-panel p-6">
        <h2 className="font-serif text-3xl font-semibold text-ink">Login required</h2>
        <p className="mt-3 text-sm leading-7 text-ink/64">
          Please log in with Google before submitting a Rejoin ECC request.
        </p>
        <Link href="/login?callbackUrl=/ecc-alumni/rejoin" className="mt-5 inline-flex min-h-11 items-center bg-ink px-5 text-sm font-semibold text-paper">
          Log in to continue
        </Link>
      </div>
    );
  }

  if (eligible === false) {
    return (
      <div className="paper-panel p-6">
        <h2 className="font-serif text-3xl font-semibold text-ink">New to ECC?</h2>
        <p className="mt-3 text-sm leading-7 text-ink/64">
          If you are new to ECC, please use New Member Registration instead.
        </p>
        <Link href="/ecc-join" className="mt-5 inline-flex min-h-11 items-center bg-ink px-5 text-sm font-semibold text-paper">
          New Member Registration
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div className="grid gap-4 md:grid-cols-2">
        <input required className="form-field" placeholder="Full name" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} />
        <input className="form-field" placeholder="Student ID (optional)" value={form.studentId} onChange={(event) => update("studentId", event.target.value)} />
        <input required className="form-field" placeholder="Department or major" value={form.departmentOrMajor} onChange={(event) => update("departmentOrMajor", event.target.value)} />
        <input required className="form-field" placeholder="Nationality" value={form.nationality} onChange={(event) => update("nationality", event.target.value)} />
        <input required className="form-field" placeholder="KakaoTalk display name" value={form.kakaoDisplayName} onChange={(event) => update("kakaoDisplayName", event.target.value)} />
        <input required className="form-field" placeholder="Kakao ID" value={form.kakaoId} onChange={(event) => update("kakaoId", event.target.value)} />
        <select className="form-field md:col-span-2" value={form.currentStatus} onChange={(event) => update("currentStatus", event.target.value)}>
          <option>current student</option>
          <option>exchange student</option>
          <option>graduate</option>
          <option>previous ECC member</option>
          <option>other</option>
        </select>
        <textarea className="form-field min-h-28 md:col-span-2" placeholder="Message (optional)" value={form.message} onChange={(event) => update("message", event.target.value)} />
      </div>
      <button disabled={loading || eligible === null} className="inline-flex min-h-11 w-fit items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-60">
        <Send aria-hidden className="h-4 w-4" />
        Submit Rejoin Request
      </button>
      {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}
