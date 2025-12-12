import "reflect-metadata";
import { VerifiableCredential } from "@veramo/core";
import cors from "cors";
import { ethers } from "ethers";
import express, { Request, Response } from "express";
import http from "http";
import sqlite3 from "sqlite3";
import { allowedOrigins } from "../config.js";
import { execute, fetchAll } from "../ipfsRegister.js";
import {
  challengeResponse,
  verifyOwnership,
} from "../server/holderRequests.js";
import { getSchema, getSchemaNames } from "../server/schemaRequests.js";
import {
  checkRevocationStatus,
  getVCs,
  issueDelegationVC,
  receiveCredential,
  removeVC,
  requestVC,
  requestVCWithPhysicalVerification,
  revokeDelegationVC,
  selfIssueVC,
  verifyVC,
} from "../server/VcRequests.js";
import {
  clearDID,
  getEthAddress,
  initializeAllDIDs,
  initializeDID,
  transferFunds,
} from "../utils.js";
import { getAgent } from "../veramo/agents.js";
import { ethSepoliaProvider } from "../veramo/providers.js";
import { setAgentGetter } from "../veramo/resolver.js";
import { handleServiceResponse, requestService } from "./serviceRequests.js";
import { resolveDIDCommMessage } from "src/didcomm.js";
import { Server } from "socket.io";

export const agent = await getAgent({
  didProviderConfigs: [
    {
      method: "ethr",
      name: "did:ethr:sepolia",
      network: "sepolia",
      registry: "0x03d5003bf0e79C5F5223588F347ebA39AfbC3818",
      chainId: 11155111,
      provider: ethSepoliaProvider,
    },
    { method: "web", name: "did:web" },
  ],
});

// Set agent getter for did:web resolver
setAgentGetter(() => agent);

