# K_LINE

K_LINE Production Site:
https://kline-nine-wheat.vercel.app

K_LINE is a campus-based K-culture platform for Korean heritage goods, cultural projects, ECC, Han-hwal, and international student activities.

K_LINE Goods introduces Korean heritage-inspired lifestyle goods such as Hanji mood lamps, Dancheong mugs, Najeonchilgi plates, Korean native dog keyrings, Hanji fans, Arrow Pen, and other K-culture gift concepts.

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
- Supabase-backed K-Culture Project submissions, Our Activities post submissions, ECC applications, ECC member registration, Google login members, and visitor analytics
- Role-aware super-admin prototype inside the same public site pages for local post deletion, donation account editing, donation total display, and account balance display
- Inquiry-based commerce first
- No real payment, image upload, bank API, KakaoTalk auto-send API, or shared server-side admin moderation yet

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

Above those ECC tools, the ECC menu also shows:

- New member registration: `/our-activities/ecc/register`
- Member management: `/our-activities/ecc/members`

New member registration is visible to everyone. Member management is visible
only to super-admin or developer-level accounts.

ECC new member registration now starts with KakaoTalk Open Chat instead of a
public personal-information form:

```text
QR / Link -> ECC Open Chat -> Bot guide -> Membership fee payment -> Official Google Form -> Officer confirmation
```

Default ECC Open Chat URL:

```text
https://open.kakao.com/o/gTRnoKzi
```

To change the Open Chat link and the generated QR code, set:

```bash
NEXT_PUBLIC_ECC_OPEN_CHAT_URL=https://open.kakao.com/o/your-new-room
```

The public page `/our-activities/ecc/register` guides potential members to the
Open Chat room first. The official Google Form is only for people who decide to
become official members and pay the membership fee.

The ECC activity page supports a Korean/English language selector. In English
mode, English Excel headers such as `Name`, `Affiliation`, `Gathering`, `MT`,
`Special Events`, and `Note` are parsed, team names use `Team 1`, `Team 2`, and
the KakaoTalk-ready notice draft is generated in English.

The ECC activity page also includes Google-Forms-style applications for
International Gathering, MT, Special Event, Semester Opening Party, and Farewell
Party. Applicants answer KakaoTalk name, gender, nationality, preferred food, and
other requests. Applicant counts are stored cumulatively in Supabase, and
applicant lists are visible only to the super admin.

ECC and Hanhwal free-board posts, generated teams, and KakaoTalk-ready notice
drafts are saved in browser localStorage for this prototype. ECC member
management, membership-fee confirmation, and official Google Form campaign
response status are stored in Supabase through server-side API routes. Connect
real image storage and moderation before treating free-board uploads as shared
public data.

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
- `/goods/dangun-myth-mug-set`
- `/goods/dancheong-mug-set`
- `/goods/najeonchilgi-plate`
- `/goods/kim-hongdo-blanket`
- `/k-culture-project`
- `/k-culture-project/submit`
- `/k-culture-project/han-hwal`
- `/k-culture-project/connecting-korean-lines-to-europe`
- `/our-activities`
- `/our-activities/ecc`
- `/our-activities/ecc/register`
- `/our-activities/ecc/members`
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
- `EccMembershipCards`
- `EccMemberRegistrationForm`
- `EccMemberManagementPanel`
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

When Supabase is configured, every successful Google login is saved or updated
in `public.site_members`. The admin console can then show total Google-login
members, active members, each member's email/name/provider, first login, last
login, and login count. The login callback never exposes `SUPABASE_SERVICE_ROLE_KEY`
to client code.

Visitor analytics are recorded by a small client tracker that posts an anonymous
visitor id, page path, and referrer to a server-side API. The server stores this
in `public.site_visitors` and `public.site_visits`. Admin pages are not tracked.
The super-admin console shows unique visitors, total page visits, today's visits,
and recent visits.

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

## ECC Permission And Access Control

