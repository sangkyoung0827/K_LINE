# K_LINE

K_LINE is a standalone Korean cultural dashboard platform for:

1. Goods / 상품
2. K-Culture Project / K-컬처 프로젝트
3. International Clubs / 국제 학생 클럽

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
- Woohyukmon AI assistant with server-side OpenAI API route
- Custom K_LINE logo, favicon, and campus K-culture dashboard UI
- Local goods, project, and international club data
- localStorage cart and inquiry checkout flows
- Supabase-backed K-Culture Project submissions, Our Activities post submissions, and ECC applications
- Role-aware super-admin prototype inside the same public site pages for local post deletion, donation account editing, donation total display, and account balance display
- Inquiry-based commerce first
- No real payment, backend database, image upload, bank API, or shared server-side admin moderation yet

## New Structure

Top navigation:

- Home
- Goods
- K-Culture Project
- International Clubs
- Cart
- Contact

Header account action:

- Login

International Clubs hover menu:

- ECC
- 한활 Hanhwal

ECC now opens a club menu with three choices:

- ECC free board: `/our-activities/ecc/free-board`
- ECC activity: `/our-activities/ecc/activity`
- ECC fund management: `/our-activities/ecc/fund`

The ECC activity page supports a Korean/English language selector. In English
mode, English Excel headers such as `Name`, `Affiliation`, `Gathering`, `MT`,
`Special Events`, and `Note` are parsed, team names use `Team 1`, `Team 2`, and
the KakaoTalk-ready notice draft is generated in English.

The ECC activity page also includes Google-Forms-style applications for
International Gathering, MT, and Special Event. Applicants answer KakaoTalk name,
gender, nationality, preferred food, and other requests. Applicant counts are
stored cumulatively in Supabase, and applicant lists are visible only to the
super admin.

ECC and Hanhwal free-board posts, ECC member status, generated teams, and
KakaoTalk-ready notice drafts are saved in browser localStorage for this prototype.
Connect a real database and image storage before treating the boards and member
records as shared public data.

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
- `/our-activities/ecc/activity`
- `/our-activities/ecc/free-board`
- `/our-activities/ecc/fund`
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
- `public/images/woohyukmon-icon.png`
- `src/components/Logo.tsx`

Place the Woohyukmon face icon at:

```text
public/images/woohyukmon-icon.png
```

If the PNG is not present, the chatbot falls back to a circular avatar with `우`.

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
- `WoohyukmonChatbot`
- `AdminDashboard`
- `DonationPanel`
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

## Woohyukmon AI Assistant

Woohyukmon / 우혁몬 is the site-wide K_LINE AI guide. In Phase 1 it appears as a
floating bottom-right chatbot across every page.

Woohyukmon can answer about:

- K_LINE identity
- Goods
- K-Culture Project
- ECC
- Han-hwal
- project submission
- club writing
- Arrow Pen
- Hanji Calligraphy LED Light Object

Phase 1 uses:

- `src/components/WoohyukmonChatbot.tsx`
- `src/app/api/woohyukmon/route.ts`
- `src/data/woohyukmonKnowledge.ts`
- `src/lib/woohyukmonContext.ts`

The browser calls the local API route. The API route calls OpenAI on the server,
so `OPENAI_API_KEY` is never exposed to the browser.

Local setup:

```bash
OPENAI_API_KEY=your-openai-api-key
```

Or create a local `.env.local`:

```bash
OPENAI_API_KEY=your-openai-api-key
```

Then run:

```bash
npm run dev
```

Test:

1. Open `http://localhost:3000`
2. Click the floating `우혁몬` button
3. Ask about K_LINE, Goods, ECC, Han-hwal, project submission, or club writing

Vercel setup:

1. Open the K_LINE Vercel project.
2. Go to Project Settings > Environment Variables.
3. Add `OPENAI_API_KEY` for Production.
4. Redeploy:

```bash
npx vercel deploy --prod
```

Future Woohyukmon upgrade plan:

- database-backed knowledge
- admin-managed FAQ
- project/club post search
- uploaded document search
- vector search
- image description search
- answer citation/source display
- moderation and abuse prevention
- permanent chat history
- user-specific memory

