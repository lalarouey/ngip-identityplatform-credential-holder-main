// Contract referernces

type TContract = {
  ADDRESS: string;
  ABI: ReadonlyArray<Record<string, unknown>>;
};

const SCHEMA_REGISTRY_CONTRACT: TContract = Object.freeze({
  ADDRESS: '0xc4D242d66D313ce1E198DaC9ccEbfe5430de954D',
  ABI: Object.freeze([
    {
      inputs: [
        { internalType: 'address', name: 'issuer', type: 'address' },
        { internalType: 'string', name: 'schemaName', type: 'string' },
      ],
      name: 'getSchema',
      outputs: [
        {
          components: [
            { internalType: 'string', name: 'schemaName', type: 'string' },
            { internalType: 'string', name: 'schema', type: 'string' },
            {
              internalType: 'bool',
              name: 'requiresPhysicalVerification',
              type: 'bool',
            },
          ],
          internalType: 'struct SchemaRegistry.Schema',
          name: '',
          type: 'tuple',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'address', name: 'issuer', type: 'address' }],
      name: 'getSchemaTypes',
      outputs: [{ internalType: 'string[]', name: '', type: 'string[]' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'address', name: '', type: 'address' },
        { internalType: 'uint256', name: '', type: 'uint256' },
      ],
      name: 'issuerSchemas',
      outputs: [
        { internalType: 'string', name: 'schemaName', type: 'string' },
        { internalType: 'string', name: 'schema', type: 'string' },
        {
          internalType: 'bool',
          name: 'requiresPhysicalVerification',
          type: 'bool',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'string', name: 'schemaName', type: 'string' },
        { internalType: 'string', name: 'schema', type: 'string' },
      ],
      name: 'registerSchema',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [
        { internalType: 'string', name: 'schemaName', type: 'string' },
        { internalType: 'string', name: 'schema', type: 'string' },
        {
          internalType: 'bool',
          name: 'requiresPhysicalVerification',
          type: 'bool',
        },
      ],
      name: 'registerSchemaWithFlag',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'string', name: 'schemaName', type: 'string' }],
      name: 'removeSchema',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ]),
});

