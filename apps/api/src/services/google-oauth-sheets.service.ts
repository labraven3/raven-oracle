import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { getGoogleOAuthAccessToken } from "./google-oauth.service.js";

type SpreadsheetResponse = {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
};

type BatchUpdateResponse = {
  replies?: Array<{ addSheet?: { properties?: { sheetId?: number; title?: string } } }>;
};

export type OAuthWinnerTask = {
  title: string;
  type: string;
  required: boolean;
  status: string;
  verifiedAt?: Date | null;
  failureReason?: string | null;
};

export type OAuthWinnerSheetRow = {
  rank: number;
  raffleTitle: string;
  raffleEndsAt: Date;
  entryId: string;
  entryStatus: string;
  enteredAt: Date;
  xUsername: string;
  discordUsername: string;
  walletAddress: string;
  email: string;
  emailVerified: boolean;
  winnerStatus: string;
  notificationStatus: string;
  selectedAt: Date;
  notifiedAt?: Date | null;
  tasks: OAuthWinnerTask[];
};

function cellSafe(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function worksheetTitle(base: string, exportId: string) {
  const cleaned = base.replace(/[\\/?*\[\]:]/g, "-").trim() || "Winners";
  const suffix = `-${exportId.slice(0, 8)}`;
  return `${cleaned.slice(0, 100 - suffix.length)}${suffix}`.slice(0, 100);
}

async function googleRequest<T>(accessToken: string, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Google API request failed: ${data?.error?.message ?? response.statusText}`);
  return data;
}

async function createSpreadsheet(accessToken: string, title: string) {
  return googleRequest<SpreadsheetResponse>(accessToken, "https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: "Winners" } }],
    }),
  });
}

async function addWorksheet(accessToken: string, spreadsheetId: string, title: string) {
  const result = await googleRequest<BatchUpdateResponse>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    },
  );
  const properties = result.replies?.[0]?.addSheet?.properties;
  if (!properties?.sheetId) throw new Error("Google Sheets did not return the new worksheet ID.");
  return properties.sheetId;
}

async function formatWorksheet(accessToken: string, spreadsheetId: string, sheetId: number, columnCount: number) {
  await googleRequest(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
        { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columnCount } } },
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
      ],
    }),
  });
}

export async function createWinnerGoogleSheetForUser(
  userId: string,
  input: { raffleTitle: string; raffleEndsAt: Date; rows: OAuthWinnerSheetRow[] },
) {
  const accessToken = await getGoogleOAuthAccessToken(userId);
  const exportId = randomUUID();
  const exportAt = new Date();
  const safeTitle = input.raffleTitle.trim().slice(0, 80) || "Raven Oracle Raffle";
  const spreadsheetTitle = `Raven Oracle — ${safeTitle} — Winners — ${exportAt.toISOString().slice(0, 16).replace("T", " ")}`;

  let spreadsheetId: string;
  let sheetId: number;
  let sheetTitle: string;

  if (env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID;
    sheetTitle = worksheetTitle(env.GOOGLE_SHEETS_WORKSHEET_NAME, exportId);
    sheetId = await addWorksheet(accessToken, spreadsheetId, sheetTitle);
  } else {
    const spreadsheet = await createSpreadsheet(accessToken, spreadsheetTitle);
    spreadsheetId = spreadsheet.spreadsheetId ?? "";
    if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet ID.");
    sheetTitle = "Winners";
    sheetId = spreadsheet.sheets?.[0]?.properties?.sheetId ?? 0;
  }

  const headers = [
    "Export ID", "Exported At", "Raffle Name", "Raffle End Date", "Rank", "Entry ID", "Entry Status", "Entered At",
    "X Username", "Discord Username", "Wallet Address", "Email", "Email Verified", "Winner Status", "Notification Status",
    "Selected At", "Notified At", "Task Details",
  ];

  const values = [
    headers,
    ...input.rows.map((row) => [
      exportId,
      exportAt.toISOString(),
      cellSafe(row.raffleTitle),
      row.raffleEndsAt.toISOString(),
      row.rank,
      row.entryId,
      cellSafe(row.entryStatus),
      row.enteredAt.toISOString(),
      cellSafe(row.xUsername),
      cellSafe(row.discordUsername),
      cellSafe(row.walletAddress),
      cellSafe(row.email),
      row.emailVerified ? "Yes" : "No",
      cellSafe(row.winnerStatus),
      cellSafe(row.notificationStatus),
      row.selectedAt.toISOString(),
      row.notifiedAt?.toISOString() ?? "",
      cellSafe(row.tasks.slice().sort((a, b) => a.title.localeCompare(b.title)).map((task) => `${task.title} [${task.type}] — ${task.required ? "Required" : "Optional"}: ${task.status}${task.verifiedAt ? ` @ ${task.verifiedAt.toISOString()}` : ""}${task.failureReason ? ` — ${task.failureReason}` : ""}`).join(" | ")),
    ]),
  ];

  const range = `${sheetTitle}!A1:R`;
  await googleRequest(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ range, majorDimension: "ROWS", values }) },
  );

  await formatWorksheet(accessToken, spreadsheetId, sheetId, headers.length);

  return {
    exportId,
    exportedAt: exportAt.toISOString(),
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`,
    worksheetName: sheetTitle,
    rowCount: input.rows.length,
    repeatedExport: Boolean(env.GOOGLE_SHEETS_SPREADSHEET_ID),
  };
}
