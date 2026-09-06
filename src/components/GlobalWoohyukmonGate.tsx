"use client";

import { useEffect, useState, type ComponentType } from "react";

type AccessResponse = {
  isAdmin?: boolean;
  role?: string;
};

type AgentProps = {
  actorRole: string;
};

export function GlobalWoohyukmonGate() {
  const [Agent, setAgent] = useState<ComponentType<AgentProps> | null>(null);
  const [actorRole, setActorRole] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/ecc/me", {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as AccessResponse;
      })
      .then(async (access) => {
        if (!access?.isAdmin || controller.signal.aborted) return;

        const module = await import("@/components/GlobalWoohyukmon");

        if (controller.signal.aborted) return;

        setActorRole(access.role || "admin");
        setAgent(() => module.GlobalWoohyukmon);
      })
      .catch(() => undefined);

    return () => {
      controller.abort();
    };
  }, []);

  if (!Agent) {
    return null;
  }

  return <Agent actorRole={actorRole} />;
}
