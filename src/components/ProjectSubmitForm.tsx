"use client";

import { useState } from "react";
import { CTAButton } from "@/components/CTAButton";

const initialState = {
  projectTitle: "",
  englishTitle: "",
  teamOrAuthor: "",
  category: "",
  countryOrCity: "",
  shortDescription: "",
  fullDescription: "",
  contactEmail: "",
  imageUrl: "",
  tags: "",
  message: ""
};

export function ProjectSubmitForm() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...form, createdAt: new Date().toISOString(), status: "pending-review" };
    const key = "k_line_project_submissions";
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as typeof payload[];
    window.localStorage.setItem(key, JSON.stringify([...existing, payload]));
    // Future integration point: connect database, authentication, admin moderation,
    // image upload/storage, spam protection, and email notification before public publishing.
    setForm(initialState);
    setSuccess(true);
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">Submit a K-Culture Project</h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          Submissions are locally saved and marked pending review. Public posting, moderation,
          image upload, and database storage should be connected later.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input required className="form-field" placeholder="Project title" value={form.projectTitle} onChange={(event) => update("projectTitle", event.target.value)} />
        <input className="form-field" placeholder="English title" value={form.englishTitle} onChange={(event) => update("englishTitle", event.target.value)} />
        <input required className="form-field" placeholder="Team or author name" value={form.teamOrAuthor} onChange={(event) => update("teamOrAuthor", event.target.value)} />
        <input className="form-field" placeholder="Category" value={form.category} onChange={(event) => update("category", event.target.value)} />
        <input className="form-field" placeholder="Country or city" value={form.countryOrCity} onChange={(event) => update("countryOrCity", event.target.value)} />
        <input required type="email" className="form-field" placeholder="Contact email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} />
      </div>
      <textarea required className="form-field min-h-24" placeholder="Short description" value={form.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} />
      <textarea required className="form-field min-h-40" placeholder="Full description" value={form.fullDescription} onChange={(event) => update("fullDescription", event.target.value)} />
      <input className="form-field" placeholder="Image URL or image upload placeholder" value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} />
      <input className="form-field" placeholder="Tags, separated by commas" value={form.tags} onChange={(event) => update("tags", event.target.value)} />
      <textarea className="form-field min-h-28" placeholder="Message" value={form.message} onChange={(event) => update("message", event.target.value)} />
      <div>
        <CTAButton type="submit">Submit Pending Project</CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">
          Project submission saved locally and marked pending review.
        </p>
      ) : null}
    </form>
  );
}
