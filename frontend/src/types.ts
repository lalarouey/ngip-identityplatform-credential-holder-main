import { VerifiableCredential } from '@veramo/core';

export type TRegistryVC = {
  vcID: string;
  issuer: string;
  holder: string;
  ttl: number;
  revoked: boolean;
};

export type TRequestVC = {
  requestId: string;
  did: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { [key: string]: any };
};

export type TServiceRequest = {
  requestId: string;
  did: string;
  credential: VerifiableCredential;
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
