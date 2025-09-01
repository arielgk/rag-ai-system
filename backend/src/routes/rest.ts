import { FastifyInstance } from "fastify";
import { ragChatStream } from "../rag.js";

export default async function restRoutes(app: FastifyInstance) {
    app.post("/chat", async (req, reply) => {
        const { query } = (req.body as any) ?? {};
        let full = "";
        for await (const t of ragChatStream(query)) full += t;
        return { answer: full };
    });

    app.get("/chat/stream", async (req, reply) => {
        try {
            const query = (req.query as any).q ?? "";
            reply.raw.setHeader("Content-Type", "text/event-stream");
            reply.raw.setHeader("Cache-Control", "no-cache");
            reply.raw.setHeader("Connection", "keep-alive");
            reply.raw.flushHeaders();

            for await (const t of ragChatStream(query)) {
                reply.raw.write(`data: ${JSON.stringify({ token: t })}\n\n`);
            }
            reply.raw.write(`event: end\ndata: {}\n\n`);
            reply.raw.end();
        } catch (error: any) {
            if (!reply.sent) {
                reply.code(500).send(JSON.stringify({ error: error.message }));
            }
        }
    });
}
