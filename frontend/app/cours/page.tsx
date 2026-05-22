"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoursRedirect() {
  const router = useRouter();
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role === "admin") router.push("/admin");
    else router.push("/apprenant");
  }, []);
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
}
