# K_LINE

K_LINE is a standalone Korean cultural dashboard platform for:

1. Goods / 상품
2. K-Culture Project / K-컬처 프로젝트
3. Our Activities / 우리의 활동들

Main message:

- 한국의 선, 유럽을 잇다
- Connecting Korean Lines to Europe

This project is independent from Xtudy Universe and should be deployed as a standalone Vercel project.

GitHub repository: `sangkyoung0827/K_LINE`

Default production URL target: `https://kline-nine-wheat.vercel.app`

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local goods, project, and activity data
- localStorage cart, inquiry checkout, project submission, and activity writing flows
- Inquiry-based commerce first
- No real payment, authentication, backend, database, image upload, or admin moderation yet

## New Structure

Top navigation:

- Home
- Goods
- K-Culture Project
- Our Activities
- Cart
- Contact

Han-hwal is no longer a top-level menu item. It has moved under:

```text
/k-culture-project/han-hwal
```

The old route redirects:

```text
/han-hwal -> /k-culture-project/han-hwal
```

## Routes To Test

- `/`
- `/goods`
- `/goods/hanji-calligraphy-led-light-object`
- `/goods/arrow-pen`
- `/k-culture-project`
- `/k-culture-project/submit`
- `/k-culture-project/han-hwal`
- `/k-culture-project/connecting-korean-lines-to-europe`
- `/our-activities`
- `/our-activities/write`
- `/our-activities/han-hwal-korean-archery-experience-international-students`
- `/cart`
- `/checkout`
- `/contact`
- `/robots.txt`
- `/sitemap.xml`

## Data Files

- `src/data/goods.ts`
- `src/data/projects.ts`
- `src/data/activities.ts`
- `src/data/navigation.ts`

## Components

Reusable UI components include:

- `DashboardCard`
- `GoodsCard`
- `ProjectCard`
- `ActivityPostCard`
- `ProjectSubmitForm`
- `ActivityWriteForm`
- `SectionHeader`
- `EmptyState`
- `TagBadge`
- `CategoryBadge`
- `CTAButton`

## Local Setup

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Typecheck

```bash
npm run typecheck
```

## Deploy To Vercel

Deploy this repository as a new standalone Vercel project.

Do not connect it to the Xtudy Universe Vercel project.

Recommended Vercel settings:

- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: Next.js default
- Install command: `npm install`
- Environment variables required now: none

Optional production environment variable:

```bash
NEXT_PUBLIC_SITE_URL=https://your-custom-domain.example
```

Set this only after connecting a real custom domain.

## SEO And Search

The project includes:

- page metadata title and description
- Open Graph metadata
- semantic headings
- clean URL slugs
- image alt text
- `robots.txt`
- `sitemap.xml`
- Organization JSON-LD
- Product JSON-LD
- Project CreativeWork JSON-LD
- Activity Article JSON-LD

## Placeholder / Future Integration Checklist

The following are intentionally placeholder flows:

- real payment
- email sending
- database persistence
- authentication
- admin dashboard
- admin moderation
- spam protection
- order management
- class booking management
- project submission review workflow
- activity post moderation workflow
- image upload and storage
- product inventory
- real product and activity images
- custom domain
- Google Analytics
- Google Search Console verification

## Google Search Console Setup

After Vercel deployment:

1. Connect a custom domain in Vercel if needed.
2. Set `NEXT_PUBLIC_SITE_URL` to the final domain.
3. Redeploy.
4. Add the site to Google Search Console.
5. Verify ownership with DNS TXT or Vercel-supported verification.
6. Submit:

```text
https://your-domain.example/sitemap.xml
```

7. Use URL Inspection to request indexing for the home page and important section pages.
8. Confirm Google can crawl the site by checking URL Inspection and robots/sitemap status.
