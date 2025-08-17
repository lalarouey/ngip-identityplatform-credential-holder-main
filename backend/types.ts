import { VerifiableCredential } from '@veramo/core';
import { TransactionResponse } from 'ethers';

export type ServiceRequest = {
  did: string;
  credential: VerifiableCredential;
};

export type PendingCredentialRequest = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: { requestId: string; did: string; data: any };
  resolve: (data: {
    txResponse: TransactionResponse;
    credential: VerifiableCredential;
  }) => void;
  reject: (data: { error: string }) => void;
};

export type PendingServiceRequest = {
  payload: { requestId: string; did: string; credential: VerifiableCredential };
  resolve: (data: { approved: boolean; token: string }) => void;
  reject: (data: { approved?: boolean; error?: string }) => void;
};

export type CredentialRequest = {
  did: string;
  schemaName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { [key: string]: any };
};

export type TSchema = {
  schemaName: string;
  schemaFields: [TField, ...TField[]];
  requiresPhysicalVerification?: boolean;
};

export type TField = {
  fieldName: string;
  type: 'string' | 'number';
};

export type TEncryptedVC = {
  id: string;
  encryptedCredential: string;
};

export type TCidRow = {
  cid: string;
  vcID: string;
  docID: string;
  created_at: string;
};
