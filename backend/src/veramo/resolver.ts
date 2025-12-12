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

// Store agent getter function for did:web resolver
let agentGetter: (() => any) | null = null;

export function setAgentGetter(getter: () => any) {
  agentGetter = getter;
}

// Custom did:web resolver that checks locally managed DIDs
const webDidResolver = async (did: string): Promise<DIDResolutionResult> => {
  // Extract just the DID part (remove fragment if present)
  // The did-resolver library should handle this, but let's be safe
  const didWithoutFragment = did.split('#')[0];
  
  // If we have an agent getter, try to resolve from local manager
  if (agentGetter) {
    try {
      const agent = agentGetter();
      if (agent) {
        // First try to get from local manager (use DID without fragment)
        const identifier = await agent.didManagerGet({ did: didWithoutFragment });
        if (identifier) {
          // Construct DID document from the local identifier
          const verificationMethod: any[] = [];
          const keyAgreementIds: string[] = [];

          identifier.keys
            .filter((key: any) => key.type === "Secp256k1")
            .forEach((key: any) => {
              const vmId = `${didWithoutFragment}#${key.kid}`;
              verificationMethod.push({
                id: vmId,
                type: "EcdsaSecp256k1VerificationKey2019",
                controller: didWithoutFragment,
                publicKeyHex: key.publicKeyHex,
              });
            });

          identifier.keys
            .filter((key: any) => key.type === "X25519")
            .forEach((key: any) => {
              const vmId = `${didWithoutFragment}#${key.kid}`;
              verificationMethod.push({
                id: vmId,
                type: "X25519KeyAgreementKey2019",
                controller: didWithoutFragment,
                publicKeyHex: key.publicKeyHex,
              });
              keyAgreementIds.push(vmId);
            });

          const services = identifier.services?.map((service: any) => ({
            id: service.id || `${didWithoutFragment}#${service.type}`,
            type: service.type,
            serviceEndpoint: service.serviceEndpoint,
          })) || [];

          const didDocument = {
            id: didWithoutFragment,
            "@context": [
              "https://www.w3.org/ns/did/v1",
              "https://w3id.org/security/suites/secp256k1-2019/v1",
              "https://w3id.org/security/suites/x25519-2019/v1",
            ],
            verificationMethod: verificationMethod.length > 0 ? verificationMethod : undefined,
            keyAgreement: keyAgreementIds.length > 0 ? keyAgreementIds : undefined,
            service: services.length > 0 ? services : undefined,
          };

          return {
            didDocument,
            didDocumentMetadata: {},
            didResolutionMetadata: { contentType: "application/did+ld+json" },
          } as DIDResolutionResult;
        }
        
        // If not found locally, try using agent's resolveDid which might use other resolvers
        // This is important for cross-agent communication where the DID might be from another agent
        try {
          const resolutionResult = await agent.resolveDid({ didUrl: didWithoutFragment });
          if (resolutionResult.didDocument) {
            return {
              didDocument: resolutionResult.didDocument,
              didDocumentMetadata: resolutionResult.didDocumentMetadata || {},
              didResolutionMetadata: resolutionResult.didResolutionMetadata || { contentType: "application/did+ld+json" },
            } as DIDResolutionResult;
          }
        } catch (resolveError) {
          // If agent.resolveDid fails, continue to try web resolution
        }
      }
    } catch (error) {
      // If local lookup fails, continue to try web resolution
    }
  }

  // If not found locally or via agent, try to resolve from web using standard web DID resolution
  // This will fetch from https://{domain}/.well-known/did.json
  try {
    // Extract domain from did:web
    const domain = didWithoutFragment.replace('did:web:', '').replace(/%3A/g, ':').replace(/%2F/g, '/');
    const url = `https://${domain}/.well-known/did.json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    
    if (response.ok) {
      const didDocument = await response.json();
      return {
        didDocument,
        didDocumentMetadata: {},
        didResolutionMetadata: { contentType: "application/did+ld+json" },
      } as DIDResolutionResult;
    }
  } catch (webError) {
    // Web resolution failed, continue to return not found
  }

  // If not found locally, via agent, or from web, return not found
  return {
    didDocument: null,
    didDocumentMetadata: {},
    didResolutionMetadata: {
      error: "notFound",
      message: `DID document not found for ${didWithoutFragment}`,
    },
  } as DIDResolutionResult;
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
    web: webDidResolver,
  },
  { cache: didCache },
);
