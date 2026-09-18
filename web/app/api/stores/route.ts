import { NextRequest, NextResponse } from "next/server";
import { getApplicableStores, STORE_MASTER } from "@/lib/storeMaster";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const all = searchParams.get("all") === "true";

    if (all) {
      return NextResponse.json({ stores: STORE_MASTER });
    }

    const stores = getApplicableStores(dateParam);
    return NextResponse.json({ stores });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch stores" }, { status: 500 });
  }
}
