"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function brandMarkup(size: "header" | "footer") {
  const height = size === "header" ? 64 : 128;
  return `<span data-raven-brand="true" style="display:inline-flex;align-items:center;line-height:1;text-decoration:none"><img src="/RavenOracleLogo.png" alt="Raven Oracle" style="display:block;height:${height}px;width:auto;object-fit:contain;flex:none"/></span>`;
}

function replaceBrand(target: HTMLElement, size: "header" | "footer") {
  if (target.querySelector("[data-raven-brand]")) return;
  target.innerHTML = brandMarkup(size);
  target.style.display = "inline-flex";
  target.style.alignItems = "center";
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
}

export default function BrandSync() {
  const pathname = usePathname();
  useEffect(() => {
    syncBranding();
    const observer = new MutationObserver(() => syncBranding());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
