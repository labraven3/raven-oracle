"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "../../../components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api-config";

type HeroSettings = {
  enabled: boolean;
  tagline1: string;
  tagline2: string;
  gradient1: string;
  gradient2: string;
  iconSets: string[][];
  animationSpeed: number;
};

const defaultSettings: HeroSettings = {
  enabled: true,
  tagline1: "The Future of",
  tagline2: "NFT Whitelists",
  gradient1: "from-violet-400 via-purple-300 to-pink-400",
  gradient2: "from-blue-400 via-cyan-300 to-violet-400",
  iconSets: [
    ["🎨", "💎", "🎮", "⛓️"],
    ["🚀", "🌟", "🎯", "💰"],
    ["🔥", "⚡", "🌈", "🎭"],
    ["🏆", "👑", "💫", "🎪"],
  ],
  animationSpeed: 4000,
};

export default function AdminHeroSettingsPage() {
  const [settings, setSettings] = useState<HeroSettings>(defaultSettings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem("hero_settings");
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        setSettings(defaultSettings);
      }
    }
  }, []);

  const saveSettings = () => {
    setBusy(true);
    try {
      localStorage.setItem("hero_settings", JSON.stringify(settings));
      setMessage("Hero settings saved successfully! Refresh home page to see changes.");
      setError("");
    } catch (e) {
      setError("Failed to save settings");
    } finally {
      setBusy(false);
    }
  };

  const resetToDefault = () => {
    setSettings(defaultSettings);
    localStorage.setItem("hero_settings", JSON.stringify(defaultSettings));
    setMessage("Reset to default settings");
  };

  const updateIcon = (setIndex: number, iconIndex: number, value: string) => {
    const newSets = [...settings.iconSets];
    newSets[setIndex][iconIndex] = value;
    setSettings({ ...settings, iconSets: newSets });
  };

  const gradientPresets = [
    { name: "Purple-Pink", value: "from-violet-400 via-purple-300 to-pink-400" },
    { name: "Blue-Cyan", value: "from-blue-400 via-cyan-300 to-violet-400" },
    { name: "Green-Emerald", value: "from-green-400 via-emerald-300 to-teal-400" },
    { name: "Orange-Red", value: "from-orange-400 via-red-300 to-pink-400" },
    { name: "Gold-Yellow", value: "from-yellow-400 via-amber-300 to-orange-400" },
  ];

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 font-black text-black">
              R
            </span>
            <b className="text-sm tracking-[.18em]">RAVEN ORACLE</b>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/admin" className="rounded-lg border border-white/10 px-3 py-2 text-xs">
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-12">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">
          CUSTOMIZATION
        </span>
        <h1 className="mt-2 text-5xl font-medium tracking-tight">Hero Settings.</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Customize home page hero section - taglines, colors, icons, and animations.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-300">
            {message}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Enable/Disable */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">Hero Section Status</h2>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                className={`rounded-lg px-6 py-3 text-sm font-black ${
                  settings.enabled
                    ? "bg-emerald-500 text-black"
                    : "bg-zinc-700 text-zinc-400"
                }`}
              >
                {settings.enabled ? "✓ Enabled" : "✗ Disabled"}
              </button>
              <span className="text-xs text-zinc-500">
                {settings.enabled ? "Hero section is visible" : "Hero section is hidden"}
              </span>
            </div>
          </div>

          {/* Taglines */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">Hero Taglines</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400">Line 1</label>
                <input
                  value={settings.tagline1}
                  onChange={(e) => setSettings({ ...settings, tagline1: e.target.value })}
                  maxLength={50}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                  placeholder="The Future of"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400">Line 2</label>
                <input
                  value={settings.tagline2}
                  onChange={(e) => setSettings({ ...settings, tagline2: e.target.value })}
                  maxLength={50}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                  placeholder="NFT Whitelists"
                />
              </div>
            </div>
          </div>

          {/* Gradient Colors */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">Gradient Colors</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400">Line 1 Gradient</label>
                <select
                  value={settings.gradient1}
                  onChange={(e) => setSettings({ ...settings, gradient1: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                >
                  {gradientPresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <div className={`mt-2 h-8 rounded-lg bg-gradient-to-r ${settings.gradient1}`} />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400">Line 2 Gradient</label>
                <select
                  value={settings.gradient2}
                  onChange={(e) => setSettings({ ...settings, gradient2: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                >
                  {gradientPresets.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <div className={`mt-2 h-8 rounded-lg bg-gradient-to-r ${settings.gradient2}`} />
              </div>
            </div>
          </div>

          {/* Icon Sets */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">Floating Card Icons (4 Sets)</h2>
            <p className="mt-2 text-xs text-zinc-500">
              Icons rotate automatically. Each set has 4 icons for the 4 floating cards.
            </p>
            <div className="mt-4 space-y-4">
              {settings.iconSets.map((set, setIndex) => (
                <div key={setIndex} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-xs font-bold text-zinc-400">
                    Set {setIndex + 1}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {set.map((icon, iconIndex) => (
                      <div key={iconIndex}>
                        <label className="block text-[10px] text-zinc-600">
                          Card {iconIndex + 1}
                        </label>
                        <input
                          value={icon}
                          onChange={(e) => updateIcon(setIndex, iconIndex, e.target.value)}
                          maxLength={2}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-center text-2xl outline-none"
                          placeholder="🎨"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Animation Speed */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">Animation Speed</h2>
            <div className="mt-4">
              <label className="block text-xs font-bold text-zinc-400">
                Icon rotation speed (milliseconds)
              </label>
              <input
                type="number"
                value={settings.animationSpeed}
                onChange={(e) =>
                  setSettings({ ...settings, animationSpeed: parseInt(e.target.value) || 4000 })
                }
                min={1000}
                max={10000}
                step={1000}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
              />
              <p className="mt-2 text-xs text-zinc-600">
                Current: {settings.animationSpeed / 1000} seconds per rotation
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={resetToDefault}
              className="flex-1 rounded-lg border border-white/10 py-3 text-sm font-bold"
            >
              Reset to Default
            </button>
            <button
              disabled={busy}
              onClick={saveSettings}
              className="flex-1 rounded-lg bg-violet-500 py-3 text-sm font-black disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
