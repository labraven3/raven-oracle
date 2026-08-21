"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function brandMarkup(size: "header" | "footer") {
  const iconSize = size === "header" ? 46 : 72;
  const textSize = size === "header" ? 14 : 17;
  return `<span data-raven-brand="true" style="display:inline-flex;align-items:center;gap:11px;line-height:1;text-decoration:none"><img src="/raven-oracle-final.svg" alt="Raven Oracle" width="${iconSize}" height="${iconSize}" style="display:block;width:${iconSize}px;height:${iconSize}px;object-fit:contain;flex:none"/><span style="display:inline-flex;flex-direction:column;gap:4px"><strong style="font-size:${textSize}px;letter-spacing:.2em;color:inherit;font-weight:900">RAVEN</strong><small style="font-size:8px;letter-spacing:.3em;color:#8b5cf6;font-weight:800">ORACLE</small></span></span>`;
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
