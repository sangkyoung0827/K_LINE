# K_LINE

K_LINE is a standalone public K-culture platform website for Han-hwal, Korean traditional archery classes, Jeonbuk K-culture projects, and cultural goods.

Main message:

- 한국의 선, 유럽을 잇다
- Connecting Korean Lines to Europe

This project is intentionally independent from any existing Xtudy Universe project.

GitHub repository: `sangkyoung0827/K_LINE`

Default production URL target: `https://kline.vercel.app`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local goods and class data
- localStorage cart, booking, contact, and inquiry forms
- Inquiry-based commerce first
- No real payment, backend, email, database, or admin integration yet

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Development

```bash
npm run dev
```

## Test / Typecheck

```bash
npm run test
```

The test command currently runs TypeScript checks.

## Build

```bash
npm run build
```

## Deploy To Vercel

1. Push this repository to GitHub as `sangkyoung0827/K_LINE`.
2. In Vercel, choose **Add New Project**.
3. Import the `K_LINE` repository.
4. Use the default Next.js framework preset.
5. Add `NEXT_PUBLIC_SITE_URL` with the production domain, for example:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

6. Deploy.

## Google Search Console Setup

1. Deploy the site to Vercel.
2. Open Google Search Console.
3. Add the final production URL as a property.
4. Verify ownership using the Vercel-supported method or DNS record.
5. Submit the sitemap URL:

```text
https://your-domain.example/sitemap.xml
```

6. Check indexing status after deployment.

## Sitemap Submission

The app generates:

- `/sitemap.xml`
- `/robots.txt`

Update `NEXT_PUBLIC_SITE_URL` before production deployment so sitemap and robots URLs use the real domain.

## Routes

- `/`
- `/han-hwal`
- `/archery-class`
- `/k-culture-project`
- `/goods`
- `/goods/hanji-calligraphy-led-light-object`
- `/goods/arrow-pen`
- `/cart`
- `/checkout`
- `/contact`

## Data Files

- `src/data/goods.ts`
- `src/data/classes.ts`
- `src/data/navigation.ts`

## Future Integration Plan

Payment:

- Connect Stripe, Toss Payments, PayPal, or another provider after inquiry-first validation.
- Replace estimated price placeholders with confirmed SKU pricing and inventory logic.

Email:

- Send booking, contact, and goods inquiries through Resend, SendGrid, AWS SES, or a CRM.
- Add confirmation emails for users and internal notification emails for operators.

Backend:

- Add Next.js Route Handlers or a separate API service for form submissions.
- Validate payloads server-side and protect endpoints from spam.

Database:

- Store goods, class bookings, contacts, and order inquiries in PostgreSQL, Supabase, Neon, or another database.
- Move local data files to a CMS or admin-managed database when the catalog grows.

Admin:

- Add an authenticated admin dashboard for products, class schedules, bookings, inquiries, inventory, and publishing.
- Track inquiry status from received to confirmed to completed.

Search Indexing:

- Deploy publicly.
- Set the production `NEXT_PUBLIC_SITE_URL`.
- Submit `sitemap.xml` in Google Search Console.
- Add real image alt text and field documentation as actual assets become available.

## Notes

- Cart data is stored under `k_line_cart` in browser localStorage.
- Booking inquiries are stored under `k_line_archery_bookings`.
- Order inquiries are stored under `k_line_order_inquiries`.
- Contact inquiries are stored under `k_line_contact_inquiries`.
- These localStorage flows are placeholders for future backend and email integration.
