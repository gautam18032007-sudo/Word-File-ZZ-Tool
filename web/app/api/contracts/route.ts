import { NextResponse } from 'next/server';
import { readContracts } from '@/lib/store';

export async function GET() {
  const contracts = readContracts();
  return NextResponse.json({ contracts });
}
