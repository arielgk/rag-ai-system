import { z } from "zod";
import { FastifyReply } from "fastify";

// Input validation schemas
export const ChatQuerySchema = z.object({
    query: z.string().min(1, "Query cannot be empty").max(1000, "Query too long")
});

export const StreamQuerySchema = z.object({
    q: z.string().min(1, "Query cannot be empty").max(1000, "Query too long")
});

// Rate limiting guard
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

export function rateLimitGuard(ip: string): boolean {
    const now = Date.now();
    const userRequests = requestCounts.get(ip);
    
    if (!userRequests || now > userRequests.resetTime) {
        requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }
    
    if (userRequests.count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }
    
    userRequests.count++;
    return true;
}

// Content filtering guard
const FORBIDDEN_WORDS = ['hack', 'exploit', 'inject', 'script'];
export function contentFilterGuard(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    return !FORBIDDEN_WORDS.some(word => lowerQuery.includes(word));
}

// System health guard
export async function healthCheckGuard(): Promise<boolean> {
    // Simplified health check - always return true for now
    // TODO: Implement proper health checks for database and external services
    return true;
}

// Error response helper
export function sendErrorResponse(reply: FastifyReply, statusCode: number, message: string) {
    if (!reply.sent) {
        reply.code(statusCode).send({ error: message });
    }
}

// Validation guard
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
    try {
        const result = schema.parse(data);
        return { success: true, data: result };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { success: false, error: error.errors[0].message };
        }
        return { success: false, error: "Validation failed" };
    }
}
