const fs = require("fs");
const cp = require("child_process");

const files = {
  xVerifier: "apps/api/src/services/raffle-task-verification.service.ts",
  tasksApi: "apps/api/src/routes/raffle-tasks.ts",
  draftsApi: "apps/api/src/routes/raffle-drafts.ts",
  rafflesApi: "apps/api/src/routes/raffles.ts",
  winnersApi: "apps/api/src/routes/raffle-winners.ts",
  projectsApi: "apps/api/src/routes/projects.ts",
  dashboard: "apps/web/app/dashboard/projects/[id]/page.tsx",
  draftsPage: "apps/web/app/dashboard/projects/[id]/drafts/page.tsx",
  siteChrome: "apps/web/components/SiteChrome.tsx",
};

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, text) {
  fs.writeFileSync(file, text);
}

function replaceOnce(file, oldValue, newValue, label) {
  const text = read(file);
  if (!text.includes(oldValue)) throw new Error(`Patch target not found: ${label}`);
  write(file, text.replace(oldValue, newValue));
}

function replaceRegex(file, pattern, newValue, label) {
  const text = read(file);
  const next = text.replace(pattern, newValue);
  if (next === text) throw new Error(`Patch regex target not found: ${label}`);
  write(file, next);
}

// ------------------------------------------------------------
// 1) X verification: resolve targets from URLs/embedded text and
//    prefer the actual project X URL before a human-readable task title.
// ------------------------------------------------------------
replaceRegex(
  files.xVerifier,
  /function extractXUsername\(value: string\): string \| null \{[\s\S]*?\n\}\n\nfunction extractXTweetId/s,
  `function extractXUsername(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\\d+$/.test(raw)) return raw;

  const profileUrl = raw.match(/(?:https?:\\/\\/)?(?:www\\.)?(?:x\\.com|twitter\\.com)\\/([A-Za-z0-9_]{1,15})(?:\\/|\\?|$)/i);
  if (profileUrl?.[1]) return profileUrl[1];

  const mention = raw.match(/@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/);
  if (mention?.[1]) return mention[1];

  try {
    const url = new URL(raw);
    if (!["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname.toLowerCase())) return null;
    const first = url.pathname.split("/").filter(Boolean)[0];
    return first && /^[A-Za-z0-9_]{1,15}$/.test(first) ? first : null;
  } catch {
    return /^[A-Za-z0-9_]{1,15}$/.test(raw) ? raw : null;
  }
}

function extractXTweetId(value: string): string | null {
  const raw = value.trim();
  if (/^\\d+$/.test(raw)) return raw;
  const match = raw.match(/(?:https?:\\/\\/)?(?:www\\.)?(?:x\\.com|twitter\\.com)\\/[^/]+\\/status\\/(\\d+)/i);
  return match?.[1] ?? null;
}
`,
  "robust X target parsers",
);

replaceOnce(
  files.xVerifier,
  `function pickXFollowTarget(targetUrl: string | null | undefined, target: string, projectXUrl: string | null | undefined) {
  for (const value of [targetUrl ?? "", target, projectXUrl ?? ""]) {
    if (extractXUsername(value)) return value;
  }
  return targetUrl || target || projectXUrl || "";
}`,
  `function pickXFollowTarget(targetUrl: string | null | undefined, target: string, projectXUrl: string | null | undefined) {
  for (const value of [targetUrl ?? "", projectXUrl ?? "", target]) {
    if (extractXUsername(value)) return value;
  }
  return "";
}`,
  "X follow target precedence",
);

replaceOnce(
  files.xVerifier,
  `  const targetValue = pickXFollowTarget(undefined, target, projectXUrl);`,
  `  const targetValue = pickXFollowTarget(null, target, projectXUrl);`,
  "X follow target call",
);

// ------------------------------------------------------------
// 2) Task APIs: automatically derive Follow/Discord URLs from
//    the owning project's canonical social URLs.
// ------------------------------------------------------------
replaceOnce(
  files.tasksApi,
  `const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true } });`,
  `const raffle = await prisma.raffle.findUnique({
      where: { id: raffleId },
      select: { id: true, createdByUserId: true, project: { select: { xUrl: true, discordUrl: true } } },
    });`,
  "task create project social URLs",
);

