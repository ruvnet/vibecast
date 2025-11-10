import fs from 'fs';
import path from 'path';
import { researchConfig } from '../config/research';

export interface MemoryEntry {
  id: string;
  timestamp: Date;
  topic: string;
  query: string;
  response: string;
  sources: string[];
  insights: string[];
  confidence: number;
  tags: string[];
  embedding?: number[]; // For vector search
}

export interface ReflexionEntry {
  id: string;
  timestamp: Date;
  originalResponse: string;
  critique: string;
  improvedResponse: string;
  learningPoints: string[];
}

export class AgentMemory {
  private memoryPath: string;
  private memories: Map<string, MemoryEntry>;
  private reflexions: Map<string, ReflexionEntry>;

  constructor() {
    this.memoryPath = researchConfig.agentDbPath;
    this.memories = new Map();
    this.reflexions = new Map();
    this.initializeStorage();
    this.loadMemories();
  }

  private initializeStorage(): void {
    if (!fs.existsSync(this.memoryPath)) {
      fs.mkdirSync(this.memoryPath, { recursive: true });
    }
  }

  private loadMemories(): void {
    const memoriesFile = path.join(this.memoryPath, 'memories.json');
    const reflexionsFile = path.join(this.memoryPath, 'reflexions.json');

    try {
      if (fs.existsSync(memoriesFile)) {
        const data = JSON.parse(fs.readFileSync(memoriesFile, 'utf-8'));
        this.memories = new Map(Object.entries(data));
      }
      if (fs.existsSync(reflexionsFile)) {
        const data = JSON.parse(fs.readFileSync(reflexionsFile, 'utf-8'));
        this.reflexions = new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Error loading memories:', error);
    }
  }

  public saveMemories(): void {
    const memoriesFile = path.join(this.memoryPath, 'memories.json');
    const reflexionsFile = path.join(this.memoryPath, 'reflexions.json');

    try {
      fs.writeFileSync(
        memoriesFile,
        JSON.stringify(Object.fromEntries(this.memories), null, 2)
      );
      fs.writeFileSync(
        reflexionsFile,
        JSON.stringify(Object.fromEntries(this.reflexions), null, 2)
      );
    } catch (error) {
      console.error('Error saving memories:', error);
    }
  }

  public addMemory(entry: MemoryEntry): void {
    this.memories.set(entry.id, entry);
    this.cleanOldMemories();
    this.saveMemories();
  }

  public addReflexion(entry: ReflexionEntry): void {
    this.reflexions.set(entry.id, entry);
    this.saveMemories();
  }

  public searchMemories(query: string, topK: number = 5): MemoryEntry[] {
    // Simple semantic search based on keyword matching
    // In production, this would use actual vector embeddings
    const queryLower = query.toLowerCase();
    const scored = Array.from(this.memories.values()).map(memory => {
      let score = 0;
      const queryWords = queryLower.split(' ');
      const memoryText = `${memory.topic} ${memory.query} ${memory.response}`.toLowerCase();

      queryWords.forEach(word => {
        if (memoryText.includes(word)) {
          score += 1;
        }
      });

      return { memory, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(item => item.memory);
  }

  public getRecentMemories(count: number = 10): MemoryEntry[] {
    return Array.from(this.memories.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, count);
  }

  private cleanOldMemories(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - researchConfig.memoryRetentionDays);

    for (const [id, memory] of this.memories.entries()) {
      if (new Date(memory.timestamp) < cutoffDate) {
        this.memories.delete(id);
      }
    }
  }

  public getMemoryStats(): {
    totalMemories: number;
    totalReflexions: number;
    averageConfidence: number;
  } {
    const total = this.memories.size;
    const avgConfidence = total > 0
      ? Array.from(this.memories.values()).reduce((sum, m) => sum + m.confidence, 0) / total
      : 0;

    return {
      totalMemories: total,
      totalReflexions: this.reflexions.size,
      averageConfidence: avgConfidence,
    };
  }
}
