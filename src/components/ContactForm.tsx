"use client";

import { useState } from "react";
import { CTAButton } from "@/components/CTAButton";

const initialState = {
  inquiryType: "General inquiry",
  name: "",
  email: "",
  message: ""
};

export function ContactForm() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...form, createdAt: new Date().toISOString() };
    const key = "k_line_contact_inquiries";
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as typeof payload[];
    window.localStorage.setItem(key, JSON.stringify([...existing, payload]));
    // Future integration point: forward contact inquiries to email, backend storage, and admin dashboard queues.
    setForm(initialState);
    setSuccess(true);
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <h2 className="font-serif text-3xl font-semibold text-ink">Contact K_LINE</h2>
      <select className="form-field" value={form.inquiryType} onChange={(event) => update("inquiryType", event.target.value)}>
        <option>General inquiry</option>
        <option>Han-hwal inquiry</option>
        <option>Archery class inquiry</option>
        <option>Goods inquiry</option>
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <input required className="form-field" placeholder="Name" value={form.name} onChange={(event) => update("name", event.target.value)} />
        <input required type="email" className="form-field" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
      </div>
      <textarea required className="form-field min-h-36" placeholder="Message" value={form.message} onChange={(event) => update("message", event.target.value)} />
      <div>
        <CTAButton type="submit">Send Contact Inquiry</CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">Contact inquiry saved locally. Email/backend connection can be added later.</p>
      ) : null}
    </form>
  );
}
