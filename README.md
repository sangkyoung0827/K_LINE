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
- Auth.js / NextAuth Google OAuth login
- Custom K_LINE logo, favicon, and campus K-culture dashboard UI
- Local goods, project, and activity data
- localStorage cart, inquiry checkout, project submission, and activity writing flows
- Inquiry-based commerce first
- No real payment, backend database, image upload, or admin moderation yet

## New Structure

Top navigation:

- Home
- Goods
- K-Culture Project
- Our Activities
- Cart
- Contact

Header account action:

- Login

Our Activities hover menu:

- ECC
- 한활 Hanhwal

ECC and Hanhwal free-board posts are saved in browser localStorage for this prototype.
Connect a real database and image storage before treating the boards as shared public data.

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
- `/our-activities/ecc`
- `/our-activities/hanhwal`
- `/our-activities/write`
- `/our-activities/han-hwal-korean-archery-experience-international-students`
- `/login`
- `/cart`
- `/checkout`
- `/contact`
- `/robots.txt`
- `/sitemap.xml`

## Data Files

- `src/data/goods.ts`
- `src/data/projects.ts`
- `src/data/activities.ts`
- `src/data/activityBoards.ts`
- `src/data/navigation.ts`

## Brand Assets

- `public/favicon.svg`
- `public/k-line-mark.svg`
- `public/k-line-logo.svg`
- `src/components/Logo.tsx`

## Components

Reusable UI components include:

- `Logo`
- `HeroSection`
- `DashboardCard`
- `ActivityPreviewCard`
- `GoodsPreviewCard`
- `GoodsCard`
- `ProjectCard`
- `ActivityPostCard`
- `ProjectSubmitForm`
- `ActivityWriteForm`
- `FreeBoardPage`
- `FreeBoardDetailPage`
- `AuthProvider`
- `AuthStatus`
- `LoginPanel`
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

## Google Login Setup

The login channel is implemented with Auth.js / NextAuth and Google OAuth.

Create a Google OAuth client in Google Cloud Console, then add these authorized redirect URIs:

```text
http://localhost:3000/api/auth/callback/google
https://kline-nine-wheat.vercel.app/api/auth/callback/google
https://your-custom-domain.example/api/auth/callback/google
```

Use the custom-domain redirect only after the domain is actually connected.

Create local environment variables from `.env.example`:

```bash
AUTH_SECRET=generated-secret
AUTH_GOOGLE_ID=google-client-id
AUTH_GOOGLE_SECRET=google-client-secret
NEXT_PUBLIC_SITE_URL=https://kline-nine-wheat.vercel.app
```

Generate `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

In Vercel, add the same environment variables under Project Settings > Environment Variables,
then redeploy the project. The login page exists at:

```text
/login
```

## Deploy To Vercel

Deploy this repository as a new standalone Vercel project.

Do not connect it to the Xtudy Universe Vercel project.

Recommended Vercel settings:

- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: Next.js default
- Install command: `npm install`
- Environment variables required for Google login: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

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
- member profile database after Google authentication
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
