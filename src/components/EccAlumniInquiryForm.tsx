"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";

const initialForm = {
  availability: "",
  currentStatus: "non-member",
  kakaoDisplayName: "",
  message: "",
  name: "",
  requestedActivity: ""
};

export function EccAlumniInquiryForm() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/ecc-alumni/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error || "Inquiry could not be submitted.");
      }

      setForm(initialForm);
      setMessage(
        data.message ||
          "Your inquiry has been submitted. ECC officers will review it and contact you if participation is possible."
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Name
          <input required className="form-field" value={form.name} onChange={(event) => update("name", event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          KakaoTalk display name
          <input required className="form-field" value={form.kakaoDisplayName} onChange={(event) => update("kakaoDisplayName", event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Current status
          <select className="form-field" value={form.currentStatus} onChange={(event) => update("currentStatus", event.target.value)}>
            <option value="current ECC member">Current ECC member</option>
            <option value="previous ECC member">Previous ECC member</option>
            <option value="alumni">Alumni</option>
            <option value="JBNU student">JBNU student</option>
            <option value="international student">International student</option>
            <option value="non-member">Non-member</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink">
          Requested activity
          <input required className="form-field" value={form.requestedActivity} onChange={(event) => update("requestedActivity", event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink md:col-span-2">
          Availability
          <input className="form-field" value={form.availability} onChange={(event) => update("availability", event.target.value)} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink md:col-span-2">
          Message / reason
          <textarea required className="form-field min-h-32" value={form.message} onChange={(event) => update("message", event.target.value)} />
        </label>
      </div>
      <button disabled={loading} className="inline-flex min-h-11 w-fit items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper transition hover:bg-navy disabled:opacity-60">
        <Send aria-hidden className="h-4 w-4" />
        Submit Activity Inquiry
      </button>
      {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}
      {error ? (
        <p className="text-sm font-semibold text-red-700">
          {error}{" "}
          <Link href="/login?callbackUrl=/ecc-alumni/activity-inquiry" className="underline">
            Log in
          </Link>
        </p>
      ) : null}
    </form>
  );
}

export function EccAlumniStatusList() {
  const [data, setData] = useState<{
    inquiries?: Array<{ id: string; requested_activity?: string; status?: string; created_at?: string }>;
    requests?: Array<{ id: string; status?: string; full_name?: string; created_at?: string }>;
  }>({});

  useEffect(() => {
    void Promise.all([
      fetch("/api/ecc-alumni/inquiries").then((response) => response.json()).catch(() => ({})),
      fetch("/api/ecc-alumni/rejoin-requests").then((response) => response.json()).catch(() => ({}))
    ]).then(([inquiryData, requestData]) => {
      setData({
        inquiries: inquiryData.inquiries ?? [],
        requests: requestData.requests ?? []
      });
    });
  }, []);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="paper-panel p-5">
        <h2 className="font-serif text-2xl font-semibold text-ink">My Activity Inquiries</h2>
        <div className="mt-4 grid gap-3">
          {(data.inquiries ?? []).length > 0 ? (
            data.inquiries?.map((item) => (
              <div key={item.id} className="border border-ink/10 bg-white/55 p-3 text-sm">
                <p className="font-semibold text-ink">{item.requested_activity}</p>
                <p className="mt-1 text-ink/60">Status: {item.status}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink/60">No inquiry history yet.</p>
          )}
        </div>
      </section>
      <section className="paper-panel p-5">
        <h2 className="font-serif text-2xl font-semibold text-ink">My Rejoin Requests</h2>
        <div className="mt-4 grid gap-3">
          {(data.requests ?? []).length > 0 ? (
            data.requests?.map((item) => (
              <div key={item.id} className="border border-ink/10 bg-white/55 p-3 text-sm">
                <p className="font-semibold text-ink">{item.full_name}</p>
                <p className="mt-1 text-ink/60">Status: {item.status}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink/60">No rejoin request history yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