The ECC / International Student Club area uses this role hierarchy:

1. `user`
2. `official_member`
3. `admin`
4. `super_admin`
5. `developer`

The effective role is calculated server-side. Higher roles inherit lower-role
permissions unless the UI explicitly hides sensitive information. Developer
accounts come from `DEVELOPER_EMAILS`. Super-admin compatibility with the older
system remains through `SUPER_ADMIN_EMAILS` and active `admin_roles` rows.

Create the ECC role table in Supabase before using the new role-management UI.
The SQL is saved at:

```text
supabase/ecc_roles.sql
```

Add these environment variables in Vercel when appropriate:

```bash
DEVELOPER_EMAILS=developer@example.com
SUPER_ADMIN_EMAILS=superadmin@example.com
ECC_OFFICIAL_TEAM_CHAT_URL=https://invite.kakao.com/tc/d3m2UO008Y
```

Protected ECC routes:

- `/ecc-official`: official member lounge with the protected team chat link and QR
- `/api/ecc/official-team-qr`: returns the uploaded QR image only to official members or higher
- `/our-activities/ecc/free-board`: official member or higher
- `/our-activities/ecc/activity`: official member or higher; admin tools only for admin or higher
- `/our-activities/ecc/members`: admin or higher
- `/our-activities/ecc/fund`: super admin or developer only

Role-management behavior:

- General Google-login users see only ECC New Member Registration.
- Admins, super admins, and developers can approve users as official members after payment confirmation.
- Official members can request admin permission.
- Super admins and developers can approve admin requests.
- Admins can request super-admin permission.
- Only developers can approve or revoke super-admin permission.
- Developer-only role acquisition account information is returned only to developer accounts.

Current role-aware super-admin controls:

- `/our-activities/ecc`: open the ECC menu for free board, activity, and fund management
- `/our-activities/ecc/members`: confirm ECC membership-fee payment, prepare team chat links, show QR codes, and track invitation status
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
- Environment variable required for developer access: `DEVELOPER_EMAILS`
- Environment variable for protected ECC team chat: `ECC_OFFICIAL_TEAM_CHAT_URL`
- Environment variables required for shared Supabase storage: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Optional production environment variable:

```bash
NEXT_PUBLIC_SITE_URL=https://your-custom-domain.example
NEXT_PUBLIC_ECC_OPEN_CHAT_URL=https://open.kakao.com/o/gTRnoKzi
```

Set `NEXT_PUBLIC_SITE_URL` only after connecting a real custom domain. Change
`NEXT_PUBLIC_ECC_OPEN_CHAT_URL` whenever the ECC Open Chat room changes; the
button and generated QR code use this value.

## Supabase Storage

K-Culture Project submissions, Our Activities post submissions, and ECC activity
applications are stored server-side in Supabase so data is shared across accounts,
browsers, and devices. ECC member management, membership-fee confirmation,
official Google Form campaign applicant status, Google login members, and visitor
analytics are also stored server-side in Supabase. Do not expose the service role
key in client code.

The current Supabase-backed tables are:

- `public.project_submissions`
- `public.activity_posts`
- `public.ecc_activity_applications`
- `public.ecc_members`
- `public.member_registration_campaigns`
- `public.member_registration_applicant_statuses`
- `public.site_members`
- `public.site_visitors`
- `public.site_visits`

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

Create the ECC member table in the Supabase SQL editor before using
`/our-activities/ecc/members`. The public `/our-activities/ecc/register` page
now guides users to KakaoTalk Open Chat first and does not expose a public
applicant list. The SQL is saved at `supabase/ecc_members.sql`.

```sql
create table if not exists public.ecc_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  kakao_id text not null,
  email text default '',
  phone text default '',
  nationality text default '',
  note text default '',
  membership_fee_paid boolean not null default false,
  team_chat_sent boolean not null default false,
  team_chat_url text default '',
  qr_code_url text default '',
  payment_note text default '',
  status text not null default 'pending'
);

alter table public.ecc_members enable row level security;
```

