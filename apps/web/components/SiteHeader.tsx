"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SiteHeader() {
  const router = useRouter();
  const [light, setLight] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const initTheme = async () => {
      const saved = localStorage.getItem("raven-theme");
      const next = saved === "light";
      setLight(next);
      document.documentElement.classList.toggle("light", next);
    };
    void initTheme();

    // Check if user is logged in
    const token = localStorage.getItem("raven_token");
    setIsLoggedIn(!!token);
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    localStorage.setItem("raven-theme", next ? "light" : "dark");
    document.documentElement.classList.toggle("light", next);
  };

  const handleLogout = () => {
    localStorage.removeItem("raven_token");
    setIsLoggedIn(false);
    router.push("/");
  };

  const bg = light ? "#f5f3f8" : "#06060a";
  const text = light ? "#17131e" : "#f7f5fb";
  const muted = light ? "#77717f" : "#77727f";
  const border = light ? "rgba(25,18,40,.12)" : "rgba(255,255,255,.09)";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: `1px solid ${border}`,
        background: `${bg}e8`,
        backdropFilter: "blur(18px)",
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "auto",
          minHeight: 72,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 26,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 205 }}>
          <span
            style={{
              width: 40,
              height: 40,
              display: "grid",
              placeItems: "center",
              borderRadius: 12,
              background: "linear-gradient(135deg,#9b5cff,#5b21b6)",
              color: "white",
              fontWeight: 900,
            }}
          >
            R
          </span>
          <span>
            <b style={{ display: "block", fontSize: 13, letterSpacing: ".18em", color: text }}>
              RAVEN ORACLE
            </b>
            <small style={{ display: "block", marginTop: 3, color: muted, fontSize: 8, letterSpacing: ".16em" }}>
              NFT COMMUNITY PLATFORM
            </small>
          </span>
        </Link>
        <nav style={{ display: "flex", flex: 1, justifyContent: "center", gap: 24, fontSize: 12, color: muted }}>
          <Link href="/raffles">Raffles</Link>
          <Link href="/projects">NFT Projects</Link>
          <Link href="/alpha">King of Alpha</Link>
          <Link href="/how-it-works">How it works</Link>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={toggle}
            style={{
              border: `1px solid ${border}`,
              background: light ? "#fff" : "#0d0c12",
              color: text,
              borderRadius: 10,
              padding: "9px 11px",
              fontSize: 12,
              cursor: "pointer",
            }}
            aria-label="Toggle theme"
          >
            {light ? "☾" : "☀"}
          </button>

          {isLoggedIn ? (
            <>
              <Link
                href="/account"
                style={{
                  border: `1px solid ${border}`,
                  background: light ? "#fff" : "#0d0c12",
                  color: text,
                  borderRadius: 10,
                  padding: "10px 15px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Account
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  border: `1px solid ${border}`,
                  background: light ? "#fff" : "#0d0c12",
                  color: muted,
                  borderRadius: 10,
                  padding: "10px 15px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  border: `1px solid ${border}`,
                  background: light ? "#fff" : "#0d0c12",
                  color: text,
                  borderRadius: 10,
                  padding: "10px 15px",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Login
              </Link>
              <Link
                href="/register"
                style={{
                  borderRadius: 10,
                  background: "linear-gradient(135deg,#9b5cff,#5b21b6)",
                  color: "white",
                  padding: "10px 15px",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
