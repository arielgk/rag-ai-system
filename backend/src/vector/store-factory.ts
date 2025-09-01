import { Env } from "../env.js";
import * as postgresStore from "./postgres-store.js";

const env = Env.parse(process.env);

export interface VectorStore {
    ensureSchema(): Promise<void>;
    insertDocument(path: string, chunks: { index: number; text: string; vector: number[] }[]): Promise<void>;
    loadAllEmbeddings(limit?: number): Promise<{ id: number; text: string; vector: number[] }[]>;
    getChunksByIds(ids: number[]): Promise<{ id: number; text: string }[]>;
    searchSimilarVectors?(queryVector: number[], k: number): Promise<{ id: number; text: string; distance: number }[]>;
}

export function getVectorStore(): VectorStore {
    switch (env.VECTOR_BACKEND) {
        case "postgres":
            return {
                ensureSchema: postgresStore.ensureSchema,
                insertDocument: postgresStore.insertDocument,
                loadAllEmbeddings: postgresStore.loadAllEmbeddings,
                getChunksByIds: postgresStore.getChunksByIds,
                searchSimilarVectors: postgresStore.searchSimilarVectors,
            };
        case "hnsw":
            return {
                ensureSchema: postgresStore.ensureSchema,
                insertDocument: postgresStore.insertDocument,
                loadAllEmbeddings: postgresStore.loadAllEmbeddings,
                getChunksByIds: postgresStore.getChunksByIds,
            };
        default:
            throw new Error(`Unsupported vector backend: ${env.VECTOR_BACKEND}`);
    }
}

export async function getConnectionPool() {
    switch (env.VECTOR_BACKEND) {
        case "postgres":
        case "hnsw":
            return postgresStore.getPool();
        default:
            throw new Error(`Unsupported vector backend: ${env.VECTOR_BACKEND}`);
    }
}
