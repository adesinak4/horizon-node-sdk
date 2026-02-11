# Horizon Node.js SDK

High-performance observability and logging for Node.js.

## Installation

```bash
npm install @kisameholmes/horizon_node
```

## Features

- **Class-based Client**: Easy to use manual logging.
- **Batching**: Logs are buffered and sent in batches to minimize HTTP overhead.
- **Resilience**: Automatic exponential backoff for 5xx errors.
- **Transports**: Native support for Pino and Winston.
- **Middlewares**: One-line integration for Fastify and Express.
- **Error Watchdog**: Automatically catches uncaught exceptions and rejections.

## Core Usage

```typescript
import { HorizonClient } from '@kisameholmes/horizon_node';

const horizon = new HorizonClient({
  apiKey: 'YOUR_API_KEY',
  environment: 'production'
});

// Capture manual logs
horizon.captureLog('info', 'Process started', { version: '1.2.0' });

// Auto-capture global errors
horizon.autoCaptureErrors();
```

## Framework Integration

### Fastify

```typescript
import Fastify from 'fastify';
import { fastifyHorizonMiddleware } from '@kisameholmes/horizon_node';

const app = Fastify();
app.addHook('onRequest', fastifyHorizonMiddleware(horizon));
```

### Express

```typescript
import express from 'express';
import { expressHorizonMiddleware } from '@kisameholmes/horizon_node';

const app = express();
app.use(expressHorizonMiddleware(horizon));
```

## Transports

### Pino

```typescript
const logger = pino({
  transport: {
    target: '@kisameholmes/horizon_node/pino',
    options: { apiKey: '...' }
  }
});
```

### Winston

```typescript
import { HorizonWinstonTransport } from '@kisameholmes/horizon_node/winston';

const logger = winston.createLogger({
  transports: [
    new HorizonWinstonTransport({ apiKey: '...' })
  ]
});
```

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `apiKey` | string | **Required** | Your environment API key. |
| `ingestUrl` | string | `https://horizon-api.bylinee.com/v1/ingest` | Horizon ingestion endpoint. |
| `environment` | string | `production` | Deployment environment name. |
| `batchSize` | number | `50` | Maximum logs per batch. |
| `flushInterval` | number | `2000` | Max wait time (ms) before flushing. |
| `maxRetries` | number | `3` | Number of retry attempts for 5xx errors. |
