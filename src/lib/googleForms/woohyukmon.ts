import { googleFormsActionRegistry } from "./planning";
export const woohyukmonGoogleFormsActions = Object.keys(googleFormsActionRegistry);

export type WoohyukmonGoogleFormsAction = (typeof woohyukmonGoogleFormsActions)[number];

export const woohyukmonGoogleFormsGuardrails = {
  arbitraryGoogleAccountAccess: false,
  exposeOAuthTokens: false,
  mutateGoogleResponses: false,
  requiresExistingClubAuthorization: true
} as const;
