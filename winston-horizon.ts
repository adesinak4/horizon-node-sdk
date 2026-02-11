import Transport from 'winston-transport';

/**
 * Winston Default Levels:
 * error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
 */
const WINSTON_LEVEL_MAP: Record<string, string> = {
    error: 'error',
    warn: 'warn',
    info: 'info',
    http: 'info',
    verbose: 'debug',
    debug: 'debug',
    silly: 'debug',
};

interface HorizonWinstonOptions extends Transport.TransportStreamOptions {
    apiKey: string;
    ingestUrl?: string;
    batchSize?: number;
    flushInterval?: number;
}

/**
 * Winston Transport for Horizon
 * 
 * Integration:
 * logger.add(new HorizonWinstonTransport({ apiKey: '...' }));
 * 
 * Features:
 * - Batched ingestion (batchSize, flushInterval)
 * - Resilience: Fails silently to console.warn to protect host app
 * - Standard level mapping
 */
export class HorizonWinstonTransport extends Transport {
    private apiKey: string;
    private ingestUrl: string;
    private batchSize: number;
    private flushInterval: number;
    private buffer: any[] = [];
    private timer: NodeJS.Timeout | null = null;

    constructor(opts: HorizonWinstonOptions) {
        super(opts);
        this.apiKey = opts.apiKey;
        this.ingestUrl = opts.ingestUrl || 'http://localhost:5000/v1/ingest';
        this.batchSize = opts.batchSize || 50;
        this.flushInterval = opts.flushInterval || 2000;

        if (!this.apiKey) {
            throw new Error('Horizon API Key is required for Winston Transport');
        }
    }

    log(info: any, callback: () => void) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        const { level, message, ...metadata } = info;

        this.buffer.push({
            level: WINSTON_LEVEL_MAP[level] || 'info',
            message: message || '',
            metadata: metadata || {},
            timestamp: new Date().toISOString(),
        });

        if (this.buffer.length >= this.batchSize) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushInterval);
        }

        callback();
    }

    private async flush() {
        if (this.buffer.length === 0) return;

        const payload = [...this.buffer];
        this.buffer = [];

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        try {
            const res = await fetch(this.ingestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown response' }));
                console.warn(`[Horizon Winston] Ingestion failed (${res.status}):`, err.error);
            }
        } catch (e) {
            // Resilience: Fail silently to protect host application
            console.warn('[Horizon Winston] Resilience Mode: Failed to reach Horizon server.', e instanceof Error ? e.message : e);
        }
    }

    /**
     * Ensure pending logs are flushed on close/exit
     */
    async close() {
        await this.flush();
    }
}
