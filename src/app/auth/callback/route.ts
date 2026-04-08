import { NextResponse } from "next/server";

function getOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  const url = new URL(request.url);
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return url.origin;
}

export async function GET(request: Request) {
  return NextResponse.redirect(`${getOrigin(request)}/dashboard`);
}
