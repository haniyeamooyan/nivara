import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createExpiryReminders } from "@/lib/notifications/expiry-reminders";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || !provided) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await createExpiryReminders(prisma);
  return NextResponse.json(result);
}
