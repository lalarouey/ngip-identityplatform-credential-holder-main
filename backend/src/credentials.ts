import {
  CredentialSubject,
  IVerifyResult,
  VerifiableCredential,
} from '@veramo/core';
import { ethers, TransactionReceipt } from 'ethers';
import { CREDENTIAL_REVOCATION_REGISTRY_CONTRACT } from '../src/contractReferences.js';
import { agent } from '../src/server/server.js';
import {
  connectToContract,
  getEthAddress,
  readContract,
} from '../src/utils.js';
import { CHAIN_ID } from './config.js';

/**
 * Issue a verifiable credential to a holder DID
 * @param holderDIDUrl DID URL of the holder
 * @param values Values to be included in the credential
 * @param TimeToLive Time to live in seconds
 * @param schemaName Type of schema to be used (optional)
 * @throws Error if the transaction fails or if the holder DID document is null
 * @returns The created credential and transaction response
 */
export async function issueCredential(
  holderDIDUrl: string,
  values: CredentialSubject | undefined,
  TimeToLive: number,
  schemaName?: string,
): Promise<{
  credential: VerifiableCredential;
  txResponse: TransactionReceipt;
}> {
  const IssuerDID = await agent.didManagerGetByAlias({ alias: 'default' });
  const holderDIDDoc = await agent.resolveDid({ didUrl: holderDIDUrl });
  const holderDID = holderDIDDoc.didDocument;
  if (!holderDID) {
    throw new Error('Holder DID document is null');
  }

  const issuanceDate = new Date().toISOString();
  const expirationTimestamp = Math.floor(Date.now() / 1000) + TimeToLive;
  const expirationDate = new Date(expirationTimestamp * 1000).toISOString();

  const credential = await agent.createVerifiableCredential({
    credential: {
      id: `urn:uuid:${crypto.randomUUID()}`,
      ttl: TimeToLive,
      expirationDate,
      issuer: { id: IssuerDID.did },
      credentialSubject: { id: holderDID.id, ...values },
      type: schemaName
        ? ['VerifiableCredential', schemaName]
        : ['VerifiableCredential'],
      issuanceDate,
    },
    proofFormat: 'jwt',
  });

  const publish = await connectToContract(
    IssuerDID.did,
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'issueCredential',
    [await getEthAddress(holderDID.id), credential.id, expirationTimestamp],
    0,
    CHAIN_ID,
  );

  if (!publish) {
    throw new Error('Transaction failed');
  }

  return { credential, txResponse: publish };
}

export async function issueCredentialWithSignature(
  holderDIDUrl: string,
  values: CredentialSubject | undefined,
  TimeToLive: number,
): Promise<{
  credential: VerifiableCredential;
  txResponse: TransactionReceipt;
}> {
  console.log(`Resolving issuer DID...`);
  const holderDID = await agent.didManagerGet({ did: holderDIDUrl });

  const date = new Date();
  const expirationDate = new Date(
    date.getTime() + TimeToLive * 1000,
  ).toISOString();
  const issuanceDate = date.toISOString();
  const credentialId = `urn:uuid:${crypto.randomUUID()}`;
  const credential = await agent.createVerifiableCredential({
    credential: {
      id: credentialId,
      ttl: TimeToLive,
      expirationDate,
      issuanceDate,
      issuer: { id: holderDID.did },
      credentialSubject: {
        id: holderDID.did,
        ...values,
      },
      type: ['VerifiableCredential'],
    },
    proofFormat: 'jwt',
  });

  const holderEthAddress = await getEthAddress(holderDID.did);
  const nonce = await readContract(
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'getNonce',
    [holderEthAddress],
  );

  const hash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'address', 'string', 'uint256', 'string'],
    [
      CREDENTIAL_REVOCATION_REGISTRY_CONTRACT.ADDRESS,
      nonce,
      holderEthAddress,
      credentialId,
      new Date(expirationDate).getTime(),
      'ISSUE',
    ],
  );

  const signedHash = await agent.keyManagerSign({
    keyRef: holderDID.keys[0].kid,
    data: hash,
    algorithm: 'eth_signMessage',
    encoding: 'hex',
  });

  const signature = ethers.Signature.from(signedHash);

  const tx = await connectToContract(
    holderDID.did,
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'issueCredentialWithSignature',
    [
      holderEthAddress,
      credentialId,
      new Date(expirationDate).getTime(),
      nonce,
      signature.v,
      signature.r,
      signature.s,
    ],
    0,
    CHAIN_ID,
  );

  if (!tx) throw new Error('Transaction failed');

  return { credential, txResponse: tx };
}

