import { FastifyInstance } from "fastify";
import { ragChatStream } from "../rag.js";
import { 
    ChatQuerySchema, 
    StreamQuerySchema, 
    rateLimitGuard, 
    contentFilterGuard, 
    healthCheckGuard, 
    sendErrorResponse, 
    validateInput 
} from "../guards.js";

export default async function restRoutes(app: FastifyInstance) {
    // Health check endpoint
    app.get("/health", async (req, reply) => {
        const isHealthy = await healthCheckGuard();
        if (isHealthy) {
            return { ok: true };
        } else {
            return reply.code(503).send({ error: "Service unavailable" });
        }
    });

    app.post("/chat", async (req, reply) => {
        // Rate limiting guard
        const clientIp = req.ip;
        if (!rateLimitGuard(clientIp)) {
            return sendErrorResponse(reply, 429, "Rate limit exceeded");
        }

        // Input validation guard
        const validation = validateInput(ChatQuerySchema, req.body);
        if (!validation.success) {
            return sendErrorResponse(reply, 400, validation.error);
        }

        // Content filtering guard
        if (!contentFilterGuard(validation.data.query)) {
            return sendErrorResponse(reply, 400, "Query contains forbidden content");
        }

        // System health guard
        const isHealthy = await healthCheckGuard();
        if (!isHealthy) {
            return sendErrorResponse(reply, 503, "Service temporarily unavailable");
        }

        try {
            let full = "";
            for await (const t of ragChatStream(validation.data.query)) {
                full += t;
            }
            return { answer: full };
        } catch (error: any) {
            console.error("Chat error:", error);
            return sendErrorResponse(reply, 500, "Internal server error");
        }
    });

    app.get("/chat/stream", async (req, reply) => {
        // Rate limiting guard
        const clientIp = req.ip;
        if (!rateLimitGuard(clientIp)) {
            return sendErrorResponse(reply, 429, "Rate limit exceeded");
        }

        // Input validation guard
        const validation = validateInput(StreamQuerySchema, req.query);
        if (!validation.success) {
            return sendErrorResponse(reply, 400, validation.error);
        }

        // Content filtering guard
        if (!contentFilterGuard(validation.data.q)) {
            return sendErrorResponse(reply, 400, "Query contains forbidden content");
        }

        // System health guard
        const isHealthy = await healthCheckGuard();
        if (!isHealthy) {
            return sendErrorResponse(reply, 503, "Service temporarily unavailable");
        }

        try {
            reply.raw.setHeader("Content-Type", "text/event-stream");
            reply.raw.setHeader("Cache-Control", "no-cache");
            reply.raw.setHeader("Connection", "keep-alive");
            reply.raw.flushHeaders();

            for await (const t of ragChatStream(validation.data.q)) {
                reply.raw.write(`data: ${JSON.stringify({ token: t })}\n\n`);
            }
            reply.raw.write(`event: end\ndata: {}\n\n`);
            reply.raw.end();
        } catch (error: any) {
            console.error("Stream error:", error);
            if (!reply.sent) {
                reply.code(500).send(JSON.stringify({ error: "Internal server error" }));
            }
        }
    });
}