replaceOnce(
  files.tasksApi,
  `    const task = await prisma.raffleTask.create({ data: { raffleId, type: parsed.data.type, title: parsed.data.title, description: parsed.data.description ?? null, target: parsed.data.target, targetUrl: parsed.data.targetUrl ?? null, isRequired: parsed.data.isRequired, sortOrder: parsed.data.sortOrder } });`,
  `    const derivedTargetUrl = parsed.data.targetUrl ||
      (parsed.data.type === "X_FOLLOW" ? raffle.project?.xUrl :
      parsed.data.type === "DISCORD_JOIN" ? raffle.project?.discordUrl :
      null) ||
      ((parsed.data.type === "X_LIKE" || parsed.data.type === "X_REPOST") && /^https?:\\/\\//i.test(parsed.data.target) ? parsed.data.target : null);
    const task = await prisma.raffleTask.create({
      data: { raffleId, type: parsed.data.type, title: parsed.data.title, description: parsed.data.description ?? null, target: parsed.data.target, targetUrl: derivedTargetUrl, isRequired: parsed.data.isRequired, sortOrder: parsed.data.sortOrder },
    });`,
  "task create target URL derivation",
);

replaceOnce(
  files.tasksApi,
  `    const task = await prisma.raffleTask.findUnique({ where: { id: taskId }, include: { raffle: { select: { createdByUserId: true } } } });`,
  `    const task = await prisma.raffleTask.findUnique({
      where: { id: taskId },
      include: { raffle: { select: { createdByUserId: true, project: { select: { xUrl: true, discordUrl: true } } } } },
    });`,
  "task update project social URLs",
);

replaceOnce(
  files.tasksApi,
  `    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined)); const updated = await prisma.raffleTask.update({ where: { id: taskId }, data }); return res.json({ success: true, task: updated });`,
  `    const data = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined));
    if (!data.targetUrl) {
      const fallback = data.type === "X_FOLLOW" ? task.raffle.project?.xUrl : data.type === "DISCORD_JOIN" ? task.raffle.project?.discordUrl : null;
      if (fallback) data.targetUrl = fallback;
    }
    const updated = await prisma.raffleTask.update({ where: { id: taskId }, data });
    return res.json({ success: true, task: updated });`,
  "task update target URL derivation",
);

// ------------------------------------------------------------
// 3) Draft publishing: derive canonical URLs before validation.
// ------------------------------------------------------------
replaceOnce(
  files.draftsApi,
  `    const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true, deletedAt: true, submittedByUserId: true },
  });`,
  `    const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, status: true, deletedAt: true, submittedByUserId: true, xUrl: true, discordUrl: true },
  });`,
  "draft ownedProject social URLs",
);

// Publish block owns a parsed draft; derive targets immediately before validation.
replaceOnce(
  files.draftsApi,
  `    const draft = draftData(existing); const parsed = draftSchema.safeParse(draft);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid draft data", errors: parsed.error.issues });
    const data = parsed.data;`,
  `    const draft = draftData(existing); const parsed = draftSchema.safeParse(draft);
    if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid draft data", errors: parsed.error.issues });
    const data = {
      ...parsed.data,
      tasks: parsed.data.tasks.map((task) => ({
        ...task,
        targetUrl: task.targetUrl ||
          (task.type === "X_FOLLOW" ? project.xUrl : task.type === "DISCORD_JOIN" ? project.discordUrl : null) ||
          ((task.type === "X_LIKE" || task.type === "X_REPOST") && /^https?:\\/\\//i.test(task.target) ? task.target : ""),
      })),
    };`,
  "draft publish target normalization",
);

// Require at least one task at publish time, while drafts may remain empty.
replaceOnce(
  files.draftsApi,
  `    const taskIssue = validatePublishedTasks(data.tasks);`,
  `    if (!data.tasks.length) return res.status(400).json({ success: false, message: "Add at least one participant task before publishing" });
    const taskIssue = validatePublishedTasks(data.tasks);`,
  "draft publish minimum task",
);

