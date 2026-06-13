"use client";

import { useEffect, useState } from "react";

type SuperAdminState = {
  email: string;
  isLoggedIn: boolean;
  isDeveloper: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  role: "member" | "super_admin" | "developer";
};

export function useSuperAdmin() {
  const [state, setState] = useState<SuperAdminState>({
    email: "",
    isLoggedIn: false,
    isDeveloper: false,
    isSuperAdmin: false,
    loading: true,
    role: "member"
  });

  useEffect(() => {
    let active = true;

    fetch("/api/admin/me")
      .then((response) => response.json())
      .then((data: Omit<SuperAdminState, "loading">) => {
        if (!active) {
          return;
        }
        setState({
          email: data.email ?? "",
          isLoggedIn: Boolean(data.isLoggedIn),
          isDeveloper: Boolean(data.isDeveloper),
          isSuperAdmin: Boolean(data.isSuperAdmin),
          loading: false,
          role: data.role ?? "member"
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
