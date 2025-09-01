import { Pool, PoolClient } from "pg";
import { Env } from "../env.js";

const env = Env.parse(process.env);

export async function getPool(): Promise<Pool> {
    return new Pool({
        host: env.POSTGRES_HOST,
        port: env.POSTGRES_PORT,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        database: env.POSTGRES_DB,
        max: 10,
    });
}

export async function ensureSchema() {
    const pool = await getPool();
    
    // Enable pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    // Create documents table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS documents (
            id BIGSERIAL PRIMARY KEY,
            path VARCHAR(512) UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Create chunks table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS chunks (
            id BIGSERIAL PRIMARY KEY,
            document_id BIGINT NOT NULL,
            chunk_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );
    `);

    // Create embeddings table with pgvector (no fixed dimension)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS embeddings (
            chunk_id BIGINT PRIMARY KEY,
            embedding vector,
            FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
        );
    `);

    // Create indexes for better performance
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
    `);
    
    // Note: Vector index will be created after data is inserted
    // CREATE INDEX IF NOT EXISTS idx_embeddings_embedding ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
}

export async function insertDocument(path: string, chunks: { index: number; text: string; vector: number[] }[]) {
    const pool = await getPool();
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Insert or update document
        const docRes = await client.query(
            `INSERT INTO documents (path) VALUES ($1) ON CONFLICT (path) DO UPDATE SET path = EXCLUDED.path RETURNING id`,
            [path]
        );
        const documentId = docRes.rows[0].id;

        for (const chunk of chunks) {
            // Insert chunk
            const chunkRes = await client.query(
                `INSERT INTO chunks (document_id, chunk_index, text) VALUES ($1, $2, $3) RETURNING id`,
                [documentId, chunk.index, chunk.text]
            );
            const chunkId = chunkRes.rows[0].id;
            
            // Insert embedding using pgvector - convert array to proper format
            await client.query(
                `INSERT INTO embeddings (chunk_id, embedding) VALUES ($1, $2::vector)`,
                [chunkId, `[${chunk.vector.join(',')}]`]
            );
        }
        
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

export async function loadAllEmbeddings(limit = 0) {
    const pool = await getPool();
    const sql = `
        SELECT e.chunk_id, c.text, e.embedding
        FROM embeddings e
        JOIN chunks c ON c.id = e.chunk_id
        ${limit ? "LIMIT $1" : ""}
    `;
    
    const params = limit ? [limit] : [];
    const result = await pool.query(sql, params);
    
    return result.rows.map(row => ({
        id: row.chunk_id,
        text: row.text,
        vector: row.embedding,
    }));
}

export async function getChunksByIds(ids: number[]) {
    if (ids.length === 0) return [];
    
    const pool = await getPool();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
        `SELECT id, text FROM chunks WHERE id IN (${placeholders})`,
        ids
    );
    
    return result.rows;
}

export async function searchSimilarVectors(queryVector: number[], k: number) {
    const pool = await getPool();
    
    const result = await pool.query(`
        SELECT e.chunk_id, c.text, e.embedding <=> $1::vector as distance
        FROM embeddings e
        JOIN chunks c ON c.id = e.chunk_id
        ORDER BY e.embedding <=> $1::vector
        LIMIT $2
    `, [`[${queryVector.join(',')}]`, k]);
    
    return result.rows.map(row => ({
        id: row.chunk_id,
        text: row.text,
        distance: row.distance,
    }));
}
