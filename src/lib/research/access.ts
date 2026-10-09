export type ResearchAccess = { email: string; canEdit: boolean; canManageAll: boolean; canManageEditors?: boolean };

export function canEditResearchItem(access: ResearchAccess, item: { createdBy: string }) {
  return access.canEdit && (access.canManageAll || Boolean(access.email && access.email === item.createdBy));
}
