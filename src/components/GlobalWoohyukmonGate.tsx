"use client";

import { useEffect, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { activityGuideAccess } from "@/lib/woohyukmon/activity-guide-access";

type AccessResponse = {
  email?: string;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
  role?: string;
};

type AgentProps = {
  actorRole: string;
  actorEmail: string;
  activityGuide: boolean;
  readOnly: boolean;
};

export function GlobalWoohyukmonGate() {
  const [Agent, setAgent] = useState<ComponentType<AgentProps> | null>(null);
  const [actorRole, setActorRole] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [access, setAccess] = useState<AccessResponse>({});
  const pathname = usePathname();
  const activityPath = pathname === "/our-activities/ecc/activity" ? pathname : "";
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email ?? "";
  const guide = activityGuideAccess(pathname, access);

  useEffect(() => {
    const controller = new AbortController();
    setAccess({});
    if (status !== "authenticated") return () => controller.abort();

    fetch("/api/ecc/me", {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AccessResponse;
      })
      .then(async (access) => {
        if (!access || !activityGuideAccess(activityPath, access).visible || controller.signal.aborted) return;
        if (access.email?.toLowerCase() !== sessionEmail.toLowerCase()) return;

        const module = await import("@/components/GlobalWoohyukmon");

        if (controller.signal.aborted) return;

        setActorRole(access.role || (access.isAdmin ? "admin" : "member"));
        setActorEmail(access.email || "");
        setAccess(access);
        setAgent(() => module.GlobalWoohyukmon);
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, [activityPath, sessionEmail, status]);

  if (!Agent || !guide.visible || status !== "authenticated" || actorEmail.toLowerCase() !== sessionEmail.toLowerCase()) {
    return null;
  }

  return <Agent key={`${actorEmail}:${guide.activityGuide}:${guide.readOnly}`} actorRole={actorRole} actorEmail={actorEmail} activityGuide={guide.activityGuide} readOnly={guide.readOnly} />;
}
