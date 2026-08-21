import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-overrides.css";
import "./theme-fixes.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import BrandSync from "@/components/BrandSync";
import SiteChrome from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Raven Oracle",
  description: "Open crypto and NFT community alpha, reputation, and fair rewards.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <ThemeProvider>
          <BrandSync />
          <SiteChrome>{children}</SiteChrome>
        </ThemeProvider>
      </body>
    </html>
  );
}