const CREDENTIAL_REVOCATION_REGISTRY_CONTRACT: TContract = Object.freeze({
  ADDRESS: '0x5EA76d697A19237e75329EFe6d23769eABa7f02a',
  ABI: Object.freeze([
    Object.freeze({
      anonymous: false,
      inputs: Object.freeze([
        Object.freeze({
          indexed: true,
          internalType: 'bytes32',
          name: 'credentialHash',
          type: 'bytes32',
        }),
        Object.freeze({
          indexed: true,
          internalType: 'address',
          name: 'issuer',
          type: 'address',
        }),
      ]),
      name: 'CredentialIssued',
      type: 'event',
    }),
    Object.freeze({
      anonymous: false,
      inputs: Object.freeze([
        Object.freeze({
          indexed: true,
          internalType: 'bytes32',
          name: 'credentialHash',
          type: 'bytes32',
        }),
        Object.freeze({
          indexed: true,
          internalType: 'address',
          name: 'issuer',
          type: 'address',
        }),
        Object.freeze({
          indexed: false,
          internalType: 'uint256',
          name: 'timestamp',
          type: 'uint256',
        }),
      ]),
      name: 'CredentialRevoked',
      type: 'event',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({
          internalType: 'address',
          name: 'holder',
          type: 'address',
        }),
        Object.freeze({ internalType: 'uint8', name: 'v', type: 'uint8' }),
        Object.freeze({ internalType: 'bytes32', name: 'r', type: 'bytes32' }),
        Object.freeze({ internalType: 'bytes32', name: 's', type: 'bytes32' }),
        Object.freeze({
          internalType: 'bytes32',
          name: 'hash',
          type: 'bytes32',
        }),
      ]),
      name: 'getCredentialsForHolder',
      outputs: Object.freeze([
        Object.freeze({
          components: Object.freeze([
            Object.freeze({
              internalType: 'string',
              name: 'vcID',
              type: 'string',
            }),
            Object.freeze({
              internalType: 'address',
              name: 'issuer',
              type: 'address',
            }),
            Object.freeze({
              internalType: 'address',
              name: 'holder',
              type: 'address',
            }),
            Object.freeze({
              internalType: 'uint256',
              name: 'ttl',
              type: 'uint256',
            }),
            Object.freeze({
              internalType: 'bool',
              name: 'revoked',
              type: 'bool',
            }),
          ]),
          internalType: 'struct CredentialRevocationRegistry.Credential[]',
          name: '',
          type: 'tuple[]',
        }),
      ]),
      stateMutability: 'view',
      type: 'function',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({
          internalType: 'address',
          name: 'account',
          type: 'address',
        }),
      ]),
      name: 'getNonce',
      outputs: Object.freeze([
        Object.freeze({ internalType: 'uint256', name: '', type: 'uint256' }),
      ]),
      stateMutability: 'view',
      type: 'function',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({ internalType: 'string', name: 'vcID', type: 'string' }),
      ]),
      name: 'isRevoked',
      outputs: Object.freeze([
        Object.freeze({ internalType: 'bool', name: '', type: 'bool' }),
      ]),
      stateMutability: 'view',
      type: 'function',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({
          internalType: 'address',
          name: 'holder',
          type: 'address',
        }),
        Object.freeze({ internalType: 'string', name: 'vcID', type: 'string' }),
        Object.freeze({
          internalType: 'uint256',
          name: 'ttl',
          type: 'uint256',
        }),
      ]),
      name: 'issueCredential',
      outputs: Object.freeze([]),
      stateMutability: 'nonpayable',
      type: 'function',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({
          internalType: 'address',
          name: 'holder',
          type: 'address',
        }),
        Object.freeze({ internalType: 'string', name: 'vcID', type: 'string' }),
        Object.freeze({
          internalType: 'uint256',
          name: 'ttl',
          type: 'uint256',
        }),
        Object.freeze({
          internalType: 'uint256',
          name: 'expectedNonce',
          type: 'uint256',
        }),
        Object.freeze({ internalType: 'uint8', name: 'v', type: 'uint8' }),
        Object.freeze({ internalType: 'bytes32', name: 'r', type: 'bytes32' }),
        Object.freeze({ internalType: 'bytes32', name: 's', type: 'bytes32' }),
      ]),
      name: 'issueCredentialWithSignature',
      outputs: Object.freeze([]),
      stateMutability: 'nonpayable',
      type: 'function',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({ internalType: 'address', name: '', type: 'address' }),
      ]),
      name: 'nonces',
      outputs: Object.freeze([
        Object.freeze({ internalType: 'uint256', name: '', type: 'uint256' }),
      ]),
      stateMutability: 'view',
      type: 'function',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({
          internalType: 'address',
          name: 'holder',
          type: 'address',
        }),
        Object.freeze({ internalType: 'string', name: 'vcID', type: 'string' }),
      ]),
      name: 'revokeCredential',
      outputs: Object.freeze([]),
      stateMutability: 'nonpayable',
      type: 'function',
    }),
    Object.freeze({
      inputs: Object.freeze([
        Object.freeze({
          internalType: 'address',
          name: 'holder',
          type: 'address',
        }),
        Object.freeze({ internalType: 'string', name: 'vcID', type: 'string' }),
        Object.freeze({
          internalType: 'uint256',
          name: 'expectedNonce',
          type: 'uint256',
        }),
        Object.freeze({ internalType: 'uint8', name: 'v', type: 'uint8' }),
        Object.freeze({ internalType: 'bytes32', name: 'r', type: 'bytes32' }),
        Object.freeze({ internalType: 'bytes32', name: 's', type: 'bytes32' }),
      ]),
      name: 'revokeCredentialWithSignature',
      outputs: Object.freeze([]),
      stateMutability: 'nonpayable',
      type: 'function',
    }),
  ]),
});

export {
  CREDENTIAL_REVOCATION_REGISTRY_CONTRACT,
  SCHEMA_REGISTRY_CONTRACT,
  TContract,
};
