import jwt from "jsonwebtoken";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Google Sheets export is not configured: GOOGLE_SERVICE_ACCOUNT_JSON is missing.");
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Missing client_email or private_key.");
    }

    const serviceAccount: ServiceAccount = {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };

    if (parsed.project_id) {
      serviceAccount.project_id = parsed.project_id;
    }

    return serviceAccount;
  } catch {
    throw new Error("Google Sheets export is not configured: GOOGLE_SERVICE_ACCOUNT_JSON is invalid.");
  }
}

async function getGoogleAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const serviceAccount = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: serviceAccount.client_email,
      scope: GOOGLE_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    serviceAccount.private_key,
    { algorithm: "RS256" },
  );

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as GoogleTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google authentication failed: ${data.error_description ?? data.error ?? response.statusText}`);
  }

  const expiresIn = Math.max(60, Number(data.expires_in ?? 3600));
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return data.access_token;
}

async function googleRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getGoogleAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`Google API request failed: ${data?.error?.message ?? response.statusText}`);
  }
  return data;
}

function cellSafe(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
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

type SpreadsheetResponse = {
  spreadsheetId?: string;
};

export async function createWinnerGoogleSheet(input: {
  raffleTitle: string;
  shareWithEmail?: string | null;
  rows: WinnerSheetRow[];
}) {
  const safeTitle = input.raffleTitle.trim().slice(0, 80) || "Raven Oracle Raffle";

  const spreadsheet = await googleRequest<SpreadsheetResponse>(`${SHEETS_API}/spreadsheets`, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: `Raven Oracle — ${safeTitle} — Winners` },
      sheets: [{ properties: { title: "Winners" } }],
    }),
  });

  const spreadsheetId = spreadsheet.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Google Sheets did not return a spreadsheet ID.");
  }

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
    `${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent("Winners!A1:J")}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ range: "Winners!A1:J", majorDimension: "ROWS", values }),
    },
  );

  await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
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
            dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 10 },
          },
        },
        { updateSheetProperties: { properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
      ],
    }),
  });

  let sharedWith: string | null = null;
  const shareWithEmail = input.shareWithEmail?.trim().toLowerCase() ?? null;
  if (shareWithEmail) {
    await googleRequest(`${DRIVE_API}/files/${encodeURIComponent(spreadsheetId)}/permissions?sendNotificationEmail=false`, {
      method: "POST",
      body: JSON.stringify({ type: "user", role: "writer", emailAddress: shareWithEmail }),
    });
    sharedWith = shareWithEmail;
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sharedWith,
  };
}
