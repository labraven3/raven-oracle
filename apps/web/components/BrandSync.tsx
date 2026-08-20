"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const mark = `<svg viewBox="0 0 120 120" width="42" height="42" aria-hidden="true"><defs><linearGradient id="ravenBrandGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b78cff"/><stop offset=".48" stop-color="#7c3aed"/><stop offset="1" stop-color="#2563eb"/></linearGradient><filter id="ravenBrandGlow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="60" cy="60" r="53" fill="none" stroke="url(#ravenBrandGradient)" stroke-width="3" stroke-dasharray="96 18 35 14" opacity=".95"/><path d="M18 66c9-25 26-42 51-47l31 12-16 8 18 12-25 4 13 12-28 3-20 18-18-2 9-13-15 2z" fill="#11142a" stroke="url(#ravenBrandGradient)" stroke-width="2.2" filter="url(#ravenBrandGlow)"/><path d="M37 48l31-22 23 8-24 10-18 17z" fill="#262a4d"/><path d="M44 68l32-7 25 9-39 8-25 17z" fill="#171a35"/><circle cx="73" cy="43" r="5.5" fill="#a78bfa" filter="url(#ravenBrandGlow)"/><circle cx="73" cy="43" r="2" fill="#fff"/><path d="M54 48h36l-8 10H56z" fill="#f8f7ff"/><path d="M58 55h27v13H72L58 81V67h14z" fill="#f8f7ff" stroke="#7c3aed" stroke-width="1.5"/></svg>`;

function brandMarkup(size: "header" | "footer") {
  const icon = size === "header" ? mark : mark.replace('width="42" height="42"', 'width="56" height="56"');
  return `<span data-raven-brand="true" style="display:inline-flex;align-items:center;gap:10px;line-height:1;text-decoration:none">${icon}<span style="display:inline-flex;flex-direction:column;gap:4px"><strong style="font-size:${size === "header" ? "13px" : "15px"};letter-spacing:.2em;color:#fff;font-weight:900">RAVEN</strong><small style="font-size:8px;letter-spacing:.3em;color:#a78bfa;font-weight:800">ORACLE</small></span></span>`;
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
    const footerBrand = Array.from(footer.querySelectorAll<HTMLAnchorElement>('a[href="/"]')).find((link) => /raven|oracle/i.test(link.textContent || ""));
    if (footerBrand && !footerBrand.querySelector("[data-raven-brand]")) {
      footerBrand.innerHTML = brandMarkup("footer");
      footerBrand.style.display = "inline-flex";
      footerBrand.style.alignItems = "center";
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
