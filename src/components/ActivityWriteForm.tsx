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
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setError("");

    try {
      const response = await fetch("/api/activity-posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Activity post could not be saved.");
      }

      setForm(initialState);
      setSuccess(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Activity post could not be saved."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">Write an Activity Post</h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          Submitted posts are saved for pending review. Public posting stays separate from this
          submission flow until moderation is complete.
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
        <CTAButton type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Pending Post"}
        </CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">
          Activity post saved to Supabase and marked pending review.
        </p>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </form>
  );
}
