"use client";

import { useCallback, useEffect, useState } from "react";
import ThemeToggle from "../../../components/ThemeToggle";
import { API_BASE_URL } from "@/lib/api-config";

type Message = {
  id: string;
  message: string;
  moderationStatus: string;
  createdAt: string;
  user: {
    id: string;
    username?: string | null;
    displayName?: string | null;
  };
  channel: {
    id: string;
    name: string;
    slug: string;
  };
};

type Channel = {
  id: string;
  name: string;
  slug: string;
  type: string;
  isActive: boolean;
  _count?: {
    messages: number;
  };
};

async function api<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = typeof window !== "undefined" ? localStorage.getItem("raven_token") : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filter, setFilter] = useState<"FLAGGED" | "HIDDEN" | "REMOVED" | "VISIBLE">("FLAGGED");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadChannels = useCallback(async () => {
    try {
      const data = await api<{ success: boolean; channels: Channel[] }>("/admin/chat/channels");
      setChannels(data.channels);
    } catch (e) {
      console.error("Failed to load channels:", e);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ success: boolean; messages: Message[] }>(
        `/admin/chat/messages?status=${filter}`
      );
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load messages");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const moderate = async (
    messageId: string,
    status: "VISIBLE" | "HIDDEN" | "REMOVED" | "FLAGGED",
    reason?: string
  ) => {
    setBusy(messageId);
    setError("");
    try {
      await api(`/chat/messages/${messageId}/moderate`, {
        method: "PATCH",
        body: JSON.stringify({
          moderationStatus: status,
          reason: reason || `Message set to ${status} by moderator`,
        }),
      });
      setMessage(`Message ${status.toLowerCase()} successfully`);
      await loadMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Moderation failed");
    } finally {
      setBusy(null);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Permanently remove this message? This cannot be undone.")) return;
    setBusy(messageId);
    setError("");
    try {
      await api(`/chat/messages/${messageId}`, {
        method: "DELETE",
      });
      setMessage("Message deleted successfully");
      await loadMessages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const toggleChannel = async (channelId: string, isActive: boolean) => {
    try {
      await api(`/admin/chat/channels/${channelId}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !isActive }),
      });
      setMessage(`Channel ${!isActive ? "activated" : "deactivated"}`);
      await loadChannels();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Channel update failed");
    }
  };

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between px-4">
          <a href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500 font-black text-black">
              R
            </span>
            <b className="text-sm tracking-[.18em]">RAVEN ORACLE</b>
          </a>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/admin" className="rounded-lg border border-white/10 px-3 py-2 text-xs">
              Back to Admin
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto w-[min(1180px,calc(100%-32px))] px-4 py-12">
        <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">
          CHAT MODERATION
        </span>
        <h1 className="mt-2 text-5xl font-medium tracking-tight">Community chat.</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Moderate chat messages and manage channels.
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

        {/* Channel Management */}
        <div className="mt-8">
          <h2 className="mb-4 text-sm font-bold">Active Channels</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="rounded-xl border border-white/10 bg-[#0d0c11] p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <b className="text-sm"># {channel.name}</b>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                          channel.isActive
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-zinc-500/10 text-zinc-500"
                        }`}
                      >
                        {channel.isActive ? "ACTIVE" : "DISABLED"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {channel.type} • {channel._count?.messages ?? 0} messages
                    </p>
                  </div>
                  <button
                    onClick={() => toggleChannel(channel.id, channel.isActive)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold hover:bg-white/5"
                  >
                    {channel.isActive ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Filters */}
        <div className="mt-10 flex flex-wrap gap-2">
          {(["FLAGGED", "HIDDEN", "REMOVED", "VISIBLE"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`rounded-lg px-4 py-2 text-[10px] font-black ${
                filter === status
                  ? "bg-white text-black"
                  : "border border-white/10 text-zinc-500"
              }`}
            >
              {status}
            </button>
          ))}
          <button
            onClick={() => void loadMessages()}
            className="ml-auto rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold"
          >
            Refresh
          </button>
        </div>

        {/* Messages List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-600">
            Loading moderation queue…
          </div>
        ) : messages.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-16 text-center text-sm text-zinc-600">
            No {filter.toLowerCase()} messages.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {messages.map((msg) => (
              <article
                key={msg.id}
                className="rounded-2xl border border-white/10 bg-[#0d0c11] p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-500/10 text-xs font-black">
                    {(msg.user.displayName || msg.user.username || "?")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="text-sm">
                        {msg.user.displayName || msg.user.username || "Unknown User"}
                      </b>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[9px] text-zinc-500">
                        # {msg.channel.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-black ${
                          msg.moderationStatus === "VISIBLE"
                            ? "bg-emerald-500/10 text-emerald-300"
                            : msg.moderationStatus === "FLAGGED"
                              ? "bg-yellow-500/10 text-yellow-300"
                              : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        {msg.moderationStatus}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                      {msg.message}
                    </p>
                    <p className="mt-2 text-[10px] text-zinc-700">
                      {new Date(msg.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Moderation Actions */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                  {msg.moderationStatus !== "VISIBLE" && (
                    <button
                      disabled={busy === msg.id}
                      onClick={() => void moderate(msg.id, "VISIBLE")}
                      className="rounded-lg border border-emerald-900/40 px-3 py-2 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  {msg.moderationStatus !== "HIDDEN" && (
                    <button
                      disabled={busy === msg.id}
                      onClick={() => void moderate(msg.id, "HIDDEN", "Hidden by moderator")}
                      className="rounded-lg border border-yellow-900/40 px-3 py-2 text-[10px] font-bold text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
                    >
                      Hide
                    </button>
                  )}
                  {msg.moderationStatus !== "FLAGGED" && (
                    <button
                      disabled={busy === msg.id}
                      onClick={() => void moderate(msg.id, "FLAGGED", "Flagged for review")}
                      className="rounded-lg border border-orange-900/40 px-3 py-2 text-[10px] font-bold text-orange-300 hover:bg-orange-500/10 disabled:opacity-50"
                    >
                      Flag
                    </button>
                  )}
                  <button
                    disabled={busy === msg.id}
                    onClick={() => void deleteMessage(msg.id)}
                    className="ml-auto rounded-lg border border-red-900/40 px-3 py-2 text-[10px] font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {busy === msg.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
