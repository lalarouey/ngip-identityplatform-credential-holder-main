import * as dotenv from 'dotenv';
dotenv.config();
// REQUIRED ENVIRONMENT VARIABLES
export const KMS_SECRET_KEY =
  process.env.KMS_SECRET_KEY ??
  (() => {
    throw new Error('KMS_SECRET_KEY is not set');
  })();
export const HOLDER_AGENT_URL =
  process.env.HOLDER_AGENT_URL ??
  (() => {
    throw new Error('HOLDER_AGENT_URL is not set');
  })();
export const PINATA_JWT =
  process.env.PINATA_JWT ??
  (() => {
    throw new Error('PINATA_JWT is not set');
  })();
export const PINATA_GATEWAY_URL =
  process.env.PINATA_GATEWAY_URL ??
  (() => {
    throw new Error('PINATA_GATEWAY_URL is not set');
  })();

export const infuraApiKey = process.env.INFURA_PROJECT_ID;
export const alchemyApiKey = process.env.ALCHEMY_API_KEY;

// OPTIONAL ENVIRONMENT VARIABLES
export const CHAIN_ID = parseInt(process.env.CHAIN_ID || '11155111', 10);
export const DEFAULT_GAS_LIMIT = parseInt(
  process.env.DEFAULT_GAS_LIMIT || '1000000',
  10,
);
export const PORT = process.env.PORT;
export const TX_TIMEOUT = parseInt(process.env.TX_TIMEOUT || '1800000', 10);
export const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'http://localhost:5173',
];
