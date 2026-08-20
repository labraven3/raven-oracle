import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = (process.env.API_URL || "http://127.0.0.1:4000").replace(/\/$/, "");

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
]);

function upstreamHeaders(response: Response) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(normalized) && normalized !== "set-cookie") {
      headers.set(key, value);
    }
  });

  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (getSetCookie) {
    for (const cookie of getSetCookie.call(response.headers)) {
      headers.append("set-cookie", cookie);
    }
  } else {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) headers.set("set-cookie", setCookie);
  }

  return headers;
}

async function proxy(request: NextRequest) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${API_URL}${incoming.pathname}`);
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });

    const responseHeaders = upstreamHeaders(response);
    responseHeaders.set("cache-control", "no-store, max-age=0");

    // The API normally sets the HttpOnly session cookie itself. Keep a
    // defensive fallback here because some Node/Next runtimes do not expose
    // Set-Cookie consistently through the Fetch Headers API. This guarantees
    // a successful login establishes a same-origin session through the proxy.
    if (
      request.method === "POST" &&
      incoming.pathname === "/api/auth/login" &&
      !responseHeaders.has("set-cookie")
    ) {
      const cloned = response.clone();
      try {
        const data = (await cloned.json()) as { token?: string };
        if (typeof data.token === "string" && data.token.length > 0) {
          const secure = incoming.protocol === "https:" ? "; Secure" : "";
          responseHeaders.append(
            "set-cookie",
            `raven_token=${encodeURIComponent(data.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`,
          );
        }
      } catch {
        // Preserve the upstream response unchanged if it is not JSON.
      }
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "API service is temporarily unavailable." },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