// ------------------------------------------------------------
// 4) Creator raffle endpoint: derive social task URLs and support
//    project owner publishing without approval gate.
// ------------------------------------------------------------
replaceOnce(
  files.projectsApi,
  `select: { id: true, name: true, status: true, deletedAt: true, submittedByUserId: true }`,
  `select: { id: true, name: true, status: true, deletedAt: true, submittedByUserId: true, xUrl: true, discordUrl: true }`,
  "creator raffle project social URLs",
);

replaceOnce(
  files.projectsApi,
  `const data = parsed.data; const startsAt = new Date(data.startsAt); const endsAt = new Date(data.endsAt);`,
  `const data = {
    ...parsed.data,
    tasks: parsed.data.tasks.map((task) => ({
      ...task,
      targetUrl: task.targetUrl ||
        (task.type === "X_FOLLOW" ? project.xUrl : task.type === "DISCORD_JOIN" ? project.discordUrl : null) ||
        ((task.type === "X_LIKE" || task.type === "X_REPOST") && /^https?:\\/\\//i.test(task.target) ? task.target : ""),
    })),
  };
  const startsAt = new Date(data.startsAt); const endsAt = new Date(data.endsAt);`,
  "creator raffle task normalization",
);

replaceOnce(
  files.projectsApi,
  `await tx.raffleTask.createMany({ data: data.tasks.map((task, index) => ({ raffleId: created.id, type: task.type, title: task.title, description: task.description || null, target: task.target, targetUrl: task.targetUrl || null, isRequired: task.isRequired, sortOrder: index })) });`,
  `await tx.raffleTask.createMany({ data: data.tasks.map((task, index) => ({ raffleId: created.id, type: task.type, title: task.title, description: task.description || null, target: task.target, targetUrl: task.targetUrl || null, isRequired: task.isRequired, sortOrder: index })) });`,
  "creator raffle tasks keep normalized URL",
);

// Owner project deletion = soft-delete + cancel unfinished raffles; preserve history/audit records.
const projectDeleteAnchor = `router.get("/:id/manage", requireAuth, async (req, res, next) => {`;
if (!read(files.projectsApi).includes(`router.delete("/:id", requireAuth`)) {
  replaceOnce(
    files.projectsApi,
    projectDeleteAnchor,
    `router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Authentication required" });
    const projectId = getProjectId(req, res); if (!projectId) return;
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, submittedByUserId: true, deletedAt: true } });
    if (!project || project.deletedAt) return res.status(404).json({ success: false, message: "Project not found" });
    if (project.submittedByUserId !== req.userId) return res.status(403).json({ success: false, message: "You do not own this project" });
    await prisma.$transaction(async (tx) => {
      await tx.raffle.updateMany({ where: { projectId, status: { in: ["DRAFT", "SCHEDULED", "ACTIVE"] }, cancelledAt: null }, data: { status: "CANCELLED", cancelledAt: new Date() } });
      await tx.project.update({ where: { id: projectId }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
    });
    return res.json({ success: true, message: "Project deleted" });
  } catch (error) { next(error); }
});

${projectDeleteAnchor}`,
    "creator project delete route",
  );
}

// ------------------------------------------------------------
// 5) Raffle deletion + automatic close when drawing after expiry.
// ------------------------------------------------------------
if (!read(files.rafflesApi).includes(`router.delete("/:id", requireAuth`)) {
  replaceOnce(
    files.rafflesApi,
    `router.post("/:id/cancel", requireAuth`,
    `router.delete("/:id", requireAuth, asyncRoute(async (req, res) => {
  if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; }
  const raffleId = getRaffleId(req, res); if (!raffleId) return;
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, cancelledAt: true, _count: { select: { entries: true, winners: true } } } });
  if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; }
  if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle creator can delete this raffle" }); return; }
  if (raffle.cancelledAt) { res.status(400).json({ success: false, message: "Raffle is already deleted/cancelled" }); return; }
  if (["COMPLETED", "DRAWING"].includes(raffle.status) || raffle._count.entries > 0 || raffle._count.winners > 0) {
    res.status(400).json({ success: false, message: "This raffle already has participant or winner data. Cancel it instead of deleting it." });
    return;
  }
  await prisma.raffle.update({ where: { id: raffleId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  res.json({ success: true, message: "Raffle deleted" });
}));
router.post("/:id/cancel", requireAuth`,
    "creator raffle delete route",
  );
}

