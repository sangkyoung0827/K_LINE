import { CTAButton } from "@/components/CTAButton";

export default function NotFound() {
  return (
    <section className="bg-paper px-5 py-20 text-center md:px-8">
      <h1 className="font-serif text-5xl font-semibold text-ink">Page not found</h1>
      <p className="mx-auto mt-4 max-w-xl text-ink/68">
        The requested K_LINE page does not exist yet.
      </p>
      <div className="mt-8">
        <CTAButton href="/">Return Home</CTAButton>
      </div>
    </section>
  );
}
