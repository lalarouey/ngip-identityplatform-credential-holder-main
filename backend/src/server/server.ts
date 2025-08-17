import { VerifiableCredential } from '@veramo/core';
import cors from 'cors';
import { ethers } from 'ethers';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { allowedOrigins } from '../config.js';
import { execute } from '../ipfsRegister.js';
import {
  challengeResponse,
  verifyOwnership,
} from '../server/holderRequests.js';
import { getSchema, getSchemaNames } from '../server/schemaRequests.js';
import {
  checkRevocationStatus,
  getVCs,
  receiveCredential,
  removeVC,
  requestVC,
  requestVCWithPhysicalVerification,
  selfIssueVC,
  verifyVC,
} from '../server/VcRequests.js';
import {
  clearDID,
  getEthAddress,
  initializeDID,
  transferFunds,
} from '../utils.js';
import { getAgent } from '../veramo/agents.js';
import { ethSepoliaProvider } from '../veramo/providers.js';
import { handleServiceResponse, requestService } from './serviceRequests.js';

export const agent = await getAgent();
const port = Number(process.env.PORT) || 3002;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});
export const db = new sqlite3.Database('./data/IPFS.sqlite');
await execute(
  db,
  `CREATE TABLE IF NOT EXISTS cids (
  cid TEXT PRIMARY KEY,
  vcID TEXT,
  docID TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
  [],
);

app.use(cors());
app.use(express.json());

const identifier = await agent.didManagerGetOrCreate({
  alias: 'default',
});
const holderDID = identifier.did;
const ethAddress = await getEthAddress(holderDID);

io.on('connection', socket => {
  console.log('Holder connected:', socket.id);

  socket.on('identifier', async () => {
    const balance = ethers.formatEther(
      await ethSepoliaProvider.getBalance(ethAddress),
    );
    socket.emit('identifier-info', holderDID, ethAddress, Number(balance));
  });

  socket.on('disconnect', () => {
    console.log('Holder disconnected:', socket.id);
  });

  socket.on('initialize-did', async (did: string) => {
    await initializeDID(did);
    socket.emit('did-initialized', did);
  });

  socket.on('clear-did', async (did: string) => {
    try {
      await clearDID(did);
      socket.emit('did-cleared', did);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to clear DID';
      console.error(`[${new Date().toISOString()}] Error clearing DID:`, error);
      socket.emit('custom-error', errorMessage);
    }
  });

  socket.on('transfer-funds', async (recipient: string) => {
    try {
      const receipt = await transferFunds(holderDID, recipient);
      if (!receipt) {
        throw new Error('Failed to transfer funds');
      }
      socket.emit('funds-transferred', recipient);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to transfer funds';
      console.error(
        `[${new Date().toISOString()}] Error transferring funds:`,
        error,
      );
      socket.emit('custom-error', {
        title: 'Failed to transfer funds',
        errorMessage,
      });
    }
  });

  socket.on(
    'vc-request',
    (
      issuerDID: string,
      schemaName: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requestedCredential: { [key: string]: any },
      physicallyVerifiedCredential?: VerifiableCredential,
    ) => {
      if (physicallyVerifiedCredential) {
        requestVCWithPhysicalVerification(
          socket,
          holderDID,
          issuerDID,
          schemaName,
          requestedCredential,
          physicallyVerifiedCredential,
        );
      } else {
        requestVC(
          socket,
          holderDID,
          issuerDID,
          schemaName,
          requestedCredential,
        );
      }
    },
  );
  socket.on(
    'issue-vc',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (credentialName, credential: { [key: string]: any }) => {
      selfIssueVC(socket, holderDID, credential, credentialName);
    },
  );

  socket.on('verify-vc', (credential: VerifiableCredential) => {
    verifyVC(socket, credential);
  });

  socket.on('check-revocation-status', () => {
    checkRevocationStatus(socket, holderDID);
  });

  socket.on('retrieve-schema-names', (issuerDID: string) => {
    getSchemaNames(socket, issuerDID);
  });

  socket.on('schema-retrieval', (issuerDID: string, schemaName: string) => {
    getSchema(socket, issuerDID, schemaName);
  });
  socket.on(
    'request-service',
    (providerDID: string, credential: VerifiableCredential) => {
      requestService(socket, providerDID, holderDID, credential);
    },
  );

  socket.on('get-credentials', () => {
    getVCs(socket, holderDID);
  });

  socket.on('remove-vc', (credentialID: string) => {
    removeVC(socket, holderDID, credentialID);
  });

  socket.on(
    'ownership-challenge-response',
    (recipientDID: string, challenge: string, response: boolean) => {
      challengeResponse(socket, holderDID, recipientDID, challenge, response);
    },
  );
});

app.post('/verify-ownership', (req, res) => {
  verifyOwnership(io, req, res);
});

app.post('/receive-credential', (req, res) => {
  receiveCredential(io, req, res);
});

app.post('/service-response', (req, res) => {
  handleServiceResponse(io, req, res);
});

server.listen(port, () => {
  console.log(`Server running at ${port}`);
});

// closes the SQLite connection when the server shuts down
process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing database connection...');
  db.close(err => {
    if (err) {
      console.error('Error closing the database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing database connection...');
  db.close(err => {
    if (err) {
      console.error('Error closing the database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
