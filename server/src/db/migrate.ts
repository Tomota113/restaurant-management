import fs from 'fs';
import path from 'path';
import { db } from './connection';

export function runMigrations(): void {
  const candidatePaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../src/db/schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'server/src/db/schema.sql')
  ];

  let schemaSql = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      schemaSql = fs.readFileSync(p, 'utf8');
      break;
    }
  }

  if (!schemaSql) {
    throw new Error('Could not find schema.sql in candidate paths: ' + JSON.stringify(candidatePaths));
  }

  db.exec(schemaSql);
  console.log('✔ Migrations applied successfully.');
}

if (require.main === module) {
  runMigrations();
}
