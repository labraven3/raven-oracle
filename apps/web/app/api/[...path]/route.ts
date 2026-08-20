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
  // Keep /api because the Express API mounts every application route under /api/*.
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

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: upstreamHeaders(response),
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
