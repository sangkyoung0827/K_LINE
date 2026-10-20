# Hanhwal Resource Library

## Scope

- Public route: /our-activities/hanhwal/resources.
- Shared ECC library/detail UI, file/category helpers and signed storage adapter
  live in src/components/club-resources and src/lib/clubResources. ECC exports
  remain compatibility wrappers; its table, bucket, categories and immediate
  publication behavior are unchanged.
- Hanhwal uses only hanhwal_resource_files and the private
  hanhwal-resource-library bucket, with its existing Hanhwal membership lookup.
  ECC administration is not a Hanhwal role.
- Categories: archery training, research, activity photos, event materials, other.
  Entry points are in Hanhwal's public navigation and official-member menu.

## Permissions and Lifecycle

- Official members initiate an upload. The server validates name, extension,
  MIME, size (50 MB maximum), stored metadata and file header before completion.
- uploading -> pending -> published. Upload completion is not public approval.
  Only the uploader can complete its upload; only writable Hanhwal admins may
  edit title/description/category/audience, approve or delete.
- Visitors see published/public only. Approved members additionally see member
  files and their own pending uploads. Staff see pending and staff-only files.
  Read-only developer restrictions remain enforced on mutations.
- No uploader email or storage path is returned in the listing/detail projection.
  Read URLs are issued after current authorization and expire after 60 seconds.
  Deletion hides the record first, then removes the object; a failed removal is
  retriable through the exact deleted record rather than reporting false success.
- Server-only table privileges, RLS, private bucket and restrictive direct-object
  guards protect the archive, including beside future broad Storage policies.
  Updates/approvals require the current revision to prevent silent overwrites.
- Existing signed read URLs can remain valid for up to 60 seconds after a
  visibility change. Signed upload capabilities have Supabase's normal lifetime.

## Additive Migrations

- 20261020054933_hanhwal_resource_library.sql: dedicated table, indexes, RLS,
  service-role privileges, private bucket with size/MIME restrictions.
- 20261020061129_hanhwal_resource_storage_guard.sql: restrictive direct-object
  SELECT/INSERT/UPDATE/DELETE guards scoped only to this Hanhwal bucket.
- No ECC, Hanhwal membership, activity application, finance or other club rows
  are updated. No generated/sample archive entries are seeded.

## Verification

- Permission, owner completion, storage metadata/header failure, cross-origin
  rejection, stale revision, public/member/staff isolation, unknown/foreign UUID,
  read-only mutation and browser DB denial tests exercise the actual handlers.
- PGlite applies both migrations twice, preserves 13 ECC fixture records and
  proves restrictive Storage guards deny Hanhwal alongside broad policies while
  leaving other buckets unchanged.
- Actual Supabase DB/Storage test uses explicitly synthetic local role contexts,
  not fabricated claims of Google sign-in. Four real files were uploaded,
  completed, made staff-only, approved, downloaded and deleted. Public and
  ordinary-member access to staff files was denied. SHA-256 originals matched:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| PDF (public PDF.js sample) | 1016315 | 3662ff519e485810520552bf301d8c3b2b917fd2f83303f4965d7abed367e113 |
| HWP (public pyhwp aligns.hwp) | 16384 | b101b4faff3c65f88ac9f8f583219cf5825d0747be85dbe45174dcd84207a3d1 |
| PPTX (public Apache POI sample) | 308041 | fda10ff5e22a0222a40a69ddd6d00b29dc8081eff499ccf2b5df0579395a0df2 |
| PNG (existing site image) | 13042 | d538bfd80befe36a242291c80dc2dbf00ab79836487f560ad1380a31abfa89b7 |

- Temporary live records and storage objects were removed by exact IDs. The
  existing ECC 13-row JSON snapshot remained
  e9f82a9b12381c3d9261642963f8af69 before/after migration and file verification.
- Browser: actual production build/public empty state; 390px Korean/English
  layout has no horizontal overflow; isolated memory-only member PDF selection,
  upload/completion, admin metadata/category edit and approval, and public
  combined category/text search. No preview fixture is imported by app routes.
- npm run check passed. Browser Safety, including existing Event Archive and
  mobile-navigation browser tests, passed on ed28318. The final verification-only
  follow-up additionally uses public fixtures without reading ECC Storage,
  checks the member/public listing against actual PostgREST filters, and verifies
  explicit download filenames and content hashes. The PR must pass again on its
  final head before merge.
- Public fixture sources: Mozilla PDF.js compressed.tracemonkey-pldi-09.pdf;
  mete0r/pyhwp tests/hwp5_tests/fixtures/aligns.hwp; Apache POI
  test-data/slideshow/45541_Header.pptx. No fixture file is committed or seeded.

## Limits / Not Claimed

- HWP/PPTX do not have in-browser document rendering, matching ECC. File details
  and original downloads work; users open them in their own viewer. PDF/image
  rendering uses browser-supported formats. Native HWP/PowerPoint applications
  and physical mobile devices were not tested.
- New real Google sign-in across three separate production accounts and actual
  large-file (>6 MB) resumable transfers were not exercised in this task.
- File headers are format guards, not antivirus scanning or full document parsing.
- Supabase security advisory reports the intentional RLS/no-policy server-only
  pattern. Existing unrelated function search-path / review-stats-definer warnings
  were not modified by this archive-only change.
