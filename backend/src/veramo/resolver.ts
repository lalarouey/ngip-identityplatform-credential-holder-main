import { DIDCache, DIDResolutionResult, Resolver } from 'did-resolver';
import { getResolver as ethrDidResolver } from 'ethr-did-resolver';
import { LRUCache } from 'lru-cache';
import { ethSepoliaProvider } from './providers.js';

export var cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60 * 24, // 1 day
});
const didCache: DIDCache = async (parsed, resolve) => {
  // DID spec requires to not cache if no-cache param is set
  if (parsed.params && parsed.params['no-cache'] === 'true')
    return (await resolve()) as DIDResolutionResult;
  const cached = cache.get(parsed.did);
  if (cached !== undefined) return cached as DIDResolutionResult;
  const doc = (await resolve()) as DIDResolutionResult;
  cache.set(parsed.did, doc);
  return doc;
};

// --- Shared resolver instance ---
export const sharedDidResolver = new Resolver(
  {
    ...ethrDidResolver({
      networks: [
        {
          name: 'sepolia',
          provider: ethSepoliaProvider,
          chainId: 11155111,
          registry: '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818',
        },
      ],
    }),
  },
  { cache: didCache },
);
