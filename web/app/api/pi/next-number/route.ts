import { NextResponse } from "next/server";
import { peekNextPiNumber } from "@/lib/contractNumber";

export async function GET() {
  try {
    const nextNumber = peekNextPiNumber();
    return NextResponse.json({ nextNumber });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
