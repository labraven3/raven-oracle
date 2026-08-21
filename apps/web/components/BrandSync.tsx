"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function brandMarkup(size: "header" | "footer") {
  const markSize = 56;
  const wordmarkSize = 40;
  return `<span data-raven-brand="true" class="raven-brand-lockup" style="display:inline-flex;align-items:center;gap:0;line-height:1;text-decoration:none;flex:none"><img src="/RavenOracleLogo.jpeg" alt="Raven Oracle mark" class="raven-brand-logo raven-brand-theme" style="display:block;height:${markSize}px;width:${markSize}px;object-fit:contain;flex:none"/><img src="/RavenOracleWordmark.jpeg" alt="Raven Oracle" class="raven-brand-logo raven-brand-theme" style="display:block;height:${wordmarkSize}px;width:auto;object-fit:contain;flex:none"/></span>`;
}

function replaceBrand(target: HTMLElement, size: "header" | "footer") {
  if (target.querySelector("[data-raven-brand], [data-raven-canonical]")) return;
  target.innerHTML = brandMarkup(size);
  target.style.display = "inline-flex";
  target.style.alignItems = "center";
}

function syncAuthNavigation() {
  const isLoggedIn = Boolean(localStorage.getItem("raven_token"));
  document.querySelectorAll<HTMLAnchorElement>('a[href="/login"], a[href="/register"]').forEach((link) => {
    link.style.display = isLoggedIn ? "none" : "";
  });
}

function syncBranding() {
  const navs = Array.from(document.querySelectorAll<HTMLElement>("nav"));
  navs.forEach((nav) => {
    const homeLink = nav.querySelector<HTMLAnchorElement>('a[href="/"]');
    if (homeLink) replaceBrand(homeLink, "header");
  });

  document.querySelectorAll<HTMLElement>("footer").forEach((footer) => {
    const footerLink = footer.querySelector<HTMLAnchorElement>('a[href="/"]');
    if (footerLink) {
      replaceBrand(footerLink, "footer");
      return;
    }

    const brandBlock = Array.from(footer.querySelectorAll<HTMLElement>("div")).find((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return /^RAVEN ORACLE$/i.test(text) && el.children.length <= 2;
    });
    if (brandBlock) replaceBrand(brandBlock, "footer");
  });

  syncAuthNavigation();
}

export default function BrandSync() {
  const pathname = usePathname();
  useEffect(() => {
    syncBranding();
    const observer = new MutationObserver(() => syncBranding());
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(syncAuthNavigation, 500);
    const onAuthChanged = () => syncAuthNavigation();
    window.addEventListener("raven-auth-changed", onAuthChanged);
    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener("raven-auth-changed", onAuthChanged);
    };
  }, [pathname]);
  return null;
}
