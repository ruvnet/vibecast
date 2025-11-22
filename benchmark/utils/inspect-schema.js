const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function inspectDatabase(dbPath, name) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error(`Error opening ${name}:`, err.message);
        reject(err);
        return;
      }

      console.log(`\n📊 ${name} Schema:\n`);

      db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
          reject(err);
          return;
        }

        console.log(`Tables: ${tables.map(t => t.name).join(', ')}\n`);

        let completed = 0;
        tables.forEach(table => {
          db.all(`PRAGMA table_info(${table.name})`, [], (err, columns) => {
            if (!err) {
              console.log(`Table: ${table.name}`);
              columns.forEach(col => {
                console.log(`  - ${col.name} (${col.type})${col.pk ? ' PRIMARY KEY' : ''}`);
              });
              console.log('');
            }

            completed++;
            if (completed === tables.length) {
              db.close();
              resolve();
            }
          });
        });

        if (tables.length === 0) {
          db.close();
          resolve();
        }
      });
    });
  });
}

async function main() {
  const swarmDbPath = path.join(process.cwd(), '.swarm', 'memory.db');
  const hiveDbPath = path.join(process.cwd(), '.hive-mind', 'hive.db');

  await inspectDatabase(swarmDbPath, 'Swarm Memory Database');
  await inspectDatabase(hiveDbPath, 'Hive Mind Database');
}

main().catch(console.error);
