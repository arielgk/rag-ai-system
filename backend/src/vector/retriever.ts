import { embed } from "../llm.js";
import { HNSWIndex } from "./hnsw.js";
import { Env } from "../env.js";
import { getVectorStore } from "./store-factory.js";

const env = Env.parse(process.env);
const hnsw = new HNSWIndex();
const store = getVectorStore();

let ready = false;
let dim = 0;

export async function initRetriever() {
    // just an embedding of a single sample to get dimension
    const [probe] = await embed(["dimension probe"]);
    dim = probe.length;

    if (env.VECTOR_BACKEND === "hnsw") {
        await hnsw.loadOrCreate(dim);

        // build index (idempotence) from vector store
        const items = await store.loadAllEmbeddings(0);
        if (items.length && !hnsw.hasItems()) {
            hnsw.add(items.map((i: any) => ({ id: i.id, vector: i.vector })));
            hnsw.save();
        }
    }
    ready = true;
}

export async function retrieveRelevant(query: string, k: number) {
    if (!ready) await initRetriever();
    const [qVec] = await embed([query]);

    if (env.VECTOR_BACKEND === "hnsw") {
        const ids = hnsw.knn(qVec, k);
        const chunks = await store.getChunksByIds(ids);
        return chunks.map((c: any) => c.text);
    }

    if (env.VECTOR_BACKEND === "postgres" && store.searchSimilarVectors) {
        // Use native PostgreSQL vector search
        const results = await store.searchSimilarVectors(qVec, k);
        return results.map((r: any) => r.text);
    }

    // Fallback: all embeddings to RAM (bad at scale, ok for PoC)
    const all = await store.loadAllEmbeddings(0);
    const sim = (a: number[], b: number[]) => {
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
        return dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-9);
    };
    const top = all
        .map((e: any) => ({ id: e.id, score: sim(qVec, e.vector) }))
        .sort((x: any, y: any) => y.score - x.score)
        .slice(0, k)
        .map((t: any) => t.id);

    const chunks = await store.getChunksByIds(top);
    return chunks.map((c: any) => c.text);
}
