const SHEETS_API = "https://sheets.googleapis.com/v4";

type WinnerSheetRow = {
  x: string;
  discord: string;
  walletAddress: string;
  email: string;
  enteredAt: Date;
};

type SpreadsheetResponse = { spreadsheetId?: string };

async function googleRequest<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`Google API request failed: ${data?.error?.message ?? response.statusText}`);
  return data;
}

function cellSafe(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export async function createWinnerGoogleSheetForUser(input: { accessToken: string; raffleTitle: string; rows: WinnerSheetRow[] }) {
  const safeTitle = input.raffleTitle.trim().slice(0, 80) || "Raven Oracle Raffle";
  const spreadsheet = await googleRequest<SpreadsheetResponse>(input.accessToken, `${SHEETS_API}/spreadsheets`, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: `Raven Oracle — ${safeTitle} — Winners` },
      sheets: [{ properties: { title: "Winners" } }],
    }),
  });
  const spreadsheetId = spreadsheet.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet ID.");

  const values = [
    ["X", "Discord", "Wallet Address", "Email", "Entered At"],
    ...input.rows.map((row) => [cellSafe(row.x), cellSafe(row.discord), cellSafe(row.walletAddress), cellSafe(row.email), row.enteredAt.toISOString()]),
  ];

  await googleRequest(
    input.accessToken,
    `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent("Winners!A1:E")}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ range: "Winners!A1:E", majorDimension: "ROWS", values }) },
  );

  await googleRequest(input.accessToken, `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 5 },
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    }),
  });

  return { spreadsheetId, spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}
