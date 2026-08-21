"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

const routesWithOwnHeader = [
  "/account",
  "/projects",
  "/raffles",
  "/alpha",
  "/chat",
  "/create",
  "/dashboard",
  "/how-it-works",
];

function hasOwnHeader(pathname: string) {
  if (routesWithOwnHeader.includes(pathname)) return true;
  if (pathname.startsWith("/projects/")) return true;
  if (pathname.startsWith("/raffles/")) return true;
  return false;
}

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  if (isAdmin || isApi) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      {!hasOwnHeader(pathname) && <SiteHeader />}
      <main className="flex-1">{children}</main>
      {pathname !== "/" && <SiteFooter />}
    </div>
  );
}
