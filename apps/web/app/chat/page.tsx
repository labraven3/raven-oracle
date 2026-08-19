"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api-config";

type Channel = { id: string; name: string; slug: string; type: string };
type Message = {
  id: string;
  message: string;
  createdAt: string;
  user: { username?: string | null; displayName?: string | null; avatarUrl?: string | null };
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

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channel, setChannel] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const d = await api<{ channels: Channel[] }>("/chat/channels");
        setChannels(d.channels);
        if (d.channels[0] && !d.channels.some((c) => c.slug === channel))
          setChannel(d.channels[0].slug);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load chat");
      }
    };
    void init();
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const d = await api<{ messages: Message[] }>(`/chat/channels/${channel}/messages`);
        setMessages(d.messages);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load messages");
      }
    };
    void init();
    const id = setInterval(() => {
      void init();
    }, 5000);
    return () => clearInterval(id);
  }, [channel]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const d = await api<{ message: Message }>(`/chat/channels/${channel}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages((v) => [...v, d.message]);
      setText("");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login required to chat");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#07070a] text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070a]/90 px-5 py-5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="font-black tracking-[.18em]">
            RAVEN ORACLE
          </Link>
          <nav className="flex gap-5 text-xs text-zinc-500">
            <Link href="/raffles">Raffles</Link>
            <Link href="/projects">Projects</Link>
            <Link href="/alpha">Alpha</Link>
            <Link href="/account">Account</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-7">
          <span className="text-[9px] font-black tracking-[.25em] text-violet-300/70">
            COMMUNITY CHAT
          </span>
          <h1 className="mt-3 text-4xl font-medium">Talk with the Raven community.</h1>
          <p className="mt-3 text-sm text-zinc-600">
            Live polling keeps the room updated without exposing a public socket endpoint.
          </p>
        </div>
        <div className="grid min-h-[650px] gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-2xl border border-white/10 bg-[#0d0c11] p-3">
            <span className="px-3 text-[9px] font-black tracking-wider text-zinc-700">
              CHANNELS
            </span>
            <div className="mt-3 space-y-1">
              {channels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.slug)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-xs ${
                    channel === c.slug ? "bg-violet-500/10 text-violet-200" : "text-zinc-500 hover:bg-white/5"
                  }`}
                >
                  # {c.name}
                </button>
              ))}
            </div>
          </aside>
          <section className="flex min-h-[650px] flex-col rounded-2xl border border-white/10 bg-[#0d0c11]">
            <div className="border-b border-white/10 px-5 py-4">
              <b className="text-sm">
                # {channels.find((c) => c.slug === channel)?.name || channel}
              </b>
              <span className="ml-3 text-[9px] text-zinc-700">COMMUNITY</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <div className="grid h-full place-items-center text-xs text-zinc-700">
                  No messages yet. Start the conversation.
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500/10 text-[10px] font-black">
                      {(m.user.displayName || m.user.username || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div>
                        <b className="text-xs">
                          {m.user.displayName || m.user.username || "Raven member"}
                        </b>
                        <span className="ml-2 text-[9px] text-zinc-700">
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-500">
                        {m.message}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {error && (
              <div className="mx-5 mb-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
                {error}
              </div>
            )}
            <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-4">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={1000}
                placeholder="Message the community…"
                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs outline-none"
              />
              <button
                disabled={busy}
                className="rounded-xl bg-violet-500 px-5 text-xs font-black disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