replaceOnce(
  files.rafflesApi,
  `router.post("/:id/draw", requireAuth, asyncRoute(async (req, res) => { if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; } const raffleId = getRaffleId(req, res); if (!raffleId) return; const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true, status: true, endsAt: true } }); if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; } if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle creator can draw this raffle" }); return; } if (raffle.status !== "CLOSED") return res.status(400).json({ success: false, message: "Raffle entries must be closed before drawing winners" }); if (new Date() < raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle cannot be drawn before its end time" }); const result = await drawRaffle(raffleId, req.userId); const notificationResults = await Promise.allSettled(result.winners.map((winner) => notifyWinner(raffleId, winner.id))); const notifications = notificationResults.map((item, index) => ({ winnerId: result.winners[index]?.id, sent: item.status === "fulfilled", error: item.status === "rejected" ? (item.reason instanceof Error ? item.reason.message : "Notification failed") : null })); return res.json({ success: true, ...result, notifications }); }));`,
  `router.post("/:id/draw", requireAuth, asyncRoute(async (req, res) => {
  if (!req.userId) { res.status(401).json({ success: false, message: "Authentication required" }); return; }
  const raffleId = getRaffleId(req, res); if (!raffleId) return;
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { createdByUserId: true, status: true, endsAt: true } });
  if (!raffle) { res.status(404).json({ success: false, message: "Raffle not found" }); return; }
  if (raffle.createdByUserId !== req.userId) { res.status(403).json({ success: false, message: "Only the raffle creator can draw this raffle" }); return; }
  const now = new Date();
  if (["SCHEDULED", "ACTIVE"].includes(raffle.status) && now >= raffle.endsAt) {
    await prisma.raffle.update({ where: { id: raffleId }, data: { status: "CLOSED" } });
    raffle.status = "CLOSED";
  }
  if (raffle.status !== "CLOSED") return res.status(400).json({ success: false, message: "Raffle entries must be closed before drawing winners" });
  if (new Date() < raffle.endsAt) return res.status(400).json({ success: false, message: "Raffle cannot be drawn before its end time" });
  const result = await drawRaffle(raffleId, req.userId);
  const notificationResults = await Promise.allSettled(result.winners.map((winner) => notifyWinner(raffleId, winner.id)));
  const notifications = notificationResults.map((item, index) => ({ winnerId: result.winners[index]?.id, sent: item.status === "fulfilled", error: item.status === "rejected" ? (item.reason instanceof Error ? item.reason.message : "Notification failed") : null }));
  return res.json({ success: true, ...result, notifications });
}));`,
  "auto-close before draw",
);

// ------------------------------------------------------------
// 6) Winners: auto-close expired raffle when creator/winner opens it.
// ------------------------------------------------------------
replaceOnce(
  files.winnersApi,
  `const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true } });`,
  `const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { id: true, createdByUserId: true, status: true, title: true, winnerCount: true, prizeName: true, endsAt: true } });`,
  "winner page end date",
);

replaceOnce(
  files.winnersApi,
  `    const isCreator = raffle.createdByUserId === req.userId;`,
  `    if (["SCHEDULED", "ACTIVE"].includes(raffle.status) && new Date() >= raffle.endsAt) {
      await prisma.raffle.update({ where: { id: raffleId }, data: { status: "CLOSED" } });
      raffle.status = "CLOSED";
    }
    const isCreator = raffle.createdByUserId === req.userId;`,
  "auto-close winners view",
);

