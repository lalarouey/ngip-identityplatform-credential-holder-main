import { DIDDocument } from "@veramo/core";
import { IKey, TKeyType } from "@veramo/core-types";
import "dotenv/config";
import { ethers, TransactionReceipt } from "ethers";
import { TContract } from "../src/contractReferences.js";
import {
  addEncryptionKey,
  addService,
  removeService,
} from "../src/identifiers.js";
import { agent } from "../src/server/server.js";
import { ethSepoliaProvider } from "../src/veramo/providers.js";
import { HOLDER_AGENT_URL, TX_TIMEOUT } from "./config.js";
import { cache } from "./veramo/resolver.js";
import bs58 from "bs58";


/**
 * Initialize all known DIDs managed by the agent.
 */
export async function initializeAllDIDs() {
  const identifiers = await agent.didManagerFind();
  if (!identifiers.length) {
    console.warn("No DIDs found in the agent to initialize.");
    return;
  }
  console.log(`Found ${identifiers.length} DIDs to initialize...`);

  for (const identifier of identifiers) {
    try {
      console.log("Initializing DID: ", identifier.did);
      await initializeDID(identifier.did);
      console.log(`Initialized DID: ${identifier.did}`);
    } catch (error) {
      console.error(
        `Failed to initialize DID ${identifier.did}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  console.log("✨ All DIDs initialization complete.");
}

export async function initializeDID(did: string) {
  if (!HOLDER_AGENT_URL) {
    throw new Error("HOLDER_AGENT_URL is not defined");
  }
  async function ensureService(
    did: string,
    type: string,
    endpoint: string,
    description: string
  ) {
    try {
      const doc = await resolveDIDDocument(did);
      const hasService = doc.service?.some((s) => s.type === type);
      if (!hasService) {
        await addService(
          did,
          { type, serviceEndpoint: endpoint, description },
          86400 * 30
        );
      }
    } catch (error) {
      console.log("Error ensuring service: ", error);
    }
  }
  const didDoc = await resolveDIDDocument(did);
  const hasX25519 = didDoc.verificationMethod?.some(
    (vm) => vm.type === "X25519KeyAgreementKey2019"
  );
  if (!hasX25519) {
    await addEncryptionKey(did, "X25519", 86400 * 30);
  }

  await ensureService(
    did,
    "DIDCommMessaging",
    `${HOLDER_AGENT_URL}/didcomm`,
    "Default DIDComm Messaging endpoint"
  );

  await ensureService(
    did,
    "receiveCredential",
    `${HOLDER_AGENT_URL}/receive-credential`,
    "Receive credentials via DIDComm"
  );

  await ensureService(
    did,
    "verifyOwnership",
    `${HOLDER_AGENT_URL}/verify-ownership`,
    "Verify ownership of the DID"
  );

  await ensureService(
    did,
    "serviceResponse",
    `${HOLDER_AGENT_URL}/service-response`,
    "Response for service via DIDComm"
  );
  console.log(`DID ${did} initialized with services and keys.`);

  cache.delete(did);
}

export async function clearDID(did: string) {
  try {
    const localDID = await agent.didManagerGet({ did });

    // Remove all encryption keys of type 'X25519'
    const encryptionKeys = localDID.keys?.filter(
      (key) => key.type === "X25519"
    );
    if (encryptionKeys) {
      for (const key of encryptionKeys) {
        const txHash = await agent.didManagerRemoveKey({ did, kid: key.kid });
        const receipt: TransactionReceipt | null =
          await ethSepoliaProvider.waitForTransaction(txHash, 1, TX_TIMEOUT); // Wait for the transaction to be mined
        if (!receipt || receipt.status !== 1) {
          throw new Error(`Transaction failed: ${txHash}`);
        }
        console.log(`Encryption key removed, txHash: ${txHash}`);
      }
    }

    // Remove all services
    const services = localDID.services || [];
    for (const service of services) {
      await removeService(did, service.id);
    }
    console.log(`All services and keys removed for DID ${did}`);
  } catch (error) {
    console.error(`Failed to clear DID ${did}:`, error);
    throw error;
  } finally {
    // Ensure cache is cleared even if an error occurs
    cache.delete(did);
  }
}

/**
 * Resolve a DID document.
 * @param did - The DID of the identifier
 * @returns The resolved DID document
 * @throws Error if the DID document is not found
 */
export async function resolveDIDDocument(did: string): Promise<DIDDocument> {
  const { didDocument } = await agent.resolveDid({ didUrl: did });
  if (!didDocument) throw new Error("DID document not found");
  return didDocument;
}

export async function getIdentifierKeys(did: string): Promise<IKey[]> {
  const didDocument = await agent.didManagerGet({ did });
  return didDocument.keys;
}

/**
 * Transfer funds from a DID to a recipient address
 * @param did - The DID of the identifier to transfer funds from
 * @param recipient - The recipient address to transfer funds to
 * @throws Error if the DID is not found, or if the balance is insufficient
 * @returns The transaction hash if successful, null otherwise
 * @example
 * const txHash = await transferFunds("did:ethr:sepolia:0x123abc");
 */
export async function transferFunds(
  did: string,
  recipient: string
): Promise<TransactionReceipt | null> {
  try {
    // Retrieve the DID document
    const localDID = await agent.didManagerGet({ did });
    if (!localDID) throw new Error("DID not found in local database");

    // Check if the DID document has a valid verification method
    const kid = localDID.keys.find((key) => key.type === "Secp256k1")?.kid;
    if (!kid) {
      throw new Error("No Secp256k1 key found for the DID");
    }

    // Extract Ethereum address
    const ethAddress = await getEthAddress(did);

    // Connect to Ethereum Network
    const provider = ethSepoliaProvider;

    // Get account balance
    const balance = await provider.getBalance(ethAddress);
    console.log(`Current Balance: ${ethers.formatEther(balance)} ETH`);

    // Ensure there's enough ETH to cover gas fees
    if (balance <= ethers.parseEther("0.001")) {
      throw new Error("Insufficient balance to cover transaction fees");
    }

    // Estimate Gas
    const gasPrice =
      (await provider.getFeeData()).maxFeePerGas ??
      ethers.parseUnits("10", "gwei");
    const gasLimit = 21000n; // Standard gas for ETH transfer

    // Calculate max amount to send (balance - gas fees)
    const totalGasCost = gasPrice * BigInt(gasLimit ?? 21000);
    const amountToSend = balance - totalGasCost;

    if (amountToSend <= 0n) {
      throw new Error("Not enough ETH after gas fees.");
    }

    console.log(`Sending ${ethers.formatEther(amountToSend)} ETH`);

    // Create Transaction
    const unsignedTx = {
      to: recipient,
      value: amountToSend,
      data: "0x",
      gasLimit: gasLimit,
      gasPrice: gasPrice,
      nonce: await provider.getTransactionCount(ethAddress),
      chainId: 11155111, // Sepolia Testnet
    };

    // Sign Transaction using Veramo
    const signedTx = await agent.keyManagerSignEthTX({
      kid,
      transaction: unsignedTx,
    });

    // Broadcast Transaction
    const txResponse = await provider.broadcastTransaction(signedTx);
    console.log("Transaction sent:", txResponse.hash);

    const txReceipt = await txResponse.wait(1, TX_TIMEOUT);

    return txReceipt;
  } catch (error: any) {
    console.log(error);
    const message =
      error?.reason ||
      error?.error?.message ||
      error?.message ||
      "Unknown blockchain error";

    throw new Error(`${message}`);
  }
}

// export async function getEthAddress(did: string) {
//   const ethAddress = await resolveDIDDocument(did).then((did) => {
//     if (!did.verificationMethod) {
//       throw new Error("Verification method is undefined");
//     }
//     return did.verificationMethod[0].blockchainAccountId?.split(":")[2];
//   });
//   if (!ethAddress)
//     throw new Error("Could not extract Ethereum address from DID");
//   return ethAddress;
// }

export async function getEthAddress(did: string): Promise<string> {
  const doc = await resolveDIDDocument(did);
  const method = doc.verificationMethod?.find(
    (vm) => vm.type === "EcdsaSecp256k1RecoveryMethod2020"
  );
  const ethAddress = method?.blockchainAccountId?.split(":")[2];
  if (!ethAddress) throw new Error("Ethereum address not found in DID");
  return ethAddress;
}

// /**
//  * Get the encrypted key from a DID document.
//  * @param did - The DID of the identifier
//  * @returns The encrypted key if found, otherwise throws an error
//  * @example
//  * const encryptedKey = await getEncryptedKeyFromDID("did:ethr:sepolia:0x123abc");
//  */
// export async function getEncryptedKeyFromDID(did: string): Promise<IKey> {
//   const keys = await getIdentifierKeys(did);
//   if (!keys) {
//     throw new Error('Failed to get keys from DID');
//   }

//   const key = keys.find(key => key.type === 'X25519');
//   if (!key) {
//     throw new Error('Failed to find X25519 key');
//   }
//   return key;
// }

/**
 * Minimal shape for a DID-resolved key (align to your actual IKey).
 */
// export interface IKey {
//   kid: string;
//   type: string; // e.g., 'X25519', 'X25519KeyAgreementKey2019', 'JsonWebKey2020', 'EcdhES256', etc.
//   publicKeyHex?: string;
//   publicKeyBase58?: string;
//   publicKeyJwk?: {
//     kty?: string;
//     crv?: string;
//     x?: string; // base64url
//     [k: string]: any;
//   };
//   meta?: Record<string, any>;
// }

/**
 * Type guard: is this key X25519?
 */
function isX25519Key(key: IKey): boolean {
  const t = (key.type || "").toLowerCase();

  if (t.includes("x25519")) return true; // e.g. X25519KeyAgreementKey2019

  // Check if it’s a JWK with X25519
  if (t === "jsonwebkey2020" && "publicKeyJwk" in key) {
    const jwk = (key as any).publicKeyJwk;
    if (jwk?.kty === "OKP" && jwk?.crv === "X25519") return true;
  }

  return false;
}

/**
 * Optional: allow P-256 fallback only if your crypto layer supports it.
 * Note: keep return type `IKey`, don’t force `"P-256"` into TKeyType.
 */
function isP256KeyAgreement(key: IKey): boolean {
  if (key.type?.toLowerCase() === "jsonwebkey2020" && "publicKeyJwk" in key) {
    const jwk = (key as any).publicKeyJwk;
    return jwk?.kty === "EC" && jwk?.crv === "P-256";
  }
  return false;
}

// export async function getEncryptedKeyFromDID(
//   did: string,
//   opts: { acceptFallbackP256?: boolean } = {}
// ): Promise<IKey> {
//   const keys = await getIdentifierKeys(did);
//   if (!keys || keys.length === 0) {
//     throw new Error(`Failed to get keys from DID: ${did}`);
//   }

//   // 1. Try X25519
//   const xKey = keys.find(isX25519Key);
//   if (xKey) return xKey;

//   // 2. Optional fallback to P-256
//   if (opts.acceptFallbackP256) {
//     const p256 = keys.find(isP256KeyAgreement);
//     if (p256) return p256;
//   }

//   // 3. Nothing found
//   const available = keys.map(k => k.type).join(', ') || 'none';
//   throw new Error(
//     `No usable key found for DID ${did}. Available types: ${available}. ` +
//     `Ensure the DID Document has a keyAgreement entry with X25519KeyAgreementKey2020 or JsonWebKey2020 (crv: X25519).`
//   );
// }

export async function getEncryptedKeyFromDID2(did: string) {
  const didDoc = await agent.resolveDid({ didUrl: did });
  if (!didDoc.didDocument) {
    throw new Error(`Could not resolve DID: ${did}`);
  }

  const keyAgreement = didDoc.didDocument.keyAgreement || [];
  // for (const ka of keyAgreement) {
  //   const keyId = typeof ka === "string" ? ka : ka.id;
  //   const vm = didDoc.didDocument.verificationMethod?.find(
  //     (vm) => vm.id === keyId
  //   );

  //   if (vm?.publicKeyJwk && vm.publicKeyJwk.crv === "X25519") {
  //     // Convert JWK to hex
  //     const x = vm.publicKeyJwk.x;
  //     if (!x) {
  //       throw new Error("Missing 'x' parameter in publicKeyJwk for X25519");
  //     }

  //     const publicKeyHex = Buffer.from(
  //       Uint8Array.from(atob(x), (c) => c.charCodeAt(0))
  //     ).toString("hex");

  //     return {
  //       kid: vm.id,
  //       type: "X25519" as const, // ensures it matches TKeyType
  //       publicKeyHex,
  //       meta: {
  //         jwk: vm.publicKeyJwk,
  //       },
  //     };
  //   }
  // }
  for (const ka of keyAgreement) {
    const keyId = typeof ka === "string" ? ka : ka.id;
    const vm = didDoc.didDocument.verificationMethod?.find(
      (vm) => vm.id === keyId
    );

    if (!vm) continue;

    // Case 1: X25519 as JWK
    if (vm.publicKeyJwk && vm.publicKeyJwk.crv === "X25519") {
      const x = vm.publicKeyJwk.x;
      if (!x) throw new Error("Missing 'x' in JWK for X25519");
      const publicKeyHex = Buffer.from(
        Uint8Array.from(atob(x), (c) => c.charCodeAt(0))
      ).toString("hex");

      return {
        kid: vm.id,
        type: "X25519" as const,
        publicKeyHex,
        meta: { jwk: vm.publicKeyJwk },
      };
    }

    // Case 2: X25519 as Base58
    if (vm.type === "X25519KeyAgreementKey2019" && vm.publicKeyBase58) {
      const publicKeyHex = Buffer.from(
        bs58.decode(vm.publicKeyBase58)
      ).toString("hex");

      return {
        kid: vm.id,
        type: "X25519" as const,
        publicKeyHex,
        meta: { base58: vm.publicKeyBase58 },
      };
    }
  }

  throw new Error(`No X25519 key found in DID Document for ${did}`);
}

export async function getEncryptedKeyFromDID(
  did: string,
  opts: { acceptFallbackP256?: boolean; acceptSecp256k1?: boolean } = {}
): Promise<IKey> {
  const keys = await getIdentifierKeys(did);
  if (!keys || keys.length === 0) {
    throw new Error(`Failed to get keys from DID: ${did}`);
  }

  const xKey = keys.find(isX25519Key);
  if (xKey) return xKey;

  if (opts.acceptFallbackP256) {
    const p256 = keys.find(isP256KeyAgreement);
    if (p256) return p256;
  }

  if (opts.acceptSecp256k1) {
    const secp = keys.find((k) => k.type === "Secp256k1");
    if (secp) return secp;
  }

  const available = keys.map((k) => k.type).join(", ") || "none";
  throw new Error(
    `No usable key found for DID ${did}. Available types: ${available}. ` +
      `Ensure the DID Document has a keyAgreement entry with X25519KeyAgreementKey2020 or JsonWebKey2020 (crv: X25519).`
  );
}

/**
 * Normalize the key’s shape for downstream crypto code.
 * (You can expand this to always set publicKeyBytes, etc.)
 */
function normalizeKeyShape(key: IKey): IKey {
  // If you need a canonical 'type' for downstream, normalize here:
  if (isX25519Key(key)) {
    return { ...key, type: "X25519" as TKeyType };
  }
  if (isP256KeyAgreement(key)) {
    return { ...key, type: "P-256" as TKeyType };
  }
  return key;
}

/**
 * Connect to a smart contract and call a function.
 * @param senderDID - The DID of the sender.
 * @param contract - The contract to connect to.
 * @param functionName - The name of the function to call.
 * @param functionArgs - The arguments to pass to the function.
 * @param value - The amount of ETH to send with the transaction (default: 0).
 * @param chainId - The chain ID of the network (default: 11155111 for Sepolia).
 * @returns The transaction response if successful, otherwise throws an error.
 * @example
 * const txResponse = await connectToContract(
 *   "did:ethr:sepolia:0x123abc",
 *   contract,
 *   "register",
 *   ["0x456def", "Alice"],
 *   0,
 *   11155111,
 *   300000
 * );
 */
export async function connectToContract(
  senderDID: string,
  contract: TContract,
  functionName: string,
  functionArgs: any[],
  value: number = 0,
  chainId: number = 11155111
): Promise<TransactionReceipt | null> {
  try {
    // Check if senderDID is managed by the agent
    const localDID = await agent.didManagerGet({ did: senderDID });
    if (!localDID) throw new Error("DID not found in local database");

    // Check if the DID document has a valid verification method
    const kid = localDID.keys.find((key) => key.type === "Secp256k1")?.kid;
    if (!kid) {
      throw new Error("No Secp256k1 key found for the DID");
    }

    const ethAddress = await getEthAddress(senderDID);
    const provider = ethSepoliaProvider;

    await logBalance(provider, ethAddress);

    const { data, recipient } = encodeContractCall(
      contract,
      functionName,
      functionArgs
    );
    const txValue = BigInt(value);
    // Estimate Gas needed for the transaction
    const { maxFeePerGas, maxPriorityFeePerGas, txGasLimit, totalCost } =
      await estimateTransactionCost(
        provider,
        ethAddress,
        recipient,
        data,
        txValue
      );

    // Check if the sender has enough balance to cover the transaction
    await assertSufficientBalance(provider, ethAddress, totalCost);

    const unsignedTx = await buildTransaction(
      ethAddress,
      recipient,
      data,
      txValue,
      txGasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      provider,
      chainId
    );

    // Sign the transaction using Veramo
    const signedTx = await agent.keyManagerSignEthTX({
      kid,
      transaction: unsignedTx,
    });

    // Broadcast the transaction
    const txResponse = await provider.broadcastTransaction(signedTx);

    console.log("Transaction sent:", txResponse.hash);

    const startTime = Date.now();
    // After 12 confirmations, the transaction is considered absolutely final but is set to 1 for testing
    const txReceipt = await txResponse.wait(1, TX_TIMEOUT);
    const elapsedTime = Date.now() - startTime;
    console.log(
      `Transaction confirmed in ${elapsedTime / 1000} seconds. Block number: ${
        txReceipt?.blockNumber
      }`
    );

    console.log(
      `Actual Gas Used: ${txReceipt?.gasUsed.toString()} / Estimated Gas Limit: ${txGasLimit.toString()} (${(
        (Number(txReceipt?.gasUsed) / Number(txGasLimit)) *
        100
      ).toFixed(2)}%)`
    );
    console.log(
      `Actual Cost: ${ethers.formatEther(
        txReceipt?.fee ?? 0n
      )} ETH / Estimated Max Cost: ${ethers.formatEther(totalCost)} ETH`
    );

    return txReceipt;
  } catch (error: any) {
    console.log(error);
    const message =
      error?.reason ||
      error?.error?.message ||
      error?.message ||
      "Unknown blockchain error";

    throw new Error(`${message}`);
  }
}

/**
 * Read a value from a smart contract
 * @param contract - The contract to connect to
 * @param functionName - The name of the function to call
 * @param functionArgs - The arguments to pass to the function
 * @example
 * await readContract(
 * contract,
 * "getBalance",
 * ["0x123abc"]
 * );
 */
export async function readContract(
  contract: TContract,
  functionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  functionArgs: any
) {
  const provider = ethSepoliaProvider;
  const contractInstance = new ethers.Contract(
    contract.ADDRESS,
    contract.ABI,
    provider
  );
  return await contractInstance[functionName](...functionArgs);
}

function encodeContractCall(
  contract: TContract,
  functionName: string,
  args: any[]
) {
  const iface = new ethers.Interface(contract.ABI);
  const data = iface.encodeFunctionData(functionName, args);
  return { data, recipient: contract.ADDRESS };
}

async function estimateTransactionCost(
  provider: ethers.Provider,
  from: string,
  to: string,
  data: string,
  value: bigint
) {
  const feeData = await provider.getFeeData();

  const maxFeePerGas = feeData.maxFeePerGas ?? ethers.parseUnits("20", "gwei");
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas ?? ethers.parseUnits("1.5", "gwei");
  const estimatedGas = await provider.estimateGas({ to, value, data, from });
  // Buffer and cap
  const bufferPercent = 120;
  const bufferedGas = (estimatedGas * BigInt(bufferPercent)) / BigInt(100);
  const txGasLimit = bufferedGas;

  const totalGasCost = maxFeePerGas * txGasLimit;
  const totalCost = value + totalGasCost;

  console.log(`Estimated Gas Cost: ${ethers.formatEther(totalGasCost)} ETH`);

  return { maxFeePerGas, maxPriorityFeePerGas, txGasLimit, totalCost };
}

async function assertSufficientBalance(
  provider: ethers.Provider,
  address: string,
  totalCost: bigint
) {
  const balance = await provider.getBalance(address);
  if (balance < totalCost) {
    throw new Error(
      `Insufficient balance. Required: ${ethers.formatEther(
        totalCost
      )} ETH, Available: ${ethers.formatEther(balance)} ETH`
    );
  }
}

async function buildTransaction(
  from: string,
  to: string,
  data: string,
  value: bigint,
  gasLimit: bigint,
  maxFeePerGas: bigint,
  maxPriorityFeePerGas: bigint,
  provider: ethers.Provider,
  chainId: number
) {
  return {
    to,
    value,
    data,
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce: await provider.getTransactionCount(from),
    chainId,
  };
}

async function logBalance(provider: ethers.Provider, address: string) {
  const balance = await provider.getBalance(address);
  console.log(`Current Balance: ${ethers.formatEther(balance)} ETH`);
}
