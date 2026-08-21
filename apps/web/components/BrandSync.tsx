"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function brandMarkup(size: "header" | "footer") {
  const iconSize = size === "header" ? 42 : 56;
  const textSize = size === "header" ? 13 : 15;
  return `<span data-raven-brand="true" style="display:inline-flex;align-items:center;gap:10px;line-height:1;text-decoration:none"><img src="/raven-logo-mark.svg" alt="Raven Oracle" width="${iconSize}" height="${iconSize}" style="display:block;width:${iconSize}px;height:${iconSize}px;object-fit:contain"/><span style="display:inline-flex;flex-direction:column;gap:4px"><strong style="font-size:${textSize}px;letter-spacing:.2em;color:inherit;font-weight:900">RAVEN</strong><small style="font-size:8px;letter-spacing:.3em;color:#8b5cf6;font-weight:800">ORACLE</small></span></span>`;
}

function syncBranding() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/"]'));
  const brandLinks = links.filter((link) => /raven|oracle/i.test(link.textContent || ""));
  const navBrand = brandLinks.find((link) => link.closest("nav"));
  if (navBrand && !navBrand.querySelector("[data-raven-brand]")) {
    navBrand.innerHTML = brandMarkup("header");
    navBrand.style.display = "inline-flex";
    navBrand.style.alignItems = "center";
  }

  document.querySelectorAll<HTMLElement>("footer").forEach((footer) => {
    const footerLink = Array.from(footer.querySelectorAll<HTMLAnchorElement>('a[href="/"]')).find((link) => /raven|oracle/i.test(link.textContent || ""));
    if (footerLink && !footerLink.querySelector("[data-raven-brand]")) {
      footerLink.innerHTML = brandMarkup("footer");
      footerLink.style.display = "inline-flex";
      footerLink.style.alignItems = "center";
      return;
    }

    const footerBrand = Array.from(footer.querySelectorAll<HTMLElement>("div")).find((el) => {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return /^RAVEN ORACLE$/i.test(text) && el.children.length <= 2;
    });

    if (footerBrand && !footerBrand.querySelector("[data-raven-brand]")) {
      footerBrand.innerHTML = brandMarkup("footer");
    }
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
