import fs from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { embed } from "./llm.js";
import { getVectorStore } from "./vector/store-factory.js";
import { createRequire } from "module";

// Load environment variables
config();

const DOCS_DIR = "data/docs";

// Create require function for pdf-parse
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse/lib/pdf-parse.js");

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
        try {
            const data = await pdf(buf);
            return data.text;
        } catch (error) {
            console.error(`Error parsing PDF ${file}:`, error);
            return "";
        }
    }
    return buf.toString("utf8");
}

(async () => {
    const store = getVectorStore();
    await store.ensureSchema();

    const files = await fs.readdir(DOCS_DIR);
    for (const f of files) {
        const full = path.join(DOCS_DIR, f);
        const text = await readFileExtractText(full);
        
        // Skip files with no content
        if (!text || text.trim().length === 0) {
            console.log(`Skipping empty file: ${f}`);
            continue;
        }
        
        const parts = splitText(text).filter(part => part.trim().length > 0);
        
        // Skip if no valid chunks
        if (parts.length === 0) {
            console.log(`Skipping file with no valid chunks: ${f}`);
            continue;
        }

        const vectors = await embed(parts);
        const payload = parts.map((t, i) => ({ index: i, text: t, vector: vectors[i] }));

        await store.insertDocument(f, payload);
        console.log(`Ingested: ${f} (${parts.length} chunks)`);
    }

    console.log("Ingest done.");
    process.exit(0);
})();
