"use client";

import { useEffect, useState } from "react";
import type { HanhwalAccess, HanhwalRole } from "@/lib/hanhwalAccess";

type HanhwalAccessState = HanhwalAccess & {
  loading: boolean;
};

const emptyState: HanhwalAccessState = {
  email: "",
  isAdmin: false,
  isDeveloper: false,
  isLoggedIn: false,
  isOfficialMember: false,
  isSuperAdmin: false,
  loading: true,
  role: "user" as HanhwalRole
};

export function useHanhwalAccess() {
  const [state, setState] = useState<HanhwalAccessState>(emptyState);

  useEffect(() => {
    let active = true;

    fetch("/api/hanhwal/me")
      .then((response) => response.json())
      .then((data: HanhwalAccess) => {
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
