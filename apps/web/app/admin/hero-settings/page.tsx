"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";

type HeroSettings = {
  enabled: boolean;
  tagline1: string;
  tagline2: string;
  gradient1Color1: string;
  gradient1Color2: string;
  gradient1Color3: string;
  gradient2Color1: string;
  gradient2Color2: string;
  gradient2Color3: string;
  iconSets: string[][];
  animationSpeed: number;
};

const defaultSettings: HeroSettings = {
  enabled: true,
  tagline1: "The Future of",
  tagline2: "NFT Whitelists",
  gradient1Color1: "#a78bfa",
  gradient1Color2: "#c084fc",
  gradient1Color3: "#f0abfc",
  gradient2Color1: "#60a5fa",
  gradient2Color2: "#67e8f9",
  gradient2Color3: "#a78bfa",
  iconSets: [
    ["https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150"],
    ["https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150"],
    ["https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150"],
    ["https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150", "https://via.placeholder.com/150"],
  ],
  animationSpeed: 3000,
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

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">
            CUSTOMIZATION
          </span>
          <h1 className="mt-2 text-5xl font-medium tracking-tight">Hero Settings.</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Customize home page hero section - taglines, colors, icons, and animations.
          </p>
        </div>

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
            <h2 className="text-xl font-bold mb-2">Gradient Colors</h2>
            <p className="text-xs text-zinc-500 mb-4">Pick any color for each gradient position</p>
            
            <div className="space-y-6">
              {/* Line 1 Gradient */}
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-3">Line 1 Gradient (Tagline 1)</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">Start Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.gradient1Color1}
                        onChange={(e) => setSettings({ ...settings, gradient1Color1: e.target.value })}
                        className="w-16 h-10 rounded border border-white/10 bg-black cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.gradient1Color1}
                        onChange={(e) => setSettings({ ...settings, gradient1Color1: e.target.value })}
                        className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none"
                        placeholder="#a78bfa"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">Middle Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.gradient1Color2}
                        onChange={(e) => setSettings({ ...settings, gradient1Color2: e.target.value })}
                        className="w-16 h-10 rounded border border-white/10 bg-black cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.gradient1Color2}
                        onChange={(e) => setSettings({ ...settings, gradient1Color2: e.target.value })}
                        className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none"
                        placeholder="#c084fc"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">End Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.gradient1Color3}
                        onChange={(e) => setSettings({ ...settings, gradient1Color3: e.target.value })}
                        className="w-16 h-10 rounded border border-white/10 bg-black cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.gradient1Color3}
                        onChange={(e) => setSettings({ ...settings, gradient1Color3: e.target.value })}
                        className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none"
                        placeholder="#f0abfc"
                      />
                    </div>
                  </div>
                </div>
                <div 
                  className="mt-3 h-12 rounded-lg"
                  style={{
                    background: `linear-gradient(to right, ${settings.gradient1Color1}, ${settings.gradient1Color2}, ${settings.gradient1Color3})`
                  }}
                />
              </div>

              {/* Line 2 Gradient */}
              <div>
                <label className="block text-sm font-bold text-zinc-300 mb-3">Line 2 Gradient (Tagline 2)</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">Start Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.gradient2Color1}
                        onChange={(e) => setSettings({ ...settings, gradient2Color1: e.target.value })}
                        className="w-16 h-10 rounded border border-white/10 bg-black cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.gradient2Color1}
                        onChange={(e) => setSettings({ ...settings, gradient2Color1: e.target.value })}
                        className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none"
                        placeholder="#60a5fa"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">Middle Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.gradient2Color2}
                        onChange={(e) => setSettings({ ...settings, gradient2Color2: e.target.value })}
                        className="w-16 h-10 rounded border border-white/10 bg-black cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.gradient2Color2}
                        onChange={(e) => setSettings({ ...settings, gradient2Color2: e.target.value })}
                        className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none"
                        placeholder="#67e8f9"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-2">End Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.gradient2Color3}
                        onChange={(e) => setSettings({ ...settings, gradient2Color3: e.target.value })}
                        className="w-16 h-10 rounded border border-white/10 bg-black cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.gradient2Color3}
                        onChange={(e) => setSettings({ ...settings, gradient2Color3: e.target.value })}
                        className="flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none"
                        placeholder="#a78bfa"
                      />
                    </div>
                  </div>
                </div>
                <div 
                  className="mt-3 h-12 rounded-lg"
                  style={{
                    background: `linear-gradient(to right, ${settings.gradient2Color1}, ${settings.gradient2Color2}, ${settings.gradient2Color3})`
                  }}
                />
              </div>
            </div>
          </div>
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

          {/* Icon Sets - Now with Image URLs */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-xl font-bold">Floating Card Images (4 Sets)</h2>
            <p className="mt-2 text-xs text-zinc-500">
              Images rotate automatically. Each set has 4 images for the 4 floating cards. Use PNG/JPG URLs that will stretch to fill the card.
            </p>
            <div className="mt-4 space-y-4">
              {settings.iconSets.map((set, setIndex) => (
                <div key={setIndex} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 text-xs font-bold text-zinc-400">
                    Set {setIndex + 1}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {set.map((imageUrl, iconIndex) => (
                      <div key={iconIndex} className="space-y-2">
                        <label className="block text-[10px] text-zinc-600">
                          Card {iconIndex + 1} - Image URL
                        </label>
                        <input
                          value={imageUrl}
                          onChange={(e) => updateIcon(setIndex, iconIndex, e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-xs outline-none"
                          placeholder="https://example.com/image.png"
                        />
                        {imageUrl && (
                          <div className="relative w-full h-24 rounded-lg overflow-hidden bg-black border border-white/10">
                            <img
                              src={imageUrl}
                              alt={`Card ${iconIndex + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = "https://via.placeholder.com/150?text=Invalid+URL";
                              }}
                            />
                          </div>
                        )}
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
      </div>
    </AdminLayout>
  );
}
