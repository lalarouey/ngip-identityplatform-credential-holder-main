import { IIdentifier, TKeyType } from '@veramo/core';
import { agent } from '../src/server/server.js';
import { TX_TIMEOUT } from './config.js';
import { ethSepoliaProvider } from './veramo/providers.js';
import { TransactionReceipt } from 'ethers';

/**
 * Create a new identifier
 * @param alias - Alias for the identifier
 * @returns The created identifier
 * @example
 * const identifier = await createIdentifier("test");
 */
export async function createIdentifier(alias?: string): Promise<IIdentifier> {
  if (alias) {
    const identifier = await agent.didManagerCreate({ alias: alias });
    console.log(`Identifier created with alias: ${alias}:`, identifier);
    return identifier;
  } else {
    const identifier = await agent.didManagerCreate();
    console.log('Identifier created:', identifier);
    return identifier;
  }
}

/**
 * Removes an identifier
 * @param did - The DID of the identifier to remove
 * @returns True if the identifier was removed successfully, false otherwise
 * @example
 * const result = await removeIdentifier("did:ethr:sepolia:0x123abc");
 */
export async function removeIdentifier(did: string): Promise<boolean> {
  if (did) {
    const result = await agent.didManagerDelete({ did: did });
    console.log(`Identifier removed: ${did}`, result);
    return result;
  } else {
    console.log('No identifier specified');
    return false;
  }
}

/**
 * Removes an identifier with a specific alias
 * @param alias - The alias of the identifier to remove
 * @returns True if the identifier was removed successfully, false otherwise
 * @example
 * const result = await removeIdentifierWithAlias("test");
 */
export async function removeIdentifierWithAlias(
  alias: string,
): Promise<boolean> {
  const identifiers = await agent.didManagerFind({ alias: alias });
  if (identifiers.length > 0) {
    const result = await agent.didManagerDelete({ did: identifiers[0].did });
    console.log(`Identifier removed with alias: ${alias}`, result);
    return result;
  } else {
    console.log(`No identifier found with alias: ${alias}`);
    return false;
  }
}

/**
 * Lists all identifiers
 * @returns An array of all identifiers
 * @example
 * const identifiers = await listIdentifiers();
 */
export async function listIdentifiers(): Promise<IIdentifier[]> {
  const identifiers = await agent.didManagerFind();
  return identifiers;
}

/**
 * Adds an encryption key to an identifier
 * @param did - The DID of the identifier
 * @param keyType - The type of key to add
 * @param validFor - The validity period for the key in seconds (optional)
 * @returns True if the key was added successfully, false otherwise
 * @example
 * const result = await addEncryptionKey(
 *   "did:ethr:sepolia:0x123abc",
 *   "X25519"
 *   86400
 * );
 */
export async function addEncryptionKey(
  did: string,
  keyType: TKeyType,
  validFor?: number,
): Promise<boolean> {
  try {
    const key = await agent.keyManagerCreate({
      type: keyType,
      kms: 'local',
    }); // Create a new encryption key
    const txHash = await agent.didManagerAddKey({
      did: did,
      key: key,
      options: { ttl: validFor ? validFor : 86400 * 2 }, // valid for 2 days if not specified
    });
    const receipt: TransactionReceipt | null =
      await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT); // Wait for the transaction to be mined
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction failed: ${txHash}`);
    }
    console.log(`Encryption key added to identifier: ${did}`, key);
    return true;
  } catch (error) {
    console.log('Error adding encryption key:', error);
    return false;
  }
}

export async function addService(
  did: string,
  service: any,
  validFor: number,
): Promise<string> {
  const txHash = await agent.didManagerAddService({
    did: did,
    service: {
      id: `${did}#${service.type}`,
      type: `${service.type}`,
      serviceEndpoint: service.serviceEndpoint,
      description: service.description,
    },
    options: { ttl: validFor ? validFor : 86400 * 2 }, // valid for 2 days if not specified
  });
  const receipt: TransactionReceipt | null =
    await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT); // Wait for the transaction to be mined
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed: ${txHash}`);
  }
  console.log('Service added, txHash:', txHash);
  return txHash;
}

export async function removeService(
  did: string,
  serviceId: string,
): Promise<string> {
  const txHash = await agent.didManagerRemoveService({
    did: did,
    id: serviceId,
  });
  const receipt: TransactionReceipt | null =
    await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT); // Wait for the transaction to be mined
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed: ${txHash}`);
  }
  console.log('Service removed, txHash:', txHash);
  return txHash;
}
