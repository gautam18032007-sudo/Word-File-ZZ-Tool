import { NextRequest, NextResponse } from "next/server";
import { readPiHistory, deletePiRecord } from "@/lib/piStore";

export async function GET() {
  try {
    const history = readPiHistory();
    return NextResponse.json(history);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing 'id' parameter" }, { status: 400 });
    }

    const success = deletePiRecord(id);
    if (!success) {
      return NextResponse.json({ error: "Record not found or failed to delete" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Deleted record ${id}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
