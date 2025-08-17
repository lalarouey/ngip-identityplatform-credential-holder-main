import { DIDDocument, IKey } from '@veramo/core';
import 'dotenv/config';
import { ethers, TransactionReceipt } from 'ethers';
import { TContract } from '../src/contractReferences.js';
import {
  addEncryptionKey,
  addService,
  removeService,
} from '../src/identifiers.js';
import { agent } from '../src/server/server.js';
import { ethSepoliaProvider } from '../src/veramo/providers.js';
import { HOLDER_AGENT_URL, TX_TIMEOUT } from './config.js';
import { cache } from './veramo/resolver.js';

export async function initializeDID(did: string) {
  if (!HOLDER_AGENT_URL) {
    throw new Error('HOLDER_AGENT_URL is not defined');
  }
  async function ensureService(
    did: string,
    type: string,
    endpoint: string,
    description: string,
  ) {
    const doc = await resolveDIDDocument(did);
    const hasService = doc.service?.some(s => s.type === type);
    if (!hasService) {
      await addService(
        did,
        { type, serviceEndpoint: endpoint, description },
        86400 * 30,
      );
    }
  }
  const didDoc = await resolveDIDDocument(did);
  const hasX25519 = didDoc.verificationMethod?.some(
    vm => vm.type === 'X25519KeyAgreementKey2019',
  );
  if (!hasX25519) {
    await addEncryptionKey(did, 'X25519', 86400 * 30);
  }

  await ensureService(
    did,
    'receiveCredential',
    `${HOLDER_AGENT_URL}/receive-credential`,
    'Receive credentials via DIDComm',
  );

  await ensureService(
    did,
    'verifyOwnership',
    `${HOLDER_AGENT_URL}/verify-ownership`,
    'Verify ownership of the DID',
  );

  await ensureService(
    did,
    'serviceResponse',
    `${HOLDER_AGENT_URL}/service-response`,
    'Response for service via DIDComm',
  );
  console.log(`DID ${did} initialized with services and keys.`);

  cache.delete(did);
}

