export const woohyukmonGoogleFormsActions = [
  "CREATE_GOOGLE_FORM",
  "OPEN_FORM_RECRUITMENT",
  "CLOSE_FORM_RECRUITMENT",
  "READ_FORM_RESPONSE_COUNT",
  "READ_FORM_RESPONSE_SUMMARY"
] as const;

export type WoohyukmonGoogleFormsAction = (typeof woohyukmonGoogleFormsActions)[number];

export const woohyukmonGoogleFormsGuardrails = {
  arbitraryGoogleAccountAccess: false,
  exposeOAuthTokens: false,
  mutateGoogleResponses: false,
  requiresExistingClubAuthorization: true
} as const;
