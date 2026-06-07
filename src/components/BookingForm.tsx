"use client";

import { useState } from "react";
import { classes } from "@/data/classes";
import { CTAButton } from "@/components/CTAButton";

const initialState = {
  name: "",
  email: "",
  phone: "",
  nationality: "",
  preferredDate: "",
  participants: "1",
  classType: classes[0]?.title ?? "",
  message: ""
};

export function BookingForm() {
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = { ...form, createdAt: new Date().toISOString() };
    const key = "k_line_archery_bookings";
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as typeof payload[];
    window.localStorage.setItem(key, JSON.stringify([...existing, payload]));
    // Future integration point: send this payload to a backend route, email service, CRM, or database.
    setForm(initialState);
    setSuccess(true);
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">Book Archery Class</h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          Submit an inquiry for Korean traditional archery lessons. The team can confirm schedule,
          language support, group size, and price later.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input required className="form-field" placeholder="Name" value={form.name} onChange={(event) => update("name", event.target.value)} />
        <input required type="email" className="form-field" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
        <input className="form-field" placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
        <input className="form-field" placeholder="Nationality" value={form.nationality} onChange={(event) => update("nationality", event.target.value)} />
        <input className="form-field" type="date" value={form.preferredDate} onChange={(event) => update("preferredDate", event.target.value)} />
        <input className="form-field" type="number" min="1" placeholder="Number of participants" value={form.participants} onChange={(event) => update("participants", event.target.value)} />
      </div>
      <select className="form-field" value={form.classType} onChange={(event) => update("classType", event.target.value)}>
        {classes.map((item) => (
          <option key={item.id} value={item.title}>
            {item.title}
          </option>
        ))}
      </select>
      <textarea className="form-field min-h-32" placeholder="Message" value={form.message} onChange={(event) => update("message", event.target.value)} />
      <div>
        <CTAButton type="submit">Submit Booking Inquiry</CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">Booking inquiry saved locally. Backend/email integration can be connected later.</p>
      ) : null}
    </form>
  );
}
