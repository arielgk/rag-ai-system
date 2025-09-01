import { retrieveRelevant } from "./vector/retriever.js";
import { streamChat } from "./llm.js";
import { Env } from "./env.js";

const env = Env.parse(process.env);

export async function* ragChatStream(userQuery: string) {
    const ctx = await retrieveRelevant(userQuery, env.TOP_K);
    const system = `You are a helpful assistant. Use the following context if relevant.\n\nCONTEXT:\n${ctx.join("\n---\n").slice(0, env.MAX_CONTEXT_CHARS)}`;

    const messages = [
        { role: "system", content: system },
        { role: "user", content: userQuery },
    ] as const;

    for await (const token of streamChat(messages as any)) {
        yield token;
    }
}
