"use client";

import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";

type Notice = {
  content: string;
  id: string;
  is_pinned?: boolean | null;
  title: string;
  visibility?: string | null;
};

type Inquiry = {
  admin_note?: string | null;
  current_status: string;
  email: string;
  id: string;
  message: string;
  name: string;
  requested_activity: string;
  status?: string | null;
};

type RejoinRequest = {
  admin_note?: string | null;
  full_name: string;
  google_email: string;
  id: string;
  kakao_display_name: string;
  payment_confirmed?: boolean | null;
  status?: string | null;
};

export function EccAlumniNoticeAdminPanel() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [form, setForm] = useState({
    content: "",
    isPinned: false,
    title: "",
    visibility: "public"
  });
  const [message, setMessage] = useState("");

  const load = async () => {
    const data = await fetch("/api/ecc-alumni/notices").then((response) => response.json());
    setNotices(data.notices ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/ecc-alumni/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setNotices(data.notices ?? []);
    setMessage(response.ok ? "Notice saved." : data.error || "Save failed.");
    if (response.ok) setForm({ content: "", isPinned: false, title: "", visibility: "public" });
  };

  const remove = async (id: string) => {
    const data = await fetch(`/api/ecc-alumni/notices?id=${encodeURIComponent(id)}`, {
      method: "DELETE"
    }).then((response) => response.json());
    setNotices(data.notices ?? []);
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={create} className="paper-panel grid gap-4 p-5 md:p-8">
        <h2 className="font-serif text-3xl font-semibold text-ink">Create Alumni Notice</h2>
        <input required className="form-field" placeholder="Title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        <textarea required className="form-field min-h-32" placeholder="Content" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} />
        <div className="flex flex-wrap gap-3">
          <select className="form-field max-w-xs" value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}>
            <option value="public">public</option>
            <option value="logged_in_only">logged_in_only</option>
            <option value="alumni_only">alumni_only</option>
            <option value="official_member_only">official_member_only</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={form.isPinned} onChange={(event) => setForm((current) => ({ ...current, isPinned: event.target.checked }))} />
            Pin notice
          </label>
        </div>
        <button className="inline-flex min-h-11 w-fit items-center gap-2 bg-ink px-5 text-sm font-semibold text-paper">
          <Save aria-hidden className="h-4 w-4" />
          Save Notice
        </button>
        {message ? <p className="text-sm font-semibold text-pine">{message}</p> : null}
      </form>

      <div className="grid gap-3">
        {notices.map((notice) => (
          <article key={notice.id} className="paper-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-brass">{notice.visibility || "public"} {notice.is_pinned ? "/ pinned" : ""}</p>
                <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{notice.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink/64">{notice.content}</p>
              </div>
              <button onClick={() => remove(notice.id)} className="inline-flex h-10 w-10 items-center justify-center border border-red-200 text-red-700">
                <Trash2 aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function EccAlumniInquiryAdminPanel() {
  const [items, setItems] = useState<Inquiry[]>([]);

  const load = async () => {
    const data = await fetch("/api/ecc-alumni/inquiries").then((response) => response.json());
    setItems(data.inquiries ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (item: Inquiry, status: string) => {
    await fetch("/api/ecc-alumni/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_note: item.admin_note, id: item.id, status })
    });
    await load();
  };

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <article key={item.id} className="paper-panel p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-brass">{item.status || "submitted"} / {item.current_status}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{item.requested_activity}</h3>
              <p className="mt-2 text-sm text-ink/64">{item.name} / {item.email}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink/70">{item.message}</p>
            </div>
            <select value={item.status || "submitted"} onChange={(event) => save(item, event.target.value)} className="form-field max-w-xs">
              <option>submitted</option>
              <option>reviewing</option>
              <option>approved</option>
              <option>rejected</option>
              <option>replied</option>
            </select>
          </div>
          <textarea className="form-field mt-4 min-h-20" placeholder="Admin note" value={item.admin_note ?? ""} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, admin_note: event.target.value } : entry))} />
          <button onClick={() => save(item, item.status || "submitted")} className="mt-3 inline-flex min-h-10 items-center bg-ink px-4 text-sm font-semibold text-paper">Save note</button>
        </article>
      ))}
    </div>
  );
}

export function EccRejoinRequestAdminPanel() {
  const [items, setItems] = useState<RejoinRequest[]>([]);

  const load = async () => {
    const data = await fetch("/api/ecc-alumni/rejoin-requests").then((response) => response.json());
    setItems(data.requests ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (item: RejoinRequest, status: string) => {
    await fetch("/api/ecc-alumni/rejoin-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        admin_note: item.admin_note,
        id: item.id,
        payment_confirmed: item.payment_confirmed,
        status
      })
    });
    await load();
  };

  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <article key={item.id} className="paper-panel p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-brass">{item.status || "submitted"}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold text-ink">{item.full_name}</h3>
              <p className="mt-2 text-sm text-ink/64">{item.google_email} / Kakao: {item.kakao_display_name}</p>
            </div>
            <select value={item.status || "submitted"} onChange={(event) => save(item, event.target.value)} className="form-field max-w-xs">
              <option>submitted</option>
              <option>payment_pending</option>
              <option>payment_confirmed</option>
              <option>approved</option>
              <option>rejected</option>
            </select>
          </div>
          <label className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={Boolean(item.payment_confirmed)} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, payment_confirmed: event.target.checked } : entry))} />
            Payment confirmed
          </label>
          <textarea className="form-field mt-4 min-h-20" placeholder="Admin note" value={item.admin_note ?? ""} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, admin_note: event.target.value } : entry))} />
          <button onClick={() => save(item, item.status || "submitted")} className="mt-3 inline-flex min-h-10 items-center bg-ink px-4 text-sm font-semibold text-paper">Save request</button>
        </article>
      ))}
    </div>
  );
}
