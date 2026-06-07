import Link from "next/link";
import { navigation } from "@/data/navigation";
import { siteConfig } from "@/lib/seo";

export function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:px-8">
        <div>
          <p className="text-xl font-semibold">K_LINE</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-paper/70">
            한국의 선, 유럽을 잇다. A public Korean cultural platform for Han-hwal,
            Korean traditional archery, Jeonbuk K-culture, Hanji, calligraphy, and goods.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-paper">Menu</p>
          <div className="grid gap-2">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-paper/68 hover:text-paper">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-paper">Contact</p>
          <div className="grid gap-2 text-sm text-paper/68">
            <span>{siteConfig.emailPlaceholder}</span>
            <a href={siteConfig.youtube} target="_blank" rel="noreferrer" className="hover:text-paper">
              YouTube @Weirdsang
            </a>
            <span>{siteConfig.instagramPlaceholder}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-paper/12 px-5 py-5 text-center text-xs text-paper/50">
        © {new Date().getFullYear()} K_LINE. Inquiry-based commerce. No payment integration yet.
      </div>
    </footer>
  );
}