/**
 * Issue a delegation credential (Patient issues to Doctor)
 */
export async function issueDelegationCredential(
  issuerDIDUrl: string, // Patient
  subjectDIDUrl: string, // Doctor
  values: CredentialSubject | undefined,
  TimeToLive: number,
): Promise<{
  credential: VerifiableCredential;
  txResponse: TransactionReceipt;
}> {
  console.log(`Resolving issuer DID...`);
  const issuerDID = await agent.didManagerGet({ did: issuerDIDUrl });

  const date = new Date();
  const expirationDate = new Date(
    date.getTime() + TimeToLive * 1000,
  ).toISOString();
  const issuanceDate = date.toISOString();
  const credentialId = `urn:uuid:${crypto.randomUUID()}`;
  const credential = await agent.createVerifiableCredential({
    credential: {
      id: credentialId,
      ttl: TimeToLive,
      expirationDate,
      issuanceDate,
      issuer: { id: issuerDID.did },
      credentialSubject: {
        id: subjectDIDUrl,
        ...values,
      },
      type: ['VerifiableCredential', 'DelegatedAccessCredential'],
    },
    proofFormat: 'jwt',
  });

  const issuerEthAddress = await getEthAddress(issuerDID.did);
  const subjectEthAddress = await getEthAddress(subjectDIDUrl);

  const nonce = await readContract(
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'getNonce',
    [issuerEthAddress],
  );

  const hash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'address', 'string', 'uint256', 'string'],
    [
      CREDENTIAL_REVOCATION_REGISTRY_CONTRACT.ADDRESS,
      nonce,
      subjectEthAddress, // Holder/Subject
      credentialId,
      new Date(expirationDate).getTime(),
      'ISSUE',
    ],
  );

  const signedHash = await agent.keyManagerSign({
    keyRef: issuerDID.keys[0].kid,
    data: hash,
    algorithm: 'eth_signMessage',
    encoding: 'hex',
  });

  const signature = ethers.Signature.from(signedHash);

  const tx = await connectToContract(
    issuerDID.did,
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'issueCredentialWithSignature',
    [
      subjectEthAddress,
      credentialId,
      new Date(expirationDate).getTime(),
      nonce,
      signature.v,
      signature.r,
      signature.s,
    ],
    0,
    CHAIN_ID,
  );

  if (!tx) throw new Error('Transaction failed');

  return { credential, txResponse: tx };
}

/**
 * Issue a verifiable credential to a holder DID with a schema
 * @param holderDIDUrl DID URL of the holder
 * @param values Values to be included in the credential
 * @param schemaType Type of schema to be used
 * @param TimeToLive Time to live in seconds
 * @returns The issued credential
 * @throws Error if the holder DID is not found, if the input values are invalid, or if there is an error in issuing the credential
 * @example
 * const credential = await issueCredentialWithSchema('did:ethr:sepolia:0x123abc', { name: 'Alice', age: 25 }, 'ProfileCredential', 3600);
 */