const port = Number(process.env.PORT) || 3002;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Database
export const db = new sqlite3.Database("./data/IPFS.sqlite");
await execute(
  db,
  `CREATE TABLE IF NOT EXISTS cids (
    cid TEXT PRIMARY KEY,
    vcID TEXT,
    docID TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  []
);

// await execute(
//   db,
//   `DELETE FROM cids`,
//   []
// );

await execute(
  db,
  `CREATE TABLE IF NOT EXISTS issued_delegations (
    vcID TEXT PRIMARY KEY,
    holderDID TEXT NOT NULL,
    recipientDID TEXT NOT NULL,
    credentialName TEXT,
    issuanceDate TEXT,
    revoked BOOLEAN DEFAULT 0
  )`,
  []
);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

const ethIdentifier = await agent.didManagerGetOrCreate({
  alias: "default",
  provider: "did:ethr:sepolia",
});
console.log("Holder Ethr DID document: ", ethIdentifier);
const webIdentifier = await agent.didManagerGetOrCreate({
  alias: "example.com",
  provider: "did:web",
});
console.log("web did document: ", webIdentifier);
const holderDIDs = [ethIdentifier.did, webIdentifier.did];
const ethAddress = await getEthAddress(ethIdentifier.did);

export const didToSocketMap = new Map<string, { socket: any; challenge?: string; from?: string }>();

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("New socket connection:", socket.id);

  socket.on("register-did", (did: string) => {
    console.log("Registered DID:", did);
    const existing = didToSocketMap.get(did);
    didToSocketMap.set(did, {
      socket,
      challenge: existing?.challenge,
      from: existing?.from,
    });
  });

  socket.on("disconnect", () => {
    for (const [did, entry] of didToSocketMap.entries()) {
      if (entry.socket && entry.socket.id === socket.id) {
        // Keep the challenge data but remove socket reference
        didToSocketMap.set(did, {
          socket: null,
          challenge: entry.challenge,
          from: entry.from,
        });
        console.log(`DID ${did} disconnected.`);
      }
    }
  });
});

// Get DID identifiers + balance
app.get("/identifiers", async (_req: Request, res: Response) => {
  try {
    const balance = ethers.formatEther(
      await ethSepoliaProvider.getBalance(ethAddress)
    );
    res.json({
      holderDIDs,
      ethAddress,
      balance: Number(balance),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch identifiers" });
  }
});

// Initialize DID
app.post("/initialize-did", async (req: Request, res: Response) => {
  const { did } = req.body;
  try {
    await initializeDID(did);
    res.json({ message: "DID initialized", did });
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize DID" });
  }
});

// Clear DID
app.post("/clear-did", async (req: Request, res: Response) => {
  const { did } = req.body;
  try {
    await clearDID(did);
    res.json({ message: "DID cleared", did });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear DID" });
  }
});

// Transfer funds
app.post("/transfer-funds", async (req: Request, res: Response) => {
  const { recipient, holderDID } = req.body;
  try {
    const receipt = await transferFunds(holderDID, recipient);
    if (!receipt) throw new Error("Transfer failed");
    res.json({ message: "Funds transferred", recipient });
  } catch (error) {
    res.status(500).json({ error: "Failed to transfer funds" });
  }
});

// Request VC
app.post("/request-vc", async (req, res) => {
  const {
    holderDID,
    issuerDID,
    schemaName,
    requestedCredential,
    physicallyVerifiedCredential,
  } = req.body;

  try {
    let result;
    if (physicallyVerifiedCredential) {
      result = await requestVCWithPhysicalVerification(
        holderDID,
        issuerDID,
        schemaName,
        requestedCredential,
        physicallyVerifiedCredential
      );
    } else {
      result = await requestVC(
        holderDID,
        issuerDID,
        schemaName,
        requestedCredential
      );
    }

    if (result.success) {
      res.status(200).json({ message: result.message });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// app.post("/receive-credential", async (req, res) => {
//   try {
//     console.log("Received DIDComm credential message:", req.body);
//     // Unpack the DIDComm message
//     const unpacked = await resolveDIDCommMessage(req.body);
//     // Handle the credential request or presentation
//     console.log("Unpacked DIDComm:", unpacked);
//     res.status(200).send({ success: true });
//   } catch (err) {
//     console.error("Error handling DIDComm message:", err);
//     res.status(500).send({ error: "Failed to process DIDComm message" });
//   }
// });

// Self Issue VC
app.post("/issue-vc", async (req: Request, res: Response) => {
  const { holderDID, credentialName, credential } = req.body;
  try {
    const credentialRes = await selfIssueVC(
      holderDID,
      credential,
      credentialName
    );
    res.json({ message: "VC issued", credential: credentialRes });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to issue VC" });
  }
});

// Issue Delegation VC
app.post("/issue-delegation-vc", async (req: Request, res: Response) => {
  const { holderDID, recipientDID, credentialData, credentialName } = req.body;
  try {
    const credential = await issueDelegationVC(
      holderDID,
      recipientDID,
      credentialData,
      credentialName
    );
    res.json({ message: "Delegation VC issued", credential });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to issue Delegation VC" });
  }
});

// Revoke Delegation VC
app.post("/revoke-delegation-vc", async (req: Request, res: Response) => {
  const { issuerDID, subjectDID, credentialID } = req.body;
  try {
    await revokeDelegationVC(issuerDID, subjectDID, credentialID);
    res.json({ message: "Delegation VC revoked" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to revoke Delegation VC" });
  }
});

// Verify VC
app.post("/verify-vc", async (req: Request, res: Response) => {
  const { credential } = req.body;
  try {
    const result = await verifyVC(credential as VerifiableCredential);
    res.json({ message: "VC verified", result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to verify VC" });
  }
});

// Revocation Status
app.get(
  "/check-revocation-status/:did",
  async (req: Request, res: Response) => {
    try {
      const result = await checkRevocationStatus(req.params.did);
      res.json({ message: "Revocation check complete", result });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Failed to check revocation status" });
    }
  }
);

// Retrieve Schema Names
app.get("/schema-names/:issuerDID", async (req: Request, res: Response) => {
  try {
    const result = await getSchemaNames(req.params.issuerDID);
    res.json({ message: "Schema names retrieved", result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to get schema names" });
  }
});

// Retrieve Schema
app.get(
  "/schema/:issuerDID/:schemaName",
  async (req: Request, res: Response) => {
    try {
      const result = await getSchema(
        req.params.issuerDID,
        req.params.schemaName
      );
      res.json({ message: "Schema retrieved", result });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Failed to retrieve schema" });
    }
  }
);

// Get Issued Delegations
app.get("/issued-delegations", async (req: Request, res: Response) => {
  const { holderDID } = req.query;
  try {
    const delegations = await fetchAll(
      db,
      "SELECT * FROM issued_delegations WHERE holderDID = ?",
      [holderDID]
    );
    res.json({ message: "Delegations retrieved", delegations });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch delegations" });
  }
});

// Request Service
app.post("/request-service", async (req: Request, res: Response) => {
  const { holderDID, providerDID, credential } = req.body;
  try {
    await requestService(providerDID, holderDID, credential);
    res.json({ message: "Service requested" });
  } catch (error) {
    res.status(500).json({ error: "Failed to request service" });
  }
});

// Get Credentials
app.get("/credentials", async (_req: Request, res: Response) => {
  try {
    const ipfsData = await getVCs();
    res.json({ message: "Credentials retrieved", ipfsData });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch credentials" });
  }
});

// Remove VC
app.post("/remove-vc", async (req: Request, res: Response) => {
  const { holderDID, credentialID } = req.body;
  try {
    const credentialId = await removeVC(holderDID, credentialID);
    res.json({ message: "VC removed", credentialId });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove VC" });
  }
});

// Challenge Response
app.post(
  "/ownership-challenge-response",
  async (req: Request, res: Response) => {
    const { holderDID, recipientDID, challenge, response } = req.body;
    try {
      await challengeResponse(holderDID, recipientDID, challenge, response);
      res.json({ message: "Challenge response sent" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send challenge response" });
    }
  }
);

app.post("/verify-ownership", async (req, res) => {
  await verifyOwnership(req, res);
});

app.post("/receive-credential", async (req, res) => {
  await receiveCredential(req, res);
});

app.post("/service-response", (req, res) =>
  handleServiceResponse(null, req, res)
);

server.listen(port, async () => {
  console.log(`Server running at ${port}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("Closing database connection...");
  db.close((err) => {
    if (err) console.error("DB close error:", err.message);
    else console.log("Database connection closed.");
    process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
