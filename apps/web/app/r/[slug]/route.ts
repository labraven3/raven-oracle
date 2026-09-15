import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const apiOrigin = process.env.RAVEN_API_INTERNAL_URL ?? "http://127.0.0.1:4000";
  try {
    const response = await fetch(`${apiOrigin}/r/${encodeURIComponent(slug)}`, { redirect: "manual", cache: "no-store" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) return NextResponse.redirect(new URL(location, request.url), 302);
    }
    if (response.status === 404) return new NextResponse("Short link not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
    return new NextResponse("Short link unavailable", { status: 502, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch {
    return new NextResponse("Short link unavailable", { status: 502, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
}
