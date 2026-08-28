import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "www.larvalabs.com",
  "larvalabs.com",
  "i.seadn.io",
  "ipfs.io",
  "ipfs.infura.io",
  "nftstorage.link",
  "ikzttp.mypinata.cloud",
  "www.azuki.com",
  "azuki.com",
]);

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("src");
  if (!raw) return new NextResponse("Missing src", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse("Invalid src", { status: 400 });
  }

  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return new NextResponse("Source not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      cache: "no-store",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; RavenOracle/1.0)",
      },
    });

    if (!upstream.ok) return new NextResponse("Image unavailable", { status: 502 });

    const contentType = upstream.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return new NextResponse("Not an image", { status: 502 });

    return new NextResponse(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Image fetch failed", { status: 502 });
  }
}
