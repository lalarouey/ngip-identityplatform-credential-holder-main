import { IIdentifier, TKeyType } from "@veramo/core-types"; // ✅ Fixed import
import { agent } from "../src/server/server.js";
import { TX_TIMEOUT } from "./config.js";
import { ethSepoliaProvider } from "./veramo/providers.js";
import { TransactionReceipt } from "ethers";

/**
 * Create a new identifier
 */
export async function createIdentifier(alias?: string): Promise<IIdentifier> {
  const identifier = await agent.didManagerCreate(alias ? { alias } : {});
  console.log(
    `Identifier created${alias ? " with alias: " + alias : ""}:`,
    identifier
  );
  try {
    const key = await agent.keyManagerCreate({
      type: "X25519", // encryption key type
      kms: "local",
    });

    const txHash = await agent.didManagerAddKey({
      did: identifier.did,
      key,
      options: { ttl: 86400 * 7 }, // valid for 7 days
    });

    const receipt = await ethSepoliaProvider.waitForTransaction(
      txHash,
      1,
      TX_TIMEOUT
    );

    if (!receipt || receipt.status !== 1) {
      throw new Error(`Failed to add X25519 key: ${txHash}`);
    }
    console.log(`X25519 encryption key added to DID: ${identifier.did}`);
  } catch (err) {
    console.error("Error adding X25519 key to DID:", err);
  }
  return identifier;
}

/**
 * Removes an identifier
 */
export async function removeIdentifier(did: string): Promise<boolean> {
  if (!did) {
    console.log("No identifier specified");
    return false;
  }
  const result = await agent.didManagerDelete({ did });
  console.log(`Identifier removed: ${did}`, result);
  return result;
}

/**
 * Removes an identifier with a specific alias
 */
export async function removeIdentifierWithAlias(
  alias: string
): Promise<boolean> {
  const identifiers = await agent.didManagerFind({ alias });
  if (identifiers.length === 0) {
    console.log(`No identifier found with alias: ${alias}`);
    return false;
  }

  const result = await agent.didManagerDelete({ did: identifiers[0].did });
  console.log(`Identifier removed with alias: ${alias}`, result);
  return result;
}

/**
 * Lists all identifiers
 */
export async function listIdentifiers(): Promise<IIdentifier[]> {
  return agent.didManagerFind();
}

/**
 * Adds an encryption key to an identifier
 */
export async function addEncryptionKey(
  did: string,
  keyType: TKeyType,
  validFor?: number
): Promise<boolean> {
  try {
    const key = await agent.keyManagerCreate({
      type: keyType,
      kms: "local",
    });

    // const txHash = await agent.didManagerAddKey({
    //   did,
    //   key,
    //   options: { ttl: validFor ?? 86400 * 2 },
    // });
    const result = await agent.didManagerAddKey({
      did: did,
      key: key,
      options: { ttl: validFor ? validFor : 86400 * 2 }, // valid for 2 days
    });
    if (did.startsWith("did:web:")) {
      console.log(`Encryption key added to identifier: ${did}`, key);
      return true;
    }
    const txHash = result as string;

    // const receipt: TransactionReceipt | null =
    //   await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT);

    // if (!receipt || receipt.status !== 1) {
    //   throw new Error(`Transaction failed: ${txHash}`);
    // }
    if (typeof txHash === "string" && txHash.startsWith("0x")) {
      const receipt: TransactionReceipt | null =
        await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT); // Wait for the transaction to be mined
      if (!receipt || receipt.status !== 1) {
        throw new Error(`Transaction failed: ${txHash}`);
      }
    }
    console.log(`Encryption key added to identifier: ${did}`, key);
    return true;
  } catch (error) {
    console.error("Error adding encryption key:", error);
    return false;
  }
}

/**
 * Adds a service to a DID
 */
export async function addService(
  did: string,
  service: { type: string; serviceEndpoint: string; description?: string },
  validFor: number
): Promise<string> {
  const txHash = await agent.didManagerAddService({
    did,
    service: {
      id: `${did}#${service.type}`,
      type: service.type,
      serviceEndpoint: service.serviceEndpoint,
      description: service.description,
    },
    options: { ttl: validFor ?? 86400 * 2 },
  });

  const receipt: TransactionReceipt | null =
    await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed: ${txHash}`);
  }

  console.log("Service added, txHash:", txHash);
  return txHash;
}

/**
 * Removes a service from a DID
 */
export async function removeService(
  did: string,
  serviceId: string
): Promise<string> {
  const txHash = await agent.didManagerRemoveService({ did, id: serviceId });

  const receipt: TransactionReceipt | null =
    await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed: ${txHash}`);
  }

  console.log("Service removed, txHash:", txHash);
  return txHash;
}