// ------------------------------------------------------------
// 7) Project dashboard: remove old NFT contract/standard UI,
//    add delete actions, raffle delete/winners actions, and task delete.
// ------------------------------------------------------------
replaceOnce(
  files.dashboard,
  `function metadataSummary(type: ProjectType, metadata: Metadata) { const rows: Array<[string,string]> = type === "TOKEN" ? [["Symbol", metaValue(metadata,"symbol")],["Contract",metaValue(metadata,"contractAddress")],["Standard",metaValue(metadata,"tokenStandard")],["Decimals",metaValue(metadata,"decimals")],["Launch",metaValue(metadata,"launchDate")]] : type === "AIRDROP" ? [["Snapshot",metaValue(metadata,"snapshotDate")],["Claim",metaValue(metadata,"claimDate")],["Allocation",metaValue(metadata,"allocation")],["Claim URL",metaValue(metadata,"claimUrl")]] : type === "NFT" ? [["Contract",metaValue(metadata,"collectionContractAddress")],["Supply",metaValue(metadata,"supply")],["Standard",metaValue(metadata,"standard")]] : [["Subtype",metaValue(metadata,"subtype")],["Official URL",metaValue(metadata,"externalUrl")]]; return rows.filter(([,value]) => value.trim()); }`,
  `function metadataSummary(type: ProjectType, metadata: Metadata) { const rows: Array<[string,string]> = type === "TOKEN" ? [["Symbol", metaValue(metadata,"symbol")],["Contract",metaValue(metadata,"contractAddress")],["Standard",metaValue(metadata,"tokenStandard")],["Decimals",metaValue(metadata,"decimals")],["Launch",metaValue(metadata,"launchDate")]] : type === "AIRDROP" ? [["Snapshot",metaValue(metadata,"snapshotDate")],["Claim",metaValue(metadata,"claimDate")],["Allocation",metaValue(metadata,"allocation")],["Claim URL",metaValue(metadata,"claimUrl")]] : type === "NFT" ? [["Supply", metaValue(metadata,"supply")],["Mint date", metaValue(metadata,"mintDate") || "TBD"]] : [["Subtype",metaValue(metadata,"subtype")],["Official URL",metaValue(metadata,"externalUrl")]]; return rows.filter(([,value]) => value.trim()); }`,
  "NFT dashboard metadata summary",
);

replaceOnce(
  files.dashboard,
  `  const addTask = () => setTasks((items) => [...items, { type: "X_FOLLOW", title: "", description: "", target: "", targetUrl: "", isRequired: true }]);\n  const createRaffle =`,
  `  const addTask = () => setTasks((items) => [...items, { type: "X_FOLLOW", title: "", description: "", target: "", targetUrl: "", isRequired: true }]);
  const deleteProject = async () => { if (!project || !window.confirm("Delete this NFT project? Unfinished/live raffles will be cancelled and the project will be hidden.")) return; setBusy(true); try { await api(`/projects/${project.id}`, { method: "DELETE" }); router.push("/dashboard"); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to delete project"); } finally { setBusy(false); } };
  const deleteRaffle = async (raffleId: string) => { if (!window.confirm("Delete this raffle? It can only be removed before participants enter.")) return; setBusy(true); try { await api(`/raffles/${raffleId}`, { method: "DELETE" }); setMessage("Raffle deleted."); await load(); } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to delete raffle"); } finally { setBusy(false); } };
  const createRaffle =`,
  "dashboard delete actions",
);

replaceOnce(
  files.dashboard,
  `<Link href={`/dashboard/projects/${project.id}/drafts`} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-300 hover:bg-white/5">Raffle drafts →</Link></div></div></section>`,
  `<Link href={`/dashboard/projects/${project.id}/drafts`} className="rounded-xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-300 hover:bg-white/5">Raffle drafts →</Link><button type="button" onClick={() => void deleteProject()} disabled={busy} className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-black text-red-300">Delete project</button></div></div></section>`,
  "dashboard project delete button",
);

