export interface HorizonClientOptions {
    apiKey: string;
    ingestUrl?: string;
    environment?: string;
    batchSize?: number;
    flushInterval?: number;
    maxRetries?: number;
}

/**
 * Horizon Node.js SDK Client
 * 
 * Provides unified ingestion, batching, and resilience.
 */
export class HorizonClient {
    private apiKey: string;
    private ingestUrl: string;
    private environment: string;
    private batchSize: number;
    private flushInterval: number;
    private maxRetries: number;
    private buffer: any[] = [];
    private timer: NodeJS.Timeout | null = null;

    constructor(opts: HorizonClientOptions) {
        this.apiKey = opts.apiKey;
        this.ingestUrl = opts.ingestUrl || 'https://horizon-api.bylinee.com/v1/ingest';
        this.environment = opts.environment || 'production';
        this.batchSize = opts.batchSize || 50;
        this.flushInterval = opts.flushInterval || 2000;
        this.maxRetries = opts.maxRetries || 3;

        if (!this.apiKey) {
            throw new Error('Horizon API Key is required');
        }
    }

    /**
     * Send a manual log to Horizon (Buffered)
     */
    async captureLog(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', message: string, metadata: any = {}) {
        this.buffer.push({
            level,
            message,
            metadata: {
                ...metadata,
                sdk_env: this.environment,
            },
            timestamp: new Date().toISOString(),
        });

        if (this.buffer.length >= this.batchSize) {
            await this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushInterval);
        }
    }

    /**
     * Internal flush with Exponential Backoff
     */
    private async flush() {
        if (this.buffer.length === 0) return;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        const payload = [...this.buffer];
        this.buffer = [];

        const send = async (attempt: number): Promise<boolean> => {
            try {
                const res = await fetch(this.ingestUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                    },
                    body: JSON.stringify(payload),
                });

                if (res.ok || (res.status >= 400 && res.status < 500)) {
                    return true;
                }

                if (res.status >= 500 && attempt < this.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return send(attempt + 1);
                }

                return false;
            } catch (e) {
                if (attempt < this.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return send(attempt + 1);
                }
                return false;
            }
        };

        const success = await send(0);
        if (!success) {
            console.error('[Horizon SDK] Failed to send logs after multiple retries.');
        }
    }

    /**
     * Automatically capture uncaught exceptions and unhandled rejections.
     */
    autoCaptureErrors() {
        process.on('uncaughtException', async (error: Error) => {
            console.error('[Horizon SDK] Uncaught Exception detected.');
            await this.captureLog('fatal', error.message || 'Uncaught Exception', {
                stack: error.stack,
                type: 'uncaughtException',
            });
            await this.flush(); // Force flush
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason: any) => {
            const message = reason instanceof Error ? reason.message : String(reason);
            await this.captureLog('fatal', message || 'Unhandled Rejection', {
                type: 'unhandledRejection',
                reason: reason instanceof Error ? reason.stack : reason
            });
        });
    }
}
