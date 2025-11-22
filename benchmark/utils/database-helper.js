/**
 * Database Helper for Swarm and Hive Mind Databases
 * Provides utilities to interact with memory.db and hive.db
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseHelper {
  constructor() {
    this.swarmDbPath = path.join(process.cwd(), '.swarm', 'memory.db');
    this.hiveDbPath = path.join(process.cwd(), '.hive-mind', 'hive.db');
    this.swarmDb = null;
    this.hiveDb = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Connect to Swarm Memory DB
      this.swarmDb = new sqlite3.Database(this.swarmDbPath, (err) => {
        if (err) {
          console.error('Error connecting to swarm database:', err);
          reject(err);
        } else {
          console.log('Connected to swarm memory database');

          // Connect to Hive Mind DB
          this.hiveDb = new sqlite3.Database(this.hiveDbPath, (err2) => {
            if (err2) {
              console.error('Error connecting to hive database:', err2);
              reject(err2);
            } else {
              console.log('Connected to hive mind database');
              resolve();
            }
          });
        }
      });
    });
  }

  async storeTaskMemory(taskId, taskData, approach) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO memory_entries (key, value, namespace, metadata, created_at, updated_at, accessed_at, access_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const metadata = JSON.stringify({
        approach,
        taskId,
        timestamp: Date.now()
      });

      const now = Date.now();
      this.swarmDb.run(
        query,
        [`task_${taskId}`, JSON.stringify(taskData), approach, metadata, now, now, now, 0],
        (err) => {
          if (err) {
            console.error('Error storing task memory:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async storeReasoning(taskId, reasoning, approach) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO patterns (
          id,
          type,
          pattern_data,
          confidence,
          usage_count,
          created_at,
          last_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const patternData = JSON.stringify({
        approach,
        taskId,
        reasoning,
        outcome: 'completed'
      });

      const now = new Date().toISOString();
      const patternId = `pattern_${taskId}_${Date.now()}`;

      this.swarmDb.run(
        query,
        [
          patternId,
          'task_completion',
          patternData,
          0.9,
          1,
          now,
          now
        ],
        (err) => {
          if (err) {
            console.error('Error storing reasoning:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async storeHiveKnowledge(sessionId, knowledge, workers) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO knowledge_base (
          id,
          swarm_id,
          category,
          title,
          content,
          tags,
          confidence,
          source_agent_id,
          created_at,
          updated_at,
          access_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const now = new Date().toISOString();
      const knowledgeId = `knowledge_${sessionId}_${Date.now()}`;

      this.hiveDb.run(
        query,
        [
          knowledgeId,
          sessionId,
          'benchmark',
          knowledge.scenario || 'Benchmark Session',
          JSON.stringify(knowledge),
          'benchmark,performance,swarm',
          0.8,
          'queen',
          now,
          now,
          0
        ],
        (err) => {
          if (err) {
            console.error('Error storing hive knowledge:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getSwarmStats() {
    return new Promise((resolve, reject) => {
      const queries = {
        totalMemories: 'SELECT COUNT(*) as count FROM memory_entries',
        totalPatterns: 'SELECT COUNT(*) as count FROM patterns',
        memoryNamespaces: 'SELECT namespace, COUNT(*) as count FROM memory_entries GROUP BY namespace'
      };

      const stats = {};

      this.swarmDb.get(queries.totalMemories, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalMemories = row ? row.count : 0;

        this.swarmDb.get(queries.totalPatterns, (err2, row2) => {
          if (err2) {
            reject(err2);
            return;
          }
          stats.totalReasoning = row2 ? row2.count : 0;

          this.swarmDb.all(queries.memoryNamespaces, (err3, rows) => {
            if (err3) {
              reject(err3);
              return;
            }
            stats.memoryTypes = rows || [];
            resolve(stats);
          });
        });
      });
    });
  }

  async getHiveStats() {
    return new Promise((resolve, reject) => {
      const queries = {
        totalSessions: 'SELECT COUNT(*) as count FROM sessions',
        totalKnowledge: 'SELECT COUNT(*) as count FROM knowledge_base',
        totalVotes: 'SELECT COUNT(*) as count FROM consensus_votes'
      };

      const stats = {};

      this.hiveDb.get(queries.totalSessions, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        stats.totalSessions = row ? row.count : 0;

        this.hiveDb.get(queries.totalKnowledge, (err2, row2) => {
          if (err2) {
            reject(err2);
            return;
          }
          stats.totalMemories = row2 ? row2.count : 0;

          this.hiveDb.get(queries.totalVotes, (err3, row3) => {
            if (err3) {
              reject(err3);
              return;
            }
            stats.totalDecisions = row3 ? row3.count : 0;
            resolve(stats);
          });
        });
      });
    });
  }

  async close() {
    return new Promise((resolve) => {
      if (this.swarmDb) {
        this.swarmDb.close(() => {
          console.log('Closed swarm database');
          if (this.hiveDb) {
            this.hiveDb.close(() => {
              console.log('Closed hive database');
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = DatabaseHelper;
