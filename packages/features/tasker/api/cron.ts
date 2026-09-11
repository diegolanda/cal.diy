import process from "node:process";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { TaskProcessor } from "../task-processor";

async function handler(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const processor = new TaskProcessor();
  await processor.processQueue();
  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest): Promise<Response> {
  return await handler(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return await handler(request);
}
