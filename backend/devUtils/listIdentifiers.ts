import { listIdentifiers } from '../src/identifiers.js';

async function listDIDs() {
  const identifiers = await listIdentifiers();
  console.log(identifiers);
}

await listDIDs();
