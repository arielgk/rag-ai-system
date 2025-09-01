import fp from "fastify-plugin";
import { ragChatStream } from "../rag.js";

export default fp(async (app, _opts) => {
    app.get("/ws", { websocket: true }, (conn, req) => {
        conn.socket.on("message", async (msg: Buffer) => {
            const { query } = JSON.parse(msg.toString());
            try {
                for await (const t of ragChatStream(query)) {
                    conn.socket.send(JSON.stringify({ token: t }));
                }
                conn.socket.send(JSON.stringify({ event: "end" }));
            } catch (e: any) {
                conn.socket.send(JSON.stringify({ error: e.message || "error" }));
            }
        });
    });
});
