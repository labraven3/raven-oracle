import { getGoogleOAuthAccessToken } from "./google-oauth.service.js";

type SpreadsheetResponse = { spreadsheetId?: string };

export type OAuthWinnerSheetRow = {
  rank: number;
  xUsername: string;
  discordUsername: string;
  walletAddress: string;
  email: string;
  emailVerified: boolean;
  winnerStatus: string;
  notificationStatus: string;
  selectedAt: Date;
  notifiedAt?: Date | null;
};

function cellSafe(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
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

export async function createWinnerGoogleSheetForUser(userId: string, input: { raffleTitle: string; rows: OAuthWinnerSheetRow[] }) {
  const accessToken = await getGoogleOAuthAccessToken(userId);
  const safeTitle = input.raffleTitle.trim().slice(0, 80) || "Raven Oracle Raffle";

  const spreadsheet = await googleRequest<SpreadsheetResponse>(accessToken, "https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: `Raven Oracle — ${safeTitle} — Winners` },
      sheets: [{ properties: { title: "Winners" } }],
    }),
  });

  const spreadsheetId = spreadsheet.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet ID.");

  const values = [
    ["Rank", "X Username", "Discord Username", "Wallet Address", "Email", "Email Verified", "Winner Status", "Notification Status", "Selected At", "Notified At"],
    ...input.rows.map((row) => [
      cellSafe(row.rank),
      cellSafe(row.xUsername),
      cellSafe(row.discordUsername),
      cellSafe(row.walletAddress),
      cellSafe(row.email),
      row.emailVerified ? "Yes" : "No",
      cellSafe(row.winnerStatus),
      cellSafe(row.notificationStatus),
      row.selectedAt.toISOString(),
      row.notifiedAt?.toISOString() ?? "",
    ]),
  ];

  await googleRequest(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent("Winners!A1:J")}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ range: "Winners!A1:J", majorDimension: "ROWS", values }) },
  );

  await googleRequest(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
        { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 10 } } },
        { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
      ],
    }),
  });

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}
