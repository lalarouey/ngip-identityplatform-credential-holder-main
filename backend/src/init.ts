import { agent } from './server/server';
import { initializeDID } from '../src/utils.js';

const defaultDID = await agent.didManagerGetByAlias({
  alias: 'default',
});
await initializeDID(defaultDID.did);
