import { google } from "googleapis";

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Google Sheets export is not configured: GOOGLE_SERVICE_ACCOUNT_JSON is missing.");
  try {
    return JSON.parse(raw) as { client_email: string; private_key: string; project_id?: string };
  } catch {
    throw new Error("Google Sheets export is not configured: GOOGLE_SERVICE_ACCOUNT_JSON is invalid.");
  }
}

function csvSafe(value: unknown) {
  return String(value ?? "");
}

export type WinnerSheetRow = {
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

export async function createWinnerGoogleSheet(input: {
  raffleTitle: string;
  shareWithEmail?: string | null;
  rows: WinnerSheetRow[];
}) {
  const serviceAccount = getServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });
  const safeTitle = input.raffleTitle.trim().slice(0, 80) || "Raven Oracle Raffle";

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Raven Oracle — ${safeTitle} — Winners` },
      sheets: [{ properties: { title: "Winners" } }],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet ID.");

  const values = [
    [
      "Rank",
      "X Username",
      "Discord Username",
      "Wallet Address",
      "Email",
      "Email Verified",
      "Winner Status",
      "Notification Status",
      "Selected At",
      "Notified At",
    ],
    ...input.rows.map((row) => [
      csvSafe(row.rank),
      csvSafe(row.xUsername),
      csvSafe(row.discordUsername),
      csvSafe(row.walletAddress),
      csvSafe(row.email),
      row.emailVerified ? "Yes" : "No",
      csvSafe(row.winnerStatus),
      csvSafe(row.notificationStatus),
      row.selectedAt.toISOString(),
      row.notifiedAt?.toISOString() ?? "",
    ]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Winners!A1:J",
    valueInputOption: "RAW",
    requestBody: { values },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
        { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 10 } } },
        { freezeProperties: { sheetId: 0, frozenRowCount: 1 } },
      ],
    },
  });

  let sharedWith: string | null = null;
  const shareWithEmail = input.shareWithEmail?.trim().toLowerCase();
  if (shareWithEmail) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type: "user", role: "writer", emailAddress: shareWithEmail },
      sendNotificationEmail: false,
    });
    sharedWith = shareWithEmail;
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sharedWith,
  };
}