## Super Admin And Donation Prototype

K_LINE uses the same Google login channel for general members and the super admin.
The public site URL is the same. If the logged-in email is listed in
`SUPER_ADMIN_EMAILS`, extra management controls appear inside the same pages.

Set the super-admin email list in Vercel:

```bash
SUPER_ADMIN_EMAILS=your-google-login-email@example.com
```

Current role-aware super-admin controls:

- `/our-activities/ecc`: open the ECC menu for free board, activity, and fund management
- `/our-activities/ecc/activity`: paste ECC member status, view activity records, generate teams, and generate KakaoTalk-ready notices
- `/admin`: fetch pending K-Culture Project submissions from Supabase
- `/admin`: fetch pending Our Activities post submissions from Supabase
- `/our-activities/ecc/free-board`: delete ECC free-board posts from the same board screen
- `/our-activities/hanhwal`: delete Han-hwal free-board posts from the same board screen
- free-board detail pages: delete the current post from the same detail screen
- `/our-activities/ecc/fund`: edit the displayed donation account, total donation amount, and account balance
- `/our-activities/ecc/fund`: view, mark received, or delete locally saved donation pledges

The `/our-activities/ecc/fund` route provides a donation pledge page and optional
bank transfer information. The old `/donate` route redirects to the ECC fund
management page. Configure public initial display values only if they are safe to show:

```bash
NEXT_PUBLIC_DONATION_BANK_NAME=
NEXT_PUBLIC_DONATION_ACCOUNT_NUMBER=
NEXT_PUBLIC_DONATION_ACCOUNT_HOLDER=
NEXT_PUBLIC_DONATION_TOTAL_KRW=
NEXT_PUBLIC_DONATION_BALANCE_KRW=
```

Important: real bank balance sync is not connected. A live account balance requires
an official bank/open-banking API, account-owner consent, server-side credentials,
and security review. The donation total and account balance can be typed manually
by the super admin on `/our-activities/ecc/fund`. Donation pledges are not real
payments until a payment gateway, bank transfer confirmation flow, database, and
receipt/accounting process are connected.

## Deploy To Vercel

Deploy this repository as a new standalone Vercel project.

Do not connect it to the Xtudy Universe Vercel project.

Recommended Vercel settings:

- Framework preset: Next.js
- Build command: `npm run build`
- Output directory: Next.js default
- Install command: `npm install`
- Environment variables required for Google login: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- Environment variable required for Woohyukmon AI: `OPENAI_API_KEY`
- Environment variable required for admin access: `SUPER_ADMIN_EMAILS`
- Environment variables required for shared Supabase storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Optional production environment variable:

```bash
NEXT_PUBLIC_SITE_URL=https://your-custom-domain.example
```

Set this only after connecting a real custom domain.

## Supabase Storage

K-Culture Project submissions, Our Activities post submissions, and ECC activity
applications are stored server-side in Supabase so data is shared across accounts,
browsers, and devices. Do not expose the service role key in client code.

The current Supabase-backed tables are:

- `public.project_submissions`
- `public.activity_posts`
- `public.ecc_activity_applications`

Create this table in the Supabase SQL editor. The same SQL is saved at
`supabase/ecc_activity_applications.sql`.

```sql
create table if not exists public.ecc_activity_applications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('gathering', 'mt', 'special')),
  kakao_name text not null,
  gender text not null,
  nationality text not null,
  preferred_food text not null,
  request text default '',
  created_at timestamptz not null default now()
);

alter table public.ecc_activity_applications enable row level security;
```

Add these Vercel environment variables for Production:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

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
- real donation payment/receipt processing
- real bank account balance API integration
- email sending
- database persistence for remaining local-only flows
- approval/rejection workflow for Supabase-backed submitted projects and activity posts
- member profile database after Google authentication
- ECC member/activity database
- KakaoTalk API or bot integration for real automatic notice sending
- server-side admin moderation
- AI moderation and abuse prevention
- spam protection
- order management
- class booking management
- project submission review workflow
- club post moderation workflow
- image upload and storage
- product inventory
- real product and activity images
- custom domain
- Google Analytics
- Google Search Console verification
- Woohyukmon database/vector/document-search integration

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
