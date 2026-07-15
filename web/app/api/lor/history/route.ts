import { NextRequest, NextResponse } from "next/server";
import { readLorHistory } from "@/lib/lorStore";

export async function GET(req: NextRequest) {
  try {
    const history = readLorHistory();
    return NextResponse.json(history);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
