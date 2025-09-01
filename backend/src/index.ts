// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { Env } from "./env.js";
import rest from "./routes/rest.js";
import ws from "./routes/ws.js";
import { getPool } from "./vector/mysql-store.js";

const env = Env.parse(process.env);
const app = Fastify({ logger: true });
await app.register(cors, { origin: env.CORS_ORIGIN });
await app.register(websocket);

app.get("/health", async () => ({ ok: true }));

// Espera MySQL con reintentos
async function waitMySQL(retries = 30) {
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    for (let i = 0; i < retries; i++) {
        try {
            const pool = await getPool();
            await pool.query("SELECT 1");
            app.log.info("MySQL ready");
            return;
        } catch (e) {
            app.log.warn(`MySQL not ready, retry ${i+1}/${retries}`);
            await delay(2000);
        }
    }
    throw new Error("MySQL not reachable");
}

await waitMySQL();

try {
    await app.register(rest, { prefix: "/v1" });
    app.log.info("REST routes registered");
    await app.register(ws, { prefix: "/v1" });
    app.log.info("WebSocket routes registered");
} catch (e: any) {
    app.log.error("Route registration failed:", e);
    throw e;
}

app.listen({ port: env.PORT, host: "0.0.0.0" })
    .then(() => app.log.info(`API on :${env.PORT}`))
    .catch((e) => { app.log.error(e); process.exit(1); });
