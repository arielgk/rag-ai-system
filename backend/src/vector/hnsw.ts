import hnswlib from "hnswlib-node";
import fs from "node:fs";
import path from "node:path";

type Item = { id: number; vector: number[] };

export class HNSWIndex {
    private index: any | null = null;
    private dim: number | null = null;
    private readonly filePath: string;

    constructor(dir = "data/index", file = "index.bin") {
        this.filePath = path.resolve(dir, file);
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    }

    async loadOrCreate(dimension: number) {
        this.dim = dimension;
        this.index = new hnswlib.HierarchicalNSW("cosine", dimension);
        if (fs.existsSync(this.filePath)) {
            this.index.readIndex(this.filePath);
        } else {
            this.index.initIndex(10000); // capacity grows automatically
        }
    }

    add(items: Item[]) {
        if (!this.index) throw new Error("Index not initialized");
        this.index.addItems(items.map(i => i.vector), items.map(i => i.id));
    }

    hasItems(): boolean {
        if (!this.index) return false;
        return this.index.getCurrentCount() > 0;
    }

    save() {
        if (this.index) this.index.writeIndex(this.filePath);
    }

    knn(vector: number[], k: number) {
        if (!this.index) throw new Error("Index not initialized");
        const { distances, neighbors } = this.index.searchKnn(vector, k);
        return neighbors as number[];
    }
}
