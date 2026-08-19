"use client";

import { useEffect, useState } from "react";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const initTheme = async () => {
      const saved = localStorage.getItem("raven-theme");
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      const next = saved ? saved === "light" : prefersLight;
      setLight(next);
      document.documentElement.classList.toggle("light", next);
    };
    void initTheme();
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    localStorage.setItem("raven-theme", next ? "light" : "dark");
    document.documentElement.classList.toggle("light", next);
  };

  return <button type="button" onClick={toggle} aria-label={`Switch to ${light ? "dark" : "light"} mode`} title={`Switch to ${light ? "dark" : "light"} mode`} className={styles.toggle}><span className={styles.icon}>{light ? "☀" : "☾"}</span><span className={styles.label}>{light ? "Light" : "Dark"}</span></button>;
}
