export function activityGuideAccess(pathname: string, access: {
  email?: string; isLoggedIn?: boolean; isAdmin?: boolean;
}) {
  const activityGuide = pathname === "/our-activities/ecc/activity";
  return {
    activityGuide,
    visible: Boolean(access.email && (access.isAdmin || (activityGuide && access.isLoggedIn))),
    readOnly: !access.isAdmin
  };
}