export async function clearDID(did: string) {
  try {
    const localDID = await agent.didManagerGet({ did });

    // Remove all encryption keys of type 'X25519'
    const encryptionKeys = localDID.keys?.filter(key => key.type === 'X25519');
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

export async function resolveDIDDocument(did: string): Promise<DIDDocument> {
  const didDoc = await agent.resolveDid({ didUrl: did });
  if (!didDoc) {
    throw new Error('DID not found');
  } else {
    if (!didDoc.didDocument) {
      throw new Error('DID document not found');
    }
    return didDoc.didDocument;
  }
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
  recipient: string,
): Promise<TransactionReceipt | null> {
  try {
    // Retrieve the DID document
    const localDID = await agent.didManagerGet({ did });
    if (!localDID) throw new Error('DID not found in local database');

    // Check if the DID document has a valid verification method
    const kid = localDID.keys.find(key => key.type === 'Secp256k1')?.kid;
    if (!kid) {
      throw new Error('No Secp256k1 key found for the DID');
    }

    // Extract Ethereum address
    const ethAddress = await getEthAddress(did);

    // Connect to Ethereum Network
    const provider = ethSepoliaProvider;

    // Get account balance
    const balance = await provider.getBalance(ethAddress);
    console.log(`Current Balance: ${ethers.formatEther(balance)} ETH`);

    // Ensure there's enough ETH to cover gas fees
    if (balance <= ethers.parseEther('0.001')) {
      throw new Error('Insufficient balance to cover transaction fees');
    }

    // Estimate Gas
    const gasPrice =
      (await provider.getFeeData()).maxFeePerGas ??
      ethers.parseUnits('10', 'gwei');
    const gasLimit = 21000n; // Standard gas for ETH transfer

    // Calculate max amount to send (balance - gas fees)
    const totalGasCost = gasPrice * BigInt(gasLimit ?? 21000);
    const amountToSend = balance - totalGasCost;

    if (amountToSend <= 0n) {
      throw new Error('Not enough ETH after gas fees.');
    }

    console.log(`Sending ${ethers.formatEther(amountToSend)} ETH`);

    // Create Transaction
    const unsignedTx = {
      to: recipient,
      value: amountToSend,
      data: '0x',
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
    console.log('Transaction sent:', txResponse.hash);

    const txReceipt = await txResponse.wait(1, TX_TIMEOUT);

    return txReceipt;
  } catch (error: any) {
    console.log(error);
    const message =
      error?.reason ||
      error?.error?.message ||
      error?.message ||
      'Unknown blockchain error';

    throw new Error(`${message}`);
  }
}

export async function getEthAddress(did: string) {
  const ethAddress = await resolveDIDDocument(did).then(did => {
    if (!did.verificationMethod) {
      throw new Error('Verification method is undefined');
    }
    return did.verificationMethod[0].blockchainAccountId?.split(':')[2];
  });
  if (!ethAddress)
    throw new Error('Could not extract Ethereum address from DID');
  return ethAddress;
}
/**
 * Get the encrypted key from a DID document.
 * @param did - The DID of the identifier
 * @returns The encrypted key if found, otherwise throws an error
 * @example
 * const encryptedKey = await getEncryptedKeyFromDID("did:ethr:sepolia:0x123abc");
 */
export async function getEncryptedKeyFromDID(did: string): Promise<IKey> {
  const keys = await getIdentifierKeys(did);
  if (!keys) {
    throw new Error('Failed to get keys from DID');
  }

  const key = keys.find(key => key.type === 'X25519');
  if (!key) {
    throw new Error('Failed to find X25519 key');
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
  chainId: number = 11155111,
): Promise<TransactionReceipt | null> {
  try {
    // Check if senderDID is managed by the agent
    const localDID = await agent.didManagerGet({ did: senderDID });
    if (!localDID) throw new Error('DID not found in local database');

    // Check if the DID document has a valid verification method
    const kid = localDID.keys.find(key => key.type === 'Secp256k1')?.kid;
    if (!kid) {
      throw new Error('No Secp256k1 key found for the DID');
    }

    const ethAddress = await getEthAddress(senderDID);
    const provider = ethSepoliaProvider;

    await logBalance(provider, ethAddress);

    const { data, recipient } = encodeContractCall(
      contract,
      functionName,
      functionArgs,
    );
    const txValue = BigInt(value);
    // Estimate Gas needed for the transaction
    const { maxFeePerGas, maxPriorityFeePerGas, txGasLimit, totalCost } =
      await estimateTransactionCost(
        provider,
        ethAddress,
        recipient,
        data,
        txValue,
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
      chainId,
    );

    // Sign the transaction using Veramo
    const signedTx = await agent.keyManagerSignEthTX({
      kid,
      transaction: unsignedTx,
    });

    // Broadcast the transaction
    const txResponse = await provider.broadcastTransaction(signedTx);

    console.log('Transaction sent:', txResponse.hash);

    const startTime = Date.now();
    // After 12 confirmations, the transaction is considered absolutely final but is set to 1 for testing
    const txReceipt = await txResponse.wait(1, TX_TIMEOUT);
    const elapsedTime = Date.now() - startTime;
    console.log(
      `Transaction confirmed in ${elapsedTime / 1000} seconds. Block number: ${
        txReceipt?.blockNumber
      }`,
    );

    console.log(
      `Actual Gas Used: ${txReceipt?.gasUsed.toString()} / Estimated Gas Limit: ${txGasLimit.toString()} (${(
        (Number(txReceipt?.gasUsed) / Number(txGasLimit)) *
        100
      ).toFixed(2)}%)`,
    );
    console.log(
      `Actual Cost: ${ethers.formatEther(
        txReceipt?.fee ?? 0n,
      )} ETH / Estimated Max Cost: ${ethers.formatEther(totalCost)} ETH`,
    );

    return txReceipt;
  } catch (error: any) {
    console.log(error);
    const message =
      error?.reason ||
      error?.error?.message ||
      error?.message ||
      'Unknown blockchain error';

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
  functionArgs: any,
) {
  const provider = ethSepoliaProvider;
  const contractInstance = new ethers.Contract(
    contract.ADDRESS,
    contract.ABI,
    provider,
  );
  return await contractInstance[functionName](...functionArgs);
}

function encodeContractCall(
  contract: TContract,
  functionName: string,
  args: any[],
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
  value: bigint,
) {
  const feeData = await provider.getFeeData();

  const maxFeePerGas = feeData.maxFeePerGas ?? ethers.parseUnits('20', 'gwei');
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas ?? ethers.parseUnits('1.5', 'gwei');
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
  totalCost: bigint,
) {
  const balance = await provider.getBalance(address);
  if (balance < totalCost) {
    throw new Error(
      `Insufficient balance. Required: ${ethers.formatEther(
        totalCost,
      )} ETH, Available: ${ethers.formatEther(balance)} ETH`,
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
  chainId: number,
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
