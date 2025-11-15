import {
  createAgent,
  ICredentialPlugin,
  IDataStore,
  IDataStoreORM,
  IDIDManager,
  IKeyManager,
  IResolver,
} from "@veramo/core";
import "dotenv/config";

import {
  CredentialIssuerLD,
  LdDefaultContexts,
  VeramoEcdsaSecp256k1RecoverySignature2020,
  VeramoEd25519Signature2018,
  VeramoJsonWebSignature2020,
} from "@veramo/credential-ld";

import { CredentialPlugin } from "@veramo/credential-w3c";
import {
  DataStore,
  DataStoreORM,
  DIDStore,
  Entities,
  KeyStore,
  migrations,
  PrivateKeyStore,
} from "@veramo/data-store";

import { DIDComm, IDIDComm } from "@veramo/did-comm";
import { DIDManager } from "@veramo/did-manager";
import { EthrDIDProvider } from "@veramo/did-provider-ethr";
import { DIDResolverPlugin } from "@veramo/did-resolver";
import { KeyManager } from "@veramo/key-manager";
import { KeyManagementSystem, SecretBox } from "@veramo/kms-local";
import { DataSource } from "typeorm";
import { ethSepoliaProvider } from "./providers.js";
import { sharedDidResolver } from "./resolver.js";
import { KMS_SECRET_KEY } from "../config.js";
// import { webDidResolver } from "@veramo/did-resolver";
import { getResolver as webDidResolver } from "web-did-resolver";
import { WebDIDProvider } from "@veramo/did-provider-web";
import { Resolver } from "did-resolver";

const DATABASE_FILE = "./data/database.sqlite";

type ProviderConfig =
  | {
      method: "ethr";
      name?: string;
      network: string;
      registry?: string;
      chainId?: number;
      provider?: any;
    }
  | { method: "web"; name?: string } // add more options per adapter as needed
  | { method: "key"; name?: string }; // example

function createDidProviders(
  configs: ProviderConfig[],
  dbConnection: DataSource
) {
  const providers: Record<string, any> = {};

  for (const conf of configs) {
    if (conf.method === "ethr") {
      const methodName = conf.name || `did:ethr:${conf.network}`;
      providers[methodName] = new EthrDIDProvider({
        defaultKms: "local",
        networks: [
          {
            name: conf.network,
            provider: conf.provider ?? ethSepoliaProvider,
            chainId: conf.chainId ?? 11155111,
            registry: conf.registry,
          },
        ],
        registry: conf.registry,
      });
    } else if (conf.method === "web") {
      const methodName = conf.name || "did:web";
      providers[methodName] = new WebDIDProvider({
        defaultKms: "local",
        /* WebDID provider options (if any) */
      });
    } else if (conf.method === "key") {
      // example: did:key provider if you add the package
      // providers[conf.name || 'did:key'] = new KeyDIDProvider({ defaultKms: 'local' });
    }
  }

  return providers;
}

// const resolver = new Resolver({
//   ...sharedDidResolver,
//   // ...webDidResolver(),
// });

/**
 * Initializes and returns the Veramo agent.
 */
export async function getAgent({
  didProviderConfigs = [
    {
      method: "ethr",
      name: "did:ethr:sepolia",
      network: "sepolia",
      registry: "0x03d5003bf0e79C5F5223588F347ebA39AfbC3818",
      chainId: 11155111,
      provider: ethSepoliaProvider,
    },
    // You can enable did:web by default or pass it at startup
    // { method: 'web', name: 'did:web' },
  ],
}: { didProviderConfigs?: ProviderConfig[] } = {}) {
  const dbConnection = await new DataSource({
    type: "sqlite",
    database: DATABASE_FILE,
    synchronize: false,
    migrations,
    migrationsRun: true,
    logging: ["error", "info", "warn"],
    entities: Entities,
  }).initialize();

  const providers = createDidProviders(didProviderConfigs, dbConnection);

  return createAgent<
    IDIDManager &
      IKeyManager &
      IDataStore &
      IDataStoreORM &
      IResolver &
      ICredentialPlugin &
      IDIDComm
  >({
    plugins: [
      new KeyManager({
        store: new KeyStore(dbConnection),
        kms: {
          local: new KeyManagementSystem(
            new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY))
          ),
        },
      }),
      new DIDManager({
        store: new DIDStore(dbConnection),
        defaultProvider: Object.keys(providers)[0] ?? "did:ethr:sepolia",
        providers,
        // providers: {
        //   "did:ethr:sepolia": new EthrDIDProvider({
        //     defaultKms: "local",
        //     networks: [
        //       {
        //         name: "sepolia",
        //         provider: ethSepoliaProvider,
        //         chainId: 11155111,
        //         registry: "0x03d5003bf0e79C5F5223588F347ebA39AfbC3818",
        //       },
        //     ],
        //     registry: "0x03d5003bf0e79C5F5223588F347ebA39AfbC3818",
        //   }),
        // },
      }),
      new DIDResolverPlugin({
        resolver: sharedDidResolver,
      }),
      new CredentialPlugin(),
      new CredentialIssuerLD({
        contextMaps: [LdDefaultContexts],
        suites: [
          new VeramoEd25519Signature2018(),
          new VeramoJsonWebSignature2020(),
          new VeramoEcdsaSecp256k1RecoverySignature2020(),
        ],
      }),
      new DIDComm(),
      new DataStore(dbConnection),
      new DataStoreORM(dbConnection),
    ],
  });
}
