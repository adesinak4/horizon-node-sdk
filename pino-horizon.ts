import build from 'pino-abstract-transport';

/**
 * Pino Numeric Levels:
 * 10: trace
 * 20: debug
 * 30: info
 * 40: warn
 * 50: error
 * 60: fatal
 */
const PINO_LEVEL_MAP: Record<number, string> = {
    10: 'debug', // Map trace to debug as per Horizon capabilities
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
};

interface HorizonTransportOptions {
    apiKey: string;
    ingestUrl?: string;
    batchSize?: number;
    flushInterval?: number;
}

/**
 * Horizon Pino Transport
 * 
 * Performance features:
 * - Batches logs up to batchSize (default 50)
 * - Flushes every flushInterval (default 2s)
 * - Converts Pino numeric levels to Horizon string levels
 */
export default async function (opts: HorizonTransportOptions) {
    const {
        apiKey,
        ingestUrl = 'http://localhost:5000/v1/ingest',
        batchSize = 50,
        flushInterval = 2000,
    } = opts;

    if (!apiKey) {
        throw new Error('Horizon API Key is required for ingestion');
    }

    let buffer: any[] = [];
    let timer: NodeJS.Timeout | null = null;

    const flush = async () => {
        if (buffer.length === 0) return;

        const payload = [...buffer];
        buffer = [];

        if (timer) {
            clearTimeout(timer);
            timer = null;
        }

        try {
            const res = await fetch(ingestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
                console.warn(`[Horizon Pino] Ingestion failed (${res.status}): ${err.error}`);
            }
        } catch (e) {
            console.error('[Horizon Pino] Critical transport error:', e);
        }
    };

    return build(
        async function (source) {
            for await (const obj of source) {
                if (!obj) continue;

                const level = PINO_LEVEL_MAP[obj.level] || 'info';
                const message = obj.msg || 'No message';
                const timestamp = obj.time ? new Date(obj.time).toISOString() : new Date().toISOString();

                // Clean pino-specific internal fields from metadata
                const metadata = { ...obj };
                delete metadata.level;
                delete metadata.msg;
                delete metadata.time;
                delete metadata.v;

                buffer.push({
                    level,
                    message,
                    metadata,
                    timestamp,
                });

                if (buffer.length >= batchSize) {
                    await flush();
                } else if (!timer) {
                    timer = setTimeout(flush, flushInterval);
                }
            }
        },
        {
            async close() {
                // Ensure remaining logs are sent on process exit
                await flush();
            },
        }
    );
}
