import { TransactionReceipt } from 'ethers';
import { SCHEMA_REGISTRY_CONTRACT } from '../src/contractReferences.js';
import {
  connectToContract,
  getEthAddress,
  readContract,
} from '../src/utils.js';
import { TSchema } from 'types.js';

/**
 * Register a schema on-chain with default requiresPhysicalVerification = false
 */
export async function registerSchema(
  did: string,
  schema: TSchema,
): Promise<TransactionReceipt> {
  const contract = SCHEMA_REGISTRY_CONTRACT;
  const functionName = 'registerSchema';
  const functionArgs = [schema.schemaName, JSON.stringify(schema.schemaFields)];
  const value = 0;
  const chainId = 11155111;

  const transaction = await connectToContract(
    did,
    contract,
    functionName,
    functionArgs,
    value,
    chainId,
  );

  if (!transaction) {
    throw new Error(`Transaction Failed`);
  }
  return transaction;
}

/**
 * Register a schema with explicit requiresPhysicalVerification flag
 */
export async function registerSchemaWithFlag(
  did: string,
  schema: TSchema,
  requiresPhysicalVerification: boolean,
): Promise<TransactionReceipt> {
  const contract = SCHEMA_REGISTRY_CONTRACT;
  const functionName = 'registerSchemaWithFlag';
  const functionArgs = [
    schema.schemaName,
    JSON.stringify(schema.schemaFields),
    requiresPhysicalVerification,
  ];
  const value = 0;
  const chainId = 11155111;

  const transaction = await connectToContract(
    did,
    contract,
    functionName,
    functionArgs,
    value,
    chainId,
  );

  if (!transaction) {
    throw new Error(`Transaction Failed`);
  }
  return transaction;
}

/**
 * Remove schema by name
 */
export async function removeSchema(
  did: string,
  schemaName: string,
): Promise<TransactionReceipt> {
  const contract = SCHEMA_REGISTRY_CONTRACT;
  const functionName = 'removeSchema';
  const functionArgs = [schemaName];
  const value = 0;
  const chainId = 11155111;

  const transaction = await connectToContract(
    did,
    contract,
    functionName,
    functionArgs,
    value,
    chainId,
  );

  if (!transaction) {
    throw new Error(`Transaction Failed`);
  }
  return transaction;
}

/**
 * Get full schema struct by issuer + schemaName
 */
export async function getSchema(
  issuerDid: string,
  schemaName: string,
): Promise<object> {
  const contract = SCHEMA_REGISTRY_CONTRACT;
  const issuerAddress = await getEthAddress(issuerDid);
  const result = await readContract(contract, 'getSchema', [
    issuerAddress,
    schemaName,
  ]);

  if (result && typeof result === 'object') {
    return {
      schemaName: result.schemaName,
      schemaFields: JSON.parse(result.schema),
      requiresPhysicalVerification: result.requiresPhysicalVerification,
    } as TSchema;
  } else {
    console.warn('Schema not found or invalid result:', result);
    return {};
  }
}

/**
 * Get all schema names (as strings) registered by a DID
 */
export async function getSchemaNames(issuerDid: string): Promise<string[]> {
  const contract = SCHEMA_REGISTRY_CONTRACT;
  const issuerAddress = await getEthAddress(issuerDid);
  const result = await readContract(contract, 'getSchemaTypes', [
    issuerAddress,
  ]);
  return result || [];
}
