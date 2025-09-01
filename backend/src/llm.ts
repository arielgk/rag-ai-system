import OpenAI from "openai";
import { Env } from "./env.js";

const env = Env.parse(process.env);

export const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
});

export async function* streamChat(messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
    const response = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        stream: true,
    });

    for await (const chunk of response) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        if (token) yield token;
    }
}

export async function embed(texts: string[]): Promise<number[][]> {
    const resp = await openai.embeddings.create({
        model: env.EMBEDDING_MODEL,
        input: texts,
    });
    return resp.data.map((d) => d.embedding as unknown as number[]);
}
