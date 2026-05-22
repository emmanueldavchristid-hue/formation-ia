"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth(requiredRole?: "admin" | "user") {
  const router = useRouter();
  const [user, setUser] = useState<{name: string, role: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const name = localStorage.getItem("full_name");
    if (!token) { router.push("/login"); return; }
    if (requiredRole === "admin" && role !== "admin") { router.push("/apprenant"); return; }
    setUser({ name: name || "", role: role || "" });
    setLoading(false);
  }, []);

  function logout() {
    localStorage.clear();
    router.push("/login");
  }

  return { user, loading, logout };
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}
