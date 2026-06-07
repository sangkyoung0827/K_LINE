"use client";

import { useMemo, useState } from "react";
import { CTAButton } from "@/components/CTAButton";
import { useCart } from "@/components/CartProvider";

const initialState = {
  name: "",
  email: "",
  phone: "",
  country: "",
  address: "",
  message: ""
};

type InquiryFormProps = {
  mode?: "checkout" | "general";
  title?: string;
};

export function InquiryForm({ mode = "general", title = "Inquiry Form" }: InquiryFormProps) {
  const { items, estimatedTotalEur, clearCart } = useCart();
  const [form, setForm] = useState(initialState);
  const [success, setSuccess] = useState(false);

  const selectedGoods = useMemo(
    () =>
      items.map((item) => ({
        slug: item.slug,
        name: item.name,
        koreanName: item.koreanName,
        quantity: item.quantity,
        estimatedPriceEur: item.estimatedPriceEur
      })),
    [items]
  );

  const update = (field: keyof typeof initialState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...form,
      selectedGoods,
      estimatedTotalEur,
      createdAt: new Date().toISOString()
    };
    const key = mode === "checkout" ? "k_line_order_inquiries" : "k_line_general_inquiries";
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]") as typeof payload[];
    window.localStorage.setItem(key, JSON.stringify([...existing, payload]));
    // Future integration point: connect this inquiry to backend persistence, email automation, payment requests, and admin management.
    setForm(initialState);
    setSuccess(true);
    if (mode === "checkout") {
      clearCart();
    }
  };

  return (
    <form onSubmit={submit} className="paper-panel grid gap-4 p-5 md:p-8">
      <div>
        <h2 className="font-serif text-3xl font-semibold text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-ink/68">
          This is an inquiry-based flow. No real payment is connected yet.
        </p>
      </div>

      {mode === "checkout" ? (
        <div className="border border-ink/12 bg-white/50 p-4">
          <p className="text-sm font-semibold text-ink">Selected goods</p>
          {items.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-sm text-ink/70">
              {items.map((item) => (
                <li key={item.slug}>
                  {item.name} / {item.koreanName} x {item.quantity}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink/62">No goods selected.</p>
          )}
          <p className="mt-3 text-sm font-semibold text-ink">Estimated total: EUR {estimatedTotalEur}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <input required className="form-field" placeholder="Name" value={form.name} onChange={(event) => update("name", event.target.value)} />
        <input required type="email" className="form-field" placeholder="Email" value={form.email} onChange={(event) => update("email", event.target.value)} />
        <input className="form-field" placeholder="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
        <input className="form-field" placeholder="Country" value={form.country} onChange={(event) => update("country", event.target.value)} />
      </div>
      {mode === "checkout" ? (
        <textarea className="form-field min-h-24" placeholder="Address" value={form.address} onChange={(event) => update("address", event.target.value)} />
      ) : null}
      <textarea className="form-field min-h-32" placeholder="Message" value={form.message} onChange={(event) => update("message", event.target.value)} />
      <div>
        <CTAButton type="submit">Submit Inquiry</CTAButton>
      </div>
      {success ? (
        <p className="text-sm font-semibold text-pine">
          Inquiry saved locally. Real email, payment, database, and admin features can be connected later.
        </p>
      ) : null}
    </form>
  );
}