Create the Google Form campaign management tables before using
`/admin/member-registrations`. The SQL is saved at
`supabase/member_registrations.sql`.

The campaign manager stores the official Google Form URL for people who have
already paid the membership fee. Public campaign links and generated QR codes
guide potential members to ECC Open Chat first; private Google Form responses or
applicant status lists are visible only to super-admin accounts.

Create the Google login member and visitor analytics tables before relying on
admin member counts or visitor counts. The SQL is saved at
`supabase/site_members_and_visits.sql`.

These tables support:

- automatic Google-login member registration
- total member count and active member count
- first login, last login, and login count
- anonymous unique visitor count
- total page visit count and today's visit count
- recent public-page visit list for the super-admin console

Important: KakaoTalk automatic sending is not connected yet. The current member
management page prepares the invite message, team chat URL, QR code, and sent
status. Real automatic sending requires Kakao API or Kakao business channel setup,
user consent, server-side credentials, and a production message policy review.

## SEO And Search

The project includes:

- page metadata title and description
- canonical URLs for public pages
- Open Graph metadata
- Twitter card metadata
- semantic headings
- clean URL slugs
- image alt text
- `robots.txt`
- `sitemap.xml`
- Organization JSON-LD
- Product JSON-LD
- Project CreativeWork JSON-LD
- Activity Article JSON-LD

Primary sitemap URL:

```text
https://kline-nine-wheat.vercel.app/sitemap.xml
```

Robots URL:

```text
https://kline-nine-wheat.vercel.app/robots.txt
```

The sitemap intentionally includes only the main public discovery pages:

- `/`
- `/goods`
- `/k-culture-project`
- `/our-activities`
- `/our-activities/ecc`
- `/our-activities/ecc/register`
- `/our-activities/hanhwal`
- `/contact`

The following routes are intentionally blocked or marked noindex where applicable:

- `/admin`
- `/login`
- `/api/*`
- `/developer/*`
- `/request-admin`
- `/cart`
- `/checkout`
- `/donate`
- `/k-culture-project/submit`
- `/our-activities/write`
- `/our-activities/ecc/activity`
- `/our-activities/ecc/fund`
- `/our-activities/ecc/members`

## Placeholder / Future Integration Checklist

The following are intentionally placeholder flows:

- real payment
- real donation payment/receipt processing
- real bank account balance API integration
- email sending
- database persistence for remaining local-only flows
- approval/rejection workflow for Supabase-backed submitted projects and activity posts
- editable member profiles beyond the automatic Google-login member table
- advanced analytics dashboard beyond member counts and basic visitor counts
- broader ECC activity/member database beyond the Supabase member registration and activity application tables
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

1. Open Google Search Console.
2. Add a URL-prefix property for:

```text
https://kline-nine-wheat.vercel.app
```

3. If a custom domain is connected later, add that final domain as a separate property.
4. Verify ownership. DNS TXT verification is preferred for custom domains. For the Vercel URL, use an HTML tag or DNS verification method that Google offers for the property.
5. Submit this sitemap:

```text
https://kline-nine-wheat.vercel.app/sitemap.xml
```

6. Use URL Inspection to request indexing for:

```text
https://kline-nine-wheat.vercel.app/
https://kline-nine-wheat.vercel.app/goods
https://kline-nine-wheat.vercel.app/k-culture-project
https://kline-nine-wheat.vercel.app/our-activities
https://kline-nine-wheat.vercel.app/our-activities/ecc
https://kline-nine-wheat.vercel.app/our-activities/hanhwal
https://kline-nine-wheat.vercel.app/contact
```

7. Confirm Google can crawl the site by checking URL Inspection, robots.txt status, and sitemap status.
8. Do not submit private routes such as `/admin`, `/login`, `/api/*`, `/developer/*`, or role-management/action pages.
