import { migrate } from './db.js';

await migrate();
console.info('Retain database schema is up to date.');
