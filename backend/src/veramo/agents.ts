import {
  createAgent,
  ICredentialPlugin,
  IDataStore,
  IDataStoreORM,
  IDIDManager,
  IKeyManager,
  IResolver,
} from '@veramo/core';
import 'dotenv/config';

import {
  CredentialIssuerLD,
  LdDefaultContexts,
  VeramoEcdsaSecp256k1RecoverySignature2020,
  VeramoEd25519Signature2018,
  VeramoJsonWebSignature2020,
} from '@veramo/credential-ld';

import { CredentialPlugin } from '@veramo/credential-w3c';
import {
  DataStore,
  DataStoreORM,
  DIDStore,
  Entities,
  KeyStore,
  migrations,
  PrivateKeyStore,
} from '@veramo/data-store';

import { DIDComm, IDIDComm } from '@veramo/did-comm';
import { DIDManager } from '@veramo/did-manager';
import { EthrDIDProvider } from '@veramo/did-provider-ethr';
import { DIDResolverPlugin } from '@veramo/did-resolver';
import { KeyManager } from '@veramo/key-manager';
import { KeyManagementSystem, SecretBox } from '@veramo/kms-local';
import { DataSource } from 'typeorm';
import { ethSepoliaProvider } from './providers.js';
import { sharedDidResolver } from './resolver.js';
import { KMS_SECRET_KEY } from '../config.js';

const DATABASE_FILE = './data/database.sqlite';

/**
 * Initializes and returns the Veramo agent.
 */
export async function getAgent() {
  const dbConnection = await new DataSource({
    type: 'sqlite',
    database: DATABASE_FILE,
    synchronize: false,
    migrations,
    migrationsRun: true,
    logging: ['error', 'info', 'warn'],
    entities: Entities,
  }).initialize();

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
            new PrivateKeyStore(dbConnection, new SecretBox(KMS_SECRET_KEY)),
          ),
        },
      }),
      new DIDManager({
        store: new DIDStore(dbConnection),
        defaultProvider: 'did:ethr:sepolia',
        providers: {
          'did:ethr:sepolia': new EthrDIDProvider({
            defaultKms: 'local',
            networks: [
              {
                name: 'sepolia',
                provider: ethSepoliaProvider,
                chainId: 11155111,
                registry: '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818',
              },
            ],
            registry: '0x03d5003bf0e79C5F5223588F347ebA39AfbC3818',
          }),
        },
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
