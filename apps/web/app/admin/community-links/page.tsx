"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "../../../components/ThemeToggle";

type CommunityLink = {
  id: string;
  name: string;
  url: string;
  imageUrl: string;
  order: number;
};

const defaultLinks: CommunityLink[] = [
  {
    id: "1",
    name: "Smyths Community",
    url: "https://discord.gg/smyths",
    imageUrl: "/community/smyths.jpg",
    order: 1,
  },
  {
    id: "2",
    name: "Meegos Community",
    url: "https://discord.gg/meegos",
    imageUrl: "/community/meegos.jpg",
    order: 2,
  },
];

export default function AdminCommunityLinksPage() {
  const [links, setLinks] = useState<CommunityLink[]>(defaultLinks);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CommunityLink>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("community_links");
    if (saved) {
      try {
        setLinks(JSON.parse(saved));
      } catch {
        setLinks(defaultLinks);
      }
    }
  }, []);

  const saveLinks = () => {
    localStorage.setItem("community_links", JSON.stringify(links));
    setMessage("Community links saved! Refresh home page to see changes.");
    setError("");
  };

  const addNew = () => {
    const newLink: CommunityLink = {
      id: Date.now().toString(),
      name: "New Community",
      url: "https://discord.gg/your-server",
      imageUrl: "/community/placeholder.jpg",
      order: links.length + 1,
    };
    setLinks([...links, newLink]);
    setEditing(newLink.id);
    setEditForm(newLink);
  };

  const startEdit = (link: CommunityLink) => {
    setEditing(link.id);
    setEditForm(link);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (!editing) return;
    const updated = links.map((l) =>
      l.id === editing ? { ...l, ...editForm } : l
    );
    setLinks(updated);
    setEditing(null);
    setEditForm({});
    setMessage("Link updated. Click 'Save All Changes' to persist.");
  };

  const deleteLink = (id: string) => {
    if (confirm("Are you sure you want to delete this community link?")) {
      setLinks(links.filter((l) => l.id !== id));
      setMessage("Link deleted. Click 'Save All Changes' to persist.");
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newLinks = [...links];
    [newLinks[index - 1], newLinks[index]] = [newLinks[index], newLinks[index - 1]];
    newLinks.forEach((l, i) => (l.order = i + 1));
    setLinks(newLinks);
  };

  const moveDown = (index: number) => {
    if (index === links.length - 1) return;
    const newLinks = [...links];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    newLinks.forEach((l, i) => (l.order = i + 1));
    setLinks(newLinks);
  };

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
          FOOTER CUSTOMIZATION
        </span>
        <h1 className="mt-2 text-5xl font-medium tracking-tight">Community Links.</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Manage community links displayed in the footer "Join our communities" section.
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

        <div className="mt-8 space-y-4">
          {links.map((link, index) => (
            <div
              key={link.id}
              className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6"
            >
              {editing === link.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400">
                      Community Name
                    </label>
                    <input
                      value={editForm.name || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                      placeholder="Smyths Community"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400">
                      Discord/Link URL
                    </label>
                    <input
                      value={editForm.url || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, url: e.target.value })
                      }
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                      placeholder="https://discord.gg/your-server"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400">
                      Image URL
                    </label>
                    <input
                      value={editForm.imageUrl || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, imageUrl: e.target.value })
                      }
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black px-4 py-3 text-sm outline-none"
                      placeholder="/community/image.jpg or https://..."
                    />
                    <p className="mt-1 text-xs text-zinc-600">
                      Upload images to /public/community/ folder
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEdit}
                      className="flex-1 rounded-lg border border-white/10 py-2 text-sm font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex-1 rounded-lg bg-violet-500 py-2 text-sm font-black"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-32 overflow-hidden rounded-lg border border-white/10 bg-black">
                      {link.imageUrl.startsWith("http") || link.imageUrl.startsWith("/") ? (
                        <img
                          src={link.imageUrl}
                          alt={link.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='64'%3E%3Crect fill='%23333' width='128' height='64'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-family='monospace' font-size='10'%3ENo Image%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                          No image
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold">{link.name}</h3>
                      <p className="mt-1 text-xs text-zinc-500 truncate max-w-md">
                        {link.url}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === links.length - 1}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => startEdit(link)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="rounded-lg border border-red-900/40 px-3 py-2 text-xs font-bold text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={addNew}
            className="flex-1 rounded-lg border border-white/10 py-3 text-sm font-bold"
          >
            + Add New Community Link
          </button>
          <button
            onClick={saveLinks}
            className="flex-1 rounded-lg bg-violet-500 py-3 text-sm font-black"
          >
            Save All Changes
          </button>
        </div>
      </section>
    </main>
  );
}
