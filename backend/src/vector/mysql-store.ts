import mysql from "mysql2/promise";
import { Env } from "../env.js";

const env = Env.parse(process.env);

export async function getPool() {
    return mysql.createPool({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DB,
        connectionLimit: 10,
    });
}

export async function ensureSchema() {
    const pool = await getPool();
    await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      path VARCHAR(512) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS chunks (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      document_id BIGINT NOT NULL,
      chunk_index INT NOT NULL,
      text MEDIUMTEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      INDEX doc_id_idx (document_id)
    ) ENGINE=InnoDB;
  `);

    await pool.query(`
    CREATE TABLE IF NOT EXISTS embeddings (
      chunk_id BIGINT PRIMARY KEY,
      -- Guardamos vector como JSON; para MySQL-only lo recuperamos a Node
      vector_json JSON NOT NULL,
      FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);
}

export async function insertDocument(path: string, chunks: { index: number; text: string; vector: number[] }[]) {
    const pool = await getPool();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [docRes] = await conn.query(`INSERT INTO documents (path) VALUES (?) ON DUPLICATE KEY UPDATE path=VALUES(path)`, [path]);
        const documentId = (docRes as any).insertId || (await conn.query(`SELECT id FROM documents WHERE path=?`, [path]).then(([r]: any) => r[0].id));

        for (const c of chunks) {
            const [chunkRes] = await conn.query(
                `INSERT INTO chunks (document_id, chunk_index, text) VALUES (?,?,?)`,
                [documentId, c.index, c.text]
            );
            const chunkId = (chunkRes as any).insertId;
            await conn.query(`INSERT INTO embeddings (chunk_id, vector_json) VALUES (?, JSON_ARRAY(${c.vector.join(",")}))`, [chunkId]);
        }
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

export async function loadAllEmbeddings(limit = 0) {
    const pool = await getPool();
    const sql = `
    SELECT e.chunk_id, c.text, e.vector_json
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    ${limit ? "LIMIT ?" : ""}
  `;
    const [rows] = await pool.query(sql, limit ? [limit] : []);
    return (rows as any[]).map(r => ({
        id: r.chunk_id,
        text: r.text as string,
        vector: r.vector_json as number[],
    }));
}

export async function getChunksByIds(ids: number[]) {
    if (ids.length === 0) return [];
    const pool = await getPool();
    const [rows] = await pool.query(
        `SELECT id, text FROM chunks WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids
    );
    return rows as { id: number; text: string }[];
}
