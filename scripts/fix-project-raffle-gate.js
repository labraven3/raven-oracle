const fs = require("fs");
const cp = require("child_process");

const files = {
  dashboard: "apps/web/app/dashboard/projects/[id]/page.tsx",
  api: "apps/api/src/routes/projects.ts",
};

function replaceOrFail(file, oldValue, newValue, label) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(oldValue)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  fs.writeFileSync(file, text.replace(oldValue, newValue));
}

// Creators can publish raffles under their own submitted project.
replaceOrFail(
  files.dashboard,
  'if (project.status !== "APPROVED") return setMessage("Project approval is required before publishing a raffle."); ',
  '',
  "frontend approval gate",
);

const dashboard = fs.readFileSync(files.dashboard, "utf8");
const unblocked = dashboard.replaceAll(' disabled={project.status !== "APPROVED"}', "");
if (unblocked === dashboard) {
  throw new Error("Patch target not found: frontend disabled controls");
}
fs.writeFileSync(files.dashboard, unblocked);

const warningPath = files.dashboard;
let warningText = fs.readFileSync(warningPath, "utf8");
const warningPattern = /\{project\.status !== "APPROVED" && <div className=\{`mt-6[\s\S]*?<\/div>\}/;
const warningMatch = warningText.match(warningPattern);
if (warningMatch) {
  warningText = warningText.replace(warningPattern, "");
} else {
  console.log("No approval warning block found; continuing.");
}
fs.writeFileSync(warningPath, warningText);

// Server-side gate must match the creator UI.
replaceOrFail(
  files.api,
  'if (project.status !== "APPROVED") return res.status(400).json({ success: false, message: "Your project must be approved before you can publish a raffle" }); ',
  '',
  "backend approval gate",
);

for (const file of Object.values(files)) {
  cp.execFileSync("git", ["diff", "--check", "--", file], { stdio: "inherit" });
}

console.log("✅ Raffle approval gate removed for project owners.");
console.log("✅ Dashboard raffle controls enabled for submitted projects.");
console.log("✅ Server-side raffle publishing gate removed.");
console.log("Now run the normal typecheck/build/deploy commands.");
