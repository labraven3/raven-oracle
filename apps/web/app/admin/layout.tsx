import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Raven Oracle Admin",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
};

export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
