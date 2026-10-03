import "server-only";

export function assertGoogleFormsTestEnvironment() {
  if (process.env.GOOGLE_FORMS_AUTOMATION_ENABLED !== "true" ||
      process.env.GOOGLE_FORMS_ENVIRONMENT !== "test" || process.env.VERCEL_ENV === "production") {
    throw new Error("GOOGLE_FORMS_TEST_ENVIRONMENT_REQUIRED");
  }
}

export function assertGoogleFormsPublicationApproval() {
  assertGoogleFormsTestEnvironment();
  if (process.env.GOOGLE_FORMS_TEST_PUBLICATION_APPROVED !== "true") {
    throw new Error("TEST_PUBLICATION_REQUIRES_SEPARATE_APPROVAL");
  }
}

export function assertGoogleFormsNoticePublicationApproval() {
  assertGoogleFormsTestEnvironment();
  if (process.env.GOOGLE_FORMS_TEST_NOTICE_PUBLICATION_APPROVED !== "true") throw new Error("PUBLIC_NOTICE_PUBLICATION_REQUIRES_SEPARATE_APPROVAL");
}
