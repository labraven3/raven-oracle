import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./theme-overrides.css";
import "./theme-fixes.css";
import "./pro-polish.css";
import "./og-premium.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import BrandSync from "@/components/BrandSync";
import SiteChrome from "@/components/SiteChrome";

export const metadata: Metadata = {
  metadataBase: new URL("https://ravenoracle.xyz"),
  title: {
    default: "Raven Oracle — NFT Raffles",
    template: "%s | Raven Oracle",
  },
  description: "Create and join NFT raffles with clear entry rules, recorded results and creator winner exports.",
  applicationName: "Raven Oracle",
  keywords: ["NFT raffles", "NFT giveaways", "Web3 raffles", "Raven Oracle"],
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Raven Oracle — NFT Raffles",
    description: "Create and join NFT raffles with clear entry rules and recorded results.",
    url: "https://ravenoracle.xyz",
    siteName: "Raven Oracle",
    type: "website",
    images: [{ url: "/RavenOracleWordmark.png", width: 1200, height: 630, alt: "Raven Oracle" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Raven Oracle — NFT Raffles",
    description: "Create and join NFT raffles with clear entry rules and recorded results.",
    images: ["/RavenOracleWordmark.png"],
  },
  robots: { index: true, follow: true },
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
