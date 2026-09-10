import { prisma } from "@calcom/prisma";

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({ status: "ok" }, { headers: responseHeaders });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: responseHeaders });
  }
}
