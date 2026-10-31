import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/guard";
import { readDb, storeMode } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const db = await readDb();
  return NextResponse.json({ ...db, mode: storeMode() }, { headers: { "cache-control": "no-store" } });
}
