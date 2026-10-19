import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.mjs';
import { setupPush } from './push.mjs';
import { createApp } from './app.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { randomToken } from './auth.mjs';

const db = await openDatabase();
const push = await setupPush(db);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173').split(',').map(s => s.trim());
let bootstrapToken = process.env.BOOTSTRAP_TOKEN;
if (!bootstrapToken && !process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  const keyFile = path.join(path.dirname(path.resolve(process.env.LOCAL_DATABASE_PATH || './.local-data/eligtas')), 'owner-setup.key');
  try { bootstrapToken = (await readFile(keyFile,'utf8')).trim(); }
  catch { bootstrapToken = randomToken(); await writeFile(keyFile,bootstrapToken,{mode:0o600,flag:'wx'}); }
  console.log('Local owner setup key is saved in .local-data/owner-setup.key');
}
const app = createApp(db, { push, allowedOrigins, bootstrapToken });
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
app.use(express.static(dist));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist,'index.html')));
const server = app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log(`E-Ligtas service listening on port ${process.env.PORT || 3001}`));
process.on('SIGTERM', () => server.close(() => void db.close()));