export async function issueCredentialWithSchema(
  holderDIDUrl: string,
  values: CredentialSubject | undefined,
  schemaName: string,
  TimeToLive: number,
): Promise<{
  credential: VerifiableCredential;
  txResponse: TransactionReceipt;
}> {
  // Resolves issuer and holder DIDs
  console.log(`Resolving issuer DID...`);
  const holderDID = await agent.didManagerGet({ did: holderDIDUrl });

  // Creates credential with schema
  console.log(`Creating verifiable credential...`);
  const date = new Date();
  const expirationDate = new Date(
    date.getTime() + TimeToLive * 1000,
  ).toISOString(); // Calculate expiration date
  const issuanceDate = date.toISOString();
  const credential = await agent.createVerifiableCredential({
    credential: {
      id: `urn:uuid:${crypto.randomUUID()}`, // Credential ID
      ttl: TimeToLive, // Time to live in seconds
      expirationDate: expirationDate, // Expiration date
      issuer: { id: holderDID.did }, // Issuer DID
      credentialSubject: {
        id: holderDID.did, // Holder DID
        ...values,
      },
      type: ['VerifiableCredential', `${schemaName}`],
      issuanceDate: issuanceDate,
    },
    proofFormat: 'jwt',
  });

  // Publishes credential with schema
  const publish = await connectToContract(
    holderDID.did,
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'issueCredential',
    [
      await getEthAddress(holderDID.did),
      credential.id,
      new Date(expirationDate).getTime(),
    ],
    0,
    CHAIN_ID,
  );

  if (!publish) {
    throw new Error('Transaction failed');
  }
  return { credential: credential, txResponse: publish };
}

/**
 * Revoke a verifiable credential, costs gas
 * @param holderDIDUrl DID URL of the holder
 * @param credentialId ID of the credential to be revoked
 * @returns The transaction hash if successful, null otherwise
 * @throws Error if the credential ID is not found or if there is an error in revoking the credential
 * @example
 * const txHash = await revokeCredential('did:ethr:sepolia:0x123abc', 'urn:uuid:123456');
 */
export async function revokeCredential(
  holderDID: string,
  credentialId: string,
): Promise<TransactionReceipt | null> {
  const publish = await connectToContract(
    holderDID,
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'revokeCredential',
    [await getEthAddress(holderDID), credentialId],
    0,
    CHAIN_ID,
  );

  if (!publish) {
    throw new Error('Transaction failed');
  }

  return publish;
}

/**
 * Check if a credential has been revoked
 * @param credentialId ID of the credential
 * @returns True if the credential has been revoked, false otherwise
 * @throws Error if the credential ID is not found or if there is an error in checking the credential
 * @example
 * const isRevoked = await isCredentialRevoked('urn:uuid:123456');
 */
export async function isCredentialRevoked(
  credentialId: string,
): Promise<boolean> {
  const result = await readContract(
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'isRevoked',
    [credentialId],
  );

  return result;
}

export async function verifyCredential(
  credential: VerifiableCredential,
): Promise<boolean> {
  try {
    if (!credential.id) {
      throw new Error('Credential is null or undefined');
    }
    const jwtResult: IVerifyResult = await agent.verifyCredential({
      credential: credential,
    });
    const revocationStatus: boolean = await isCredentialRevoked(credential.id);
    return jwtResult.verified && !revocationStatus;
  } catch (error) {
    console.error('Error verifying credential:', error);
    throw error;
  }
}

/**
 * Revoke a verifiable credential using a signed message and nonce.
 * Costs gas.
 * @param holderDIDUrl DID URL of the holder (can be issuer or subject)
 * @param credentialId ID of the credential to be revoked
 * @returns The transaction receipt if successful
 * @throws Error if signature or transaction fails
 * @example
 * const tx = await revokeCredentialWithSignature('did:ethr:sepolia:0x123abc', 'urn:uuid:123456');
 */
export async function revokeCredentialWithSignature(
  holderDIDUrl: string,
  credentialId: string,
): Promise<TransactionReceipt | null> {
  const signerDID = await agent.didManagerGet({ did: holderDIDUrl });
  const holderAddress = await getEthAddress(holderDIDUrl);

  const nonce = await readContract(
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'getNonce',
    [holderAddress],
  );

  const hash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'address', 'string', 'string'],
    [
      CREDENTIAL_REVOCATION_REGISTRY_CONTRACT.ADDRESS,
      nonce,
      holderAddress,
      credentialId,
      'REVOKE',
    ],
  );

  const signedMessage = await agent.keyManagerSign({
    keyRef: signerDID.keys[0].kid,
    data: hash,
    algorithm: 'eth_signMessage',
    encoding: 'hex',
  });

  const signature = ethers.Signature.from(signedMessage);

  const tx = await connectToContract(
    signerDID.did,
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'revokeCredentialWithSignature',
    [holderAddress, credentialId, nonce, signature.v, signature.r, signature.s],
    0,
    CHAIN_ID,
  );

  if (!tx) throw new Error('Transaction failed');
  return tx;
}

