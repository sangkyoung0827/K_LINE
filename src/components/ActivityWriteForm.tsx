"use client";

import { useState } from "react";
import { CTAButton } from "@/components/CTAButton";

const categories = ["News", "Activity Log", "Review", "Field Note", "Free Board"];

const initialState = {
  title: "",
  category: categories[0],
  authorName: "",
  email: "",
  content: "",
  imageUrl: "",
  tags: ""
};

export function ActivityWriteForm() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...form, createdAt: new Date().toISOString(), status: "pending-review" };
    const key = "k_line_activity_submissions";
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as typeof payload[];
    window.localStorage.setItem(key, JSON.stringify([...existing, payload]));
    // Future integration point: connect database, authentication, moderation,
    // image upload/storage, spam protection, and email notification before public publishing.
    setForm(initialState);
    setSuccess(true);
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">Write an Activity Post</h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          Submitted posts are locally saved as pending review. Public posting should use backend
          moderation and spam protection before launch.
        </p>
      </div>
      <input required className="form-field" placeholder="Title" value={form.title} onChange={(event) => update("title", event.target.value)} />
      <div className="grid gap-4 md:grid-cols-2">
        <select className="form-field" value={form.category} onChange={(event) => update("category", event.target.value)}>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
        <input required className="form-field" placeholder="Author name" value={form.authorName} onChange={(event) => update("authorName", event.target.value)} />
        <input required type="email" className="form-field" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
        <input className="form-field" placeholder="Image URL or image upload placeholder" value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} />
      </div>
      <textarea required className="form-field min-h-56" placeholder="Content" value={form.content} onChange={(event) => update("content", event.target.value)} />
      <input className="form-field" placeholder="Tags, separated by commas" value={form.tags} onChange={(event) => update("tags", event.target.value)} />
      <div>
        <CTAButton type="submit">Submit Pending Post</CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">
          Activity post saved locally and marked pending review.
        </p>
      ) : null}
    </form>
  );
}
