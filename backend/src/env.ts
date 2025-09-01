import { z } from "zod";

export const Env = z.object({
    PORT: z.coerce.number().default(8080),
    NODE_ENV: z.string().default("production"),
    CORS_ORIGIN: z.string().default("*"),

    OPENAI_BASE_URL: z.string(),
    OPENAI_API_KEY: z.string(),
    OPENAI_MODEL: z.string().default("llama3.1:8b-instruct"),
    EMBEDDING_MODEL: z.string().default("nomic-embed-text"),

    VECTOR_BACKEND: z.enum(["hnsw", "mysql"]).default("hnsw"),

    MYSQL_HOST: z.string().default("mysql"),
    MYSQL_PORT: z.coerce.number().default(3306),
    MYSQL_DB: z.string().default("ragdb"),
    MYSQL_USER: z.string().default("rag"),
    MYSQL_PASSWORD: z.string().default("ragpass"),

    MAX_CONTEXT_CHARS: z.coerce.number().default(3000),
    TOP_K: z.coerce.number().default(6),
});
