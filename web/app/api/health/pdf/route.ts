import { NextResponse } from 'next/server';
import { supportsLibreOffice, hasGotenberg } from '@/lib/environment';

export async function GET() {
  const startTime = Date.now();
  const gotenbergUrl = process.env.GOTENBERG_URL?.trim().replace(/\/+$/, '');
  const version = process.env.PDF_PROVIDER_VERSION || '1.0';
  const retryCount = parseInt(process.env.PDF_RETRY_COUNT || '3', 10);
  const timeoutMs = parseInt(process.env.PDF_TIMEOUT || '60000', 10);

  if (supportsLibreOffice()) {
    return NextResponse.json({
      status: 'healthy',
      provider: 'local',
      version,
      retryCount,
      timeoutMs,
      environment: 'desktop',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }

  if (hasGotenberg() && gotenbergUrl) {
    try {
      const healthUrl = `${gotenbergUrl}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      const responseTimeMs = Date.now() - startTime;

      if (res.ok) {
        return NextResponse.json({
          status: 'healthy',
          provider: 'gotenberg',
          version,
          retryCount,
          timeoutMs,
          gotenbergUrl,
          responseTimeMs,
          timestamp: new Date().toISOString(),
        });
      } else {
        return NextResponse.json({
          status: 'degraded',
          provider: 'gotenberg',
          version,
          retryCount,
          timeoutMs,
          gotenbergUrl,
          httpStatus: res.status,
          responseTimeMs,
          timestamp: new Date().toISOString(),
        }, { status: 503 });
      }
    } catch (err: any) {
      return NextResponse.json({
        status: 'unreachable',
        provider: 'gotenberg',
        version,
        retryCount,
        timeoutMs,
        gotenbergUrl,
        error: err?.message || String(err),
        responseTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
  }

  return NextResponse.json({
    status: 'unconfigured',
    provider: 'none',
    version,
    retryCount,
    timeoutMs,
    message: 'Neither local LibreOffice nor GOTENBERG_URL is configured.',
    responseTimeMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  });
}

