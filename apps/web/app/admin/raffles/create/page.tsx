"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { API_BASE_URL } from "@/lib/api-config";

type Project = {
  id: string;
  name: string;
  category: string;
  status: string;
};

type Task = {
  type: "X_FOLLOW" | "X_LIKE" | "X_REPOST" | "DISCORD_JOIN";
  title: string;
  target: string;
  targetUrl: string;
  isRequired: boolean;
};

const emptyTask: Task = {
  type: "X_FOLLOW",
  title: "",
  target: "",
  targetUrl: "",
  isRequired: true,
};

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? `Request failed (${response.status})`);
  return data as T;
}

export default function AdminCreateRafflePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prizeName, setPrizeName] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [winnerCount, setWinnerCount] = useState(1);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [tasks, setTasks] = useState<Task[]>([{ ...emptyTask }]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api<{ projects: Project[] }>("/admin/projects?status=APPROVED");
        const nftProjects = data.projects.filter((project) => project.category === "NFT");
        setProjects(nftProjects);
        if (nftProjects.length === 1) setProjectId(nftProjects[0].id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to load projects");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const updateTask = (index: number, patch: Partial<Task>) => {
    setTasks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addTask = () => {
    setTasks((items) => [...items, { ...emptyTask }]);
  };

  const removeTask = (index: number) => {
    setTasks((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const create = async () => {
    setMessage("");
    if (!projectId) return setMessage("Select an approved NFT project.");
    if (!title.trim() || !prizeName.trim() || !startsAt || !endsAt) {
      return setMessage("Title, prize and dates are required.");
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      return setMessage("End time must be after start time.");
    }
    if (new Date(endsAt) <= new Date()) {
      return setMessage("End time must be in the future.");
    }
    if (winnerCount > quantity) {
      return setMessage("Winner count cannot exceed prize quantity.");
    }
    if (tasks.length === 0 || tasks.some((task) => !task.title.trim() || !task.target.trim())) {
      return setMessage("Every task needs a title and target.");
    }

    setBusy(true);
    try {
      const data = await api<{ raffle: { id: string } }>("/admin/raffles", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          prizeName: prizeName.trim(),
          prizeDescription: prizeDescription.trim() || undefined,
          prizeQuantity: quantity,
          winnerCount,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          tasks: tasks.map((task) => ({
            ...task,
            title: task.title.trim(),
            target: task.target.trim(),
            targetUrl: task.targetUrl.trim() || null,
          })),
        }),
      });

      router.push(`/raffles/${data.raffle.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create raffle");
    } finally {
      setBusy(false);
    }
  };

  const minDateTime = localDateTimeValue(new Date());

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <span className="text-[9px] font-black tracking-[.2em] text-violet-300/60">RAFFLE MANAGEMENT</span>
          <h1 className="mt-2 text-5xl font-medium tracking-tight">Create a raffle.</h1>
          <p className="mt-3 text-sm text-zinc-500">Only admins can publish raffles from this panel.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <h2 className="text-lg font-bold">Raffle details</h2>
            <div className="mt-5 grid gap-4">
              <label className="text-xs text-zinc-500">Approved NFT project
                <select value={projectId} disabled={loading} onChange={(event) => setProjectId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none">
                  <option value="">{loading ? "Loading projects…" : "Select project"}</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>

              <label className="text-xs text-zinc-500">Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="XYZ WL Raffle" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
              </label>

              <label className="text-xs text-zinc-500">Description
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What participants are entering for." className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-zinc-500">Prize
                  <input value={prizeName} onChange={(event) => setPrizeName(event.target.value)} placeholder="Whitelist Spot" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
                </label>
                <label className="text-xs text-zinc-500">Prize details
                  <input value={prizeDescription} onChange={(event) => setPrizeDescription(event.target.value)} placeholder="1 NFT whitelist allocation" className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-zinc-500">Prize quantity
                  <input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
                </label>
                <label className="text-xs text-zinc-500">Winner count
                  <input type="number" min={1} value={winnerCount} onChange={(event) => setWinnerCount(Math.max(1, Number(event.target.value)))} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-zinc-500">Starts
                  <input type="datetime-local" value={startsAt} min={minDateTime} step={60} onChange={(event) => setStartsAt(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none color-scheme-dark" />
                </label>
                <label className="text-xs text-zinc-500">Ends
                  <input type="datetime-local" value={endsAt} min={startsAt || minDateTime} step={60} onChange={(event) => setEndsAt(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none color-scheme-dark" />
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#0d0c11] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black tracking-[.2em] text-zinc-600">ELIGIBILITY TASKS</span>
                <h2 className="mt-2 text-lg font-bold">Participant requirements</h2>
              </div>
              <button type="button" onClick={addTask} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">+ Add</button>
            </div>

            <div className="mt-5 space-y-4">
              {tasks.map((task, index) => (
                <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="grid gap-3">
                    <select value={task.type} onChange={(event) => updateTask(index, { type: event.target.value as Task["type"] })} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none">
                      <option value="X_FOLLOW">X Follow</option>
                      <option value="X_LIKE">X Like</option>
                      <option value="X_REPOST">X Repost</option>
                      <option value="DISCORD_JOIN">Discord Join</option>
                    </select>
                    <input value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} placeholder="Task title" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none" />
                    <input value={task.target} onChange={(event) => updateTask(index, { target: event.target.value })} placeholder={task.type === "DISCORD_JOIN" ? "Discord server ID" : "X username / post ID"} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none" />
                    <input value={task.targetUrl} onChange={(event) => updateTask(index, { targetUrl: event.target.value })} placeholder="Target URL (optional)" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white outline-none" />
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={task.isRequired} onChange={(event) => updateTask(index, { isRequired: event.target.checked })} /> Required</label>
                      {tasks.length > 1 && <button type="button" onClick={() => removeTask(index)} className="rounded-lg border border-red-900/40 px-3 py-2 text-[10px] font-bold text-red-300">Remove</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {message && <div className="mt-5 rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-300">{message}</div>}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => router.push("/admin/raffles")} className="rounded-xl border border-white/10 px-6 py-4 text-sm font-bold">Cancel</button>
          <button type="button" disabled={busy || loading} onClick={() => void create()} className="flex-1 rounded-xl bg-violet-500 px-6 py-4 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Creating raffle…" : "Create raffle"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
