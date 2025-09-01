import fs from "node:fs/promises";
import path from "node:path";
import { embed } from "./llm.js";
import { insertDocument, ensureSchema } from "./vector/mysql-store.js";

const DOCS_DIR = "data/docs";

function splitText(text: string, chunkSize = 1000, overlap = 200) {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

async function readFileExtractText(file: string) {
    const buf = await fs.readFile(file);
    if (file.endsWith(".pdf")) {
        console.warn(`PDF parsing not supported yet: ${file}`);
        return "";
    }
    return buf.toString("utf8");
}

(async () => {
    await ensureSchema();

    const files = await fs.readdir(DOCS_DIR);
    for (const f of files) {
        const full = path.join(DOCS_DIR, f);
        const text = await readFileExtractText(full);
        const parts = splitText(text);

        const vectors = await embed(parts);
        const payload = parts.map((t, i) => ({ index: i, text: t, vector: vectors[i] }));

        await insertDocument(f, payload);
        console.log(`Ingested: ${f} (${parts.length} chunks)`);
    }

    console.log("Ingest done.");
    process.exit(0);
})();
