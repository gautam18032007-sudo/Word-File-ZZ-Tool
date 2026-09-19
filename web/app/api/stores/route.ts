import { NextRequest, NextResponse } from 'next/server';
import { getApplicableStores } from '@/lib/storeMaster';
import { getStoreMasterData, addStoreToMaster, updateStoreStatus, removeStoreFromMaster } from '@/lib/storeMasterStore';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const all = searchParams.get('all') === 'true';

    const masterData = await getStoreMasterData();

    if (all) {
      return NextResponse.json(
        {
          success: true,
          stores: masterData.stores,
          version: masterData.version,
          updatedAt: masterData.updatedAt,
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const stores = getApplicableStores(dateParam, masterData.stores);
    return NextResponse.json(
      {
        success: true,
        stores,
        version: masterData.version,
        updatedAt: masterData.updatedAt,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    logger.error(`[API/stores] GET failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to fetch stores',
      },
      { status, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    logger.gen(`[API/stores] Received request to add store: ${JSON.stringify(payload)}`);
    const result = await addStoreToMaster(payload);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        store: result.store,
        stores: result.stores,
      },
      { status: 201, headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    logger.error(`[API/stores] POST failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to add store to Master',
      },
      { status, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const { storeCode, active } = payload;
    if (!storeCode || typeof active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'storeCode and boolean active status are required.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    logger.gen(`[API/stores] Updating store "${storeCode}" active status to: ${active}`);
    const result = await updateStoreStatus(storeCode, active);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        store: result.store,
        stores: result.stores,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    logger.error(`[API/stores] PATCH failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update store status' },
      { status, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let storeCode = '';
    try {
      const payload = await req.json();
      storeCode = payload?.storeCode;
    } catch {
      const { searchParams } = new URL(req.url);
      storeCode = searchParams.get('storeCode') || '';
    }

    if (!storeCode || typeof storeCode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'storeCode is required to remove a store.' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    logger.gen(`[API/stores] Received request to remove store: "${storeCode}"`);
    const result = await removeStoreFromMaster(storeCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        removedStore: result.removedStore,
        stores: result.stores,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: any) {
    logger.error(`[API/stores] DELETE failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to remove store' },
      { status, headers: NO_CACHE_HEADERS }
    );
  }
}
