import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type { Request, Response, NextFunction } from 'express';
import { HorizonClient } from './client';

/**
 * Fastify Middleware (Hook)
 * Automatically logs incoming requests and response times.
 */
export function fastifyHorizonMiddleware(client: HorizonClient) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const start = Date.now();

        // Listen for when the response is sent
        reply.raw.on('finish', () => {
            const duration = Date.now() - start;
            client.captureLog('info', `${request.method} ${request.url} - ${reply.statusCode}`, {
                method: request.method,
                url: request.url,
                statusCode: reply.statusCode,
                durationMs: duration,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
            });
        });
    };
}

/**
 * Express Middleware
 * Automatically logs incoming requests and response times.
 */
export function expressHorizonMiddleware(client: HorizonClient) {
    return (req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            client.captureLog('info', `${req.method} ${req.originalUrl} - ${res.statusCode}`, {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: duration,
                ip: req.ip,
                userAgent: req.get('user-agent'),
            });
        });

        next();
    };
}
