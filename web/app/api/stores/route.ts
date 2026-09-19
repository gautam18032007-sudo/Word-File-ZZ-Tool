import { NextRequest, NextResponse } from 'next/server';
import { getApplicableStores } from '@/lib/storeMaster';
import { getStoreMasterData, addStoreToMaster, updateStoreStatus, removeStoreFromMaster } from '@/lib/storeMasterStore';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const all = searchParams.get('all') === 'true';

    const masterData = await getStoreMasterData();

    if (all) {
      return NextResponse.json({
        success: true,
        stores: masterData.stores,
        version: masterData.version,
        updatedAt: masterData.updatedAt,
      });
    }

    const stores = getApplicableStores(dateParam, masterData.stores);
    return NextResponse.json({
      success: true,
      stores,
      version: masterData.version,
      updatedAt: masterData.updatedAt,
    });
  } catch (err: any) {
    logger.error(`[API/stores] GET failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to fetch stores',
      },
      { status }
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
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        store: result.store,
        stores: result.stores,
      },
      { status: 201 }
    );
  } catch (err: any) {
    logger.error(`[API/stores] POST failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to add store to Master',
      },
      { status }
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
        { status: 400 }
      );
    }

    const { storeCode, active } = payload;
    if (!storeCode || typeof active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'storeCode and boolean active status are required.' },
        { status: 400 }
      );
    }

    logger.gen(`[API/stores] Updating store "${storeCode}" active status to: ${active}`);
    const result = await updateStoreStatus(storeCode, active);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      store: result.store,
      stores: result.stores,
    });
  } catch (err: any) {
    logger.error(`[API/stores] PATCH failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to update store status' },
      { status }
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
        { status: 400 }
      );
    }

    logger.gen(`[API/stores] Received request to remove store: "${storeCode}"`);
    const result = await removeStoreFromMaster(storeCode);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      removedStore: result.removedStore,
      stores: result.stores,
    });
  } catch (err: any) {
    logger.error(`[API/stores] DELETE failed: ${err?.message || String(err)}`);
    const status = err?.message?.includes('Store Master unavailable') ? 503 : 500;
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to remove store' },
      { status }
    );
  }
}
