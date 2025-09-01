import { embed } from "../llm.js";
import { loadAllEmbeddings, getChunksByIds } from "./mysql-store.js";
import { HNSWIndex } from "./hnsw.js";
import { Env } from "../env.js";

const env = Env.parse(process.env);
const hnsw = new HNSWIndex();

let ready = false;
let dim = 0;

export async function initRetriever() {
    // just an embedding of a single sample to get dimension
    const [probe] = await embed(["dimension probe"]);
    dim = probe.length;

    if (env.VECTOR_BACKEND === "hnsw") {
        await hnsw.loadOrCreate(dim);

        // build index (idempotence) from MySQL
        const items = await loadAllEmbeddings(0);
        if (items.length && !hnsw.hasItems()) {
            hnsw.add(items.map((i) => ({ id: i.id, vector: i.vector })));
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
        const chunks = await getChunksByIds(ids);
        return chunks.map((c) => c.text);
    }

    // all embeddings to RAM (bad at scale, ok for PoC)
    const all = await loadAllEmbeddings(0);
    const sim = (a: number[], b: number[]) => {
        let dot = 0, na = 0, nb = 0;
        for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
        return dot / (Math.sqrt(na)*Math.sqrt(nb) + 1e-9);
    };
    const top = all
        .map(e => ({ id: e.id, score: sim(qVec, e.vector) }))
        .sort((x,y) => y.score - x.score)
        .slice(0, k)
        .map(t => t.id);

    const chunks = await getChunksByIds(top);
    return chunks.map(c => c.text);
}
