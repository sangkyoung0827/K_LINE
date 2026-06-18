"use client";

import { useEffect, useState } from "react";
import type { EccAccess, EccRole } from "@/lib/eccAccess";

type EccAccessState = EccAccess & {
  loading: boolean;
};

const emptyState: EccAccessState = {
  email: "",
  isAdmin: false,
  isDeveloper: false,
  isLoggedIn: false,
  isOfficialMember: false,
  isSuperAdmin: false,
  loading: true,
  role: "user" as EccRole
};

export function useEccAccess() {
  const [state, setState] = useState<EccAccessState>(emptyState);

  useEffect(() => {
    let active = true;

    fetch("/api/ecc/me")
      .then((response) => response.json())
      .then((data: EccAccess) => {
        if (!active) {
          return;
        }

        setState({
          email: data.email ?? "",
          isAdmin: Boolean(data.isAdmin),
          isDeveloper: Boolean(data.isDeveloper),
          isLoggedIn: Boolean(data.isLoggedIn),
          isOfficialMember: Boolean(data.isOfficialMember),
          isSuperAdmin: Boolean(data.isSuperAdmin),
          loading: false,
          role: data.role ?? "user"
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setState((current) => ({ ...current, loading: false }));
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
