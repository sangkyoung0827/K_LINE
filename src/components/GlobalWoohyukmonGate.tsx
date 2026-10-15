"use client";

import { useEffect, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { activityGuideAccess } from "@/lib/woohyukmon/activity-guide-access";
import { openWoohyukmonEvent } from "@/components/WoohyukmonLauncher";

type AccessResponse = {
  email?: string;
  isAdmin?: boolean;
  isLoggedIn?: boolean;
  role?: string;
  scopes?: string[];
  roles?: Record<string, string>;
  readOnly?: boolean;
};

type AgentProps = {
  launchRequest: number;
  actorRole: string;
  actorEmail: string;
  activityGuide: boolean;
  readOnly: boolean;
  scopes?: string[];
};

export function GlobalWoohyukmonGate() {
  const [Agent, setAgent] = useState<ComponentType<AgentProps> | null>(null);
  const [actorRole, setActorRole] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [access, setAccess] = useState<AccessResponse>({});
  const [launchRequest, setLaunchRequest] = useState(0);
  const pathname = usePathname();
  const activityPath = pathname === "/our-activities/ecc/activity" ? pathname : "";
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email ?? "";
  const guide = activityGuideAccess(pathname, access);

  useEffect(() => {
    const open = () => setLaunchRequest(value => value + 1);
    window.addEventListener(openWoohyukmonEvent, open);
    return () => window.removeEventListener(openWoohyukmonEvent, open);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setAccess({});
    if (status !== "authenticated") return () => controller.abort();

    fetch("/api/woohyukmon/club-assistant", {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const result = (await response.json()) as AccessResponse;
        return { ...result, isAdmin: !result.readOnly && Boolean(result.scopes?.length), isLoggedIn: Boolean(result.email), role: Object.values(result.roles || {})[0] || "member" };
      })
      .then(async (access) => {
        if (!access || controller.signal.aborted) return;
        if (access.email?.toLowerCase() !== sessionEmail.toLowerCase()) return;

        setActorRole(access.role || (access.isAdmin ? "admin" : "member"));
        setActorEmail(access.email || "");
        setAccess(access);
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, [activityPath, sessionEmail, status]);

  useEffect(() => {
    if ((!launchRequest && !guide.visible) || status === "loading") return;
    let cancelled = false;
    import("@/components/GlobalWoohyukmon").then(module => {
      if (!cancelled) setAgent(() => module.GlobalWoohyukmon);
    });
    return () => { cancelled = true; };
  }, [launchRequest, guide.visible, status]);

  if (!Agent || status === "loading" || (!launchRequest && !guide.visible)) {
    return null;
  }

  const verified = status === "authenticated" && actorEmail.toLowerCase() === sessionEmail.toLowerCase() && Boolean(sessionEmail);
  const management = verified && !access.readOnly && Boolean(access.scopes?.length);
  return <Agent key={`${sessionEmail}:${management}:${guide.activityGuide}`} actorRole={verified ? actorRole : "visitor"} actorEmail={sessionEmail} activityGuide={guide.activityGuide} readOnly={!management} scopes={management ? access.scopes : []} launchRequest={launchRequest} />;
}