/**
 * Revoke a delegation credential (Patient revokes Doctor's access)
 */
export async function revokeDelegationCredential(
  issuerDIDUrl: string, // Patient (Signer)
  subjectDIDUrl: string, // Doctor (Holder)
  credentialId: string,
): Promise<TransactionReceipt | null> {
  const issuerDID = await agent.didManagerGet({ did: issuerDIDUrl });
  const issuerAddress = await getEthAddress(issuerDIDUrl);
  const subjectAddress = await getEthAddress(subjectDIDUrl);

  const nonce = await readContract(
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'getNonce',
    [issuerAddress],
  );

  const hash = ethers.solidityPackedKeccak256(
    ['address', 'uint256', 'address', 'string', 'string'],
    [
      CREDENTIAL_REVOCATION_REGISTRY_CONTRACT.ADDRESS,
      nonce,
      subjectAddress, // Holder/Subject
      credentialId,
      'REVOKE',
    ],
  );

  const signedMessage = await agent.keyManagerSign({
    keyRef: issuerDID.keys[0].kid,
    data: hash,
    algorithm: 'eth_signMessage',
    encoding: 'hex',
  });

  const signature = ethers.Signature.from(signedMessage);

  const tx = await connectToContract(
    issuerDID.did,
    CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
    'revokeCredentialWithSignature',
    [subjectAddress, credentialId, nonce, signature.v, signature.r, signature.s],
    0,
    CHAIN_ID,
  );

  if (!tx) throw new Error('Transaction failed');
  return tx;
}

/**
 * Get all credentials issued to a holder
 * Only the issuer or holder can retrieve the credentials
 * @param holderDIDUrl DID URL of the holder
 * @returns The credentials issued to the holder
 * @throws Error if the holder DID is not found or if there is an error in retrieving the credentials
 * @example
 * const credentials = await getCredentialsForHolder('did:ethr:sepolia:0x123abc');
 */
export async function getCredentialsForHolder(holderDID: string): Promise<
  {
    vcID: string;
    issuer: string;
    holder: string;
    ttl: number;
    revoked: boolean;
  }[]
> {
  const holderDIDDoc = await agent.didManagerGetByAlias({
    alias: 'default',
  });

  const messageHash = ethers.keccak256(
    ethers.toUtf8Bytes(`Authentication Request for ${holderDID}`),
  );

  const signedMessage = await agent.keyManagerSign({
    keyRef: holderDIDDoc.keys[0].kid,
    data: messageHash,
    algorithm: 'eth_signMessage',
    encoding: 'hex',
  });

  const signature = ethers.Signature.from(signedMessage);

  try {
    const result = await readContract(
      CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
      'getCredentialsForHolder',
      [
        await getEthAddress(holderDID),
        signature.v,
        signature.r,
        signature.s,
        messageHash,
      ],
    );

    const parsed = JSON.parse(
      JSON.stringify(result, (_, value) =>
        typeof value === 'bigint' ? value.toString() : value,
      ),
    );

    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.log(`No credentials found for ${holderDID}`);
      return [];
    }

    return parsed.map((item: any) => ({
      vcID: item[0],
      issuer: item[1],
      holder: item[2],
      ttl: Number(item[3]),
      revoked: item[4],
    }));
  } catch (error: any) {
    if (error.code === 'BAD_DATA') {
      console.warn(
        'Access denied or no credentials available for this signer/holder.',
      );
      return [];
    }
    throw error;
  }
}