replaceOnce(
  files.dashboard,
  `{project.raffles.map((raffle) => <Link key={raffle.id} href={`/raffles/${raffle.id}`} className="block rounded-xl border border-white/10 bg-black/20 p-4 hover:border-violet-400/30"><div className="flex items-center justify-between gap-3"><b>{raffle.title}</b><span className="text-[9px] font-black text-zinc-500">{raffle.status}</span></div><p className="mt-1 text-xs text-zinc-500">{raffle.prizeName} · {raffle._count.entries} entries · {raffle._count.tasks} tasks</p></Link>)}`,
  `{project.raffles.map((raffle) => <div key={raffle.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><Link href={`/raffles/${raffle.id}`} className="min-w-0"><b className="block truncate">{raffle.title}</b></Link><span className="text-[9px] font-black text-zinc-500">{raffle.status}</span></div><p className="mt-1 text-xs text-zinc-500">{raffle.prizeName} · {raffle._count.entries} entries · {raffle._count.tasks} tasks</p><div className="mt-3 flex flex-wrap gap-2"><Link href={`/raffles/${raffle.id}/winners`} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">Winners / Export</Link><Link href={`/raffles/${raffle.id}`} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">View raffle</Link><button type="button" onClick={() => void deleteRaffle(raffle.id)} disabled={busy} className="rounded-lg border border-red-500/20 px-3 py-2 text-[10px] font-bold text-red-300">Delete</button></div></div>)}`,
  "dashboard raffle management actions",
);

replaceOnce(
  files.dashboard,
  `<input value={task.targetUrl} onChange={(e) => updateTask(index, { targetUrl: e.target.value })} placeholder="Target URL (optional)" /></div>)` ,
  `<input value={task.targetUrl} onChange={(e) => updateTask(index, { targetUrl: e.target.value })} placeholder="Target URL (auto-filled from project when possible)" /><button type="button" onClick={() => setTasks((items) => items.filter((_, i) => i !== index))} className="text-[10px] font-bold text-red-300">Delete task</button></div>)`,
  "dashboard task delete button",
);

replaceOnce(
  files.dashboard,
  ` disabled={busy || project.status !== "APPROVED"}`,
  ` disabled={busy}`,
  "dashboard publish gate",
);

// ------------------------------------------------------------
// 8) Draft UI: allow deleting any task, including the last one.
// ------------------------------------------------------------
replaceOnce(
  files.draftsPage,
  `disabled={form.tasks.length===1}`,
  `disabled={false}`,
  "draft task delete last task",
);

// ------------------------------------------------------------
// 9) Prevent duplicate global header on every dashboard sub-route.
// ------------------------------------------------------------
replaceOnce(
  files.siteChrome,
  `function hasOwnHeader(pathname: string) {
  if (routesWithOwnHeader.includes(pathname)) return true;
  if (pathname.startsWith("/dashboard/")) return true;
  if (pathname.startsWith("/projects/")) return true;
  if (pathname.startsWith("/raffles/")) return true;
  return false;
}`,
  `function hasOwnHeader(pathname: string) {
  return routesWithOwnHeader.some((route) => pathname === route || pathname.startsWith(`${route}/`)) || pathname.startsWith("/projects/") || pathname.startsWith("/raffles/");
}`,
  "global dashboard header duplication",
);

for (const file of Object.values(files)) {
  cp.execFileSync("git", ["diff", "--check", "--", file], { stdio: "inherit" });
}

console.log("✅ X target resolution hardened.");
console.log("✅ Follow/Discord task URLs auto-derived from project social URLs.");
console.log("✅ Creator project deletion added (soft-delete + cancel unfinished raffles).");
console.log("✅ Creator raffle deletion added (only before participant/winner data exists).");
console.log("✅ Expired raffles auto-close when drawing/winner pages are opened.");
console.log("✅ Winner CSV export flow remains available after draw.");
console.log("✅ NFT dashboard metadata now shows Supply + Mint date/TBD only.");
console.log("✅ Raffle/task management controls added.");
console.log("✅ Duplicate dashboard header guard strengthened.");
