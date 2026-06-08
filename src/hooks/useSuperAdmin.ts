"use client";

import { useEffect, useState } from "react";

type SuperAdminState = {
  email: string;
  isLoggedIn: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
};

export function useSuperAdmin() {
  const [state, setState] = useState<SuperAdminState>({
    email: "",
    isLoggedIn: false,
    isSuperAdmin: false,
    loading: true
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
          isSuperAdmin: Boolean(data.isSuperAdmin),
          loading: false
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
