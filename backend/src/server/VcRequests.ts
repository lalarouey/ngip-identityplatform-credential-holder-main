import { IKey, VerifiableCredential } from "@veramo/core";
import { Request, Response } from "express";
import { Server, Socket } from "socket.io";
import { TCidRow, TEncryptedVC } from "types.js";
import {
  getCredentialsForHolder,
  isCredentialRevoked,
  issueCredential,
  revokeCredential,
  verifyCredential,
} from "../credentials.js";
import { resolveDIDCommMessage, sendDIDCommMessage } from "../didcomm.js";
import {
  deletePrivateJSONObject,
  getPrivateJSONObject,
  uploadPrivateJSONObject,
} from "../ipfs/privatePinataAPI.js";
import { execute, fetchAll, fetchFirst } from "../ipfsRegister.js";
import {
  getEncryptedKeyFromDID,
  getEncryptedKeyFromDID2,
  getIdentifierKeys,
  initializeDID,
} from "../utils.js";
import { agent, db } from "./server.js";

/**
 * Requests a verifiable credential from an issuer and sends it to the client
 * @param socket The socket to send errors to
 * @param holderDID The holder's DID
 * @param issuerDID The issuer's DID
 * @param schemaName The name of the schema
 * @param requestedCredential The request data
 * @example
 * requestVC(socket, data);
 */
export async function requestVC(
  holderDID: string,
  issuerDID: string,
  schemaName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestedCredential: { [key: string]: any }
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Requesting VC...`);
  try {
    const serviceType = "requestCredential";
    const body = {
      did: holderDID,
      schemaName: schemaName,
      data: requestedCredential,
    };
    await sendDIDCommMessage(
      holderDID,
      issuerDID,
      body,
      serviceType,
      "authcrypt"
    );
    const msg = `VC request sent to issuer: ${issuerDID}`;
    console.log(`[${timestamp}] ${msg}`);
    return { success: true, message: msg };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error(`[${timestamp}] Error requesting VC:`, error);
    return { success: false, message: errorMessage };
  }
}

/**
 * Function to request a verifiable credential with physical verification
 * @param socket the socket to send errors to
 * @param holderDID DID of the holder
 * @param issuerDID DID of the issuer
 * @param schemaName Name of the schema
 * @param requestedCredential Data to be requested
 * @param physicallyVerifiedCredential A verifiable credential that has been physically verified
 */
export async function requestVCWithPhysicalVerification(
  holderDID: string,
  issuerDID: string,
  schemaName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestedCredential: { [key: string]: any },
  physicallyVerifiedCredential: VerifiableCredential
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Requesting VC...`);
  try {
    const serviceType = "requestCredential";
    const body = {
      schemaName: schemaName,
      data: requestedCredential,
      credentialBinding: physicallyVerifiedCredential,
    };
    await sendDIDCommMessage(
      holderDID,
      issuerDID,
      body,
      serviceType,
      "authcrypt"
    );
    const msg = `VC request with physical verification sent to issuer: ${issuerDID}`;
    console.log(`[${timestamp}] ${msg}`);
    return { success: true, message: msg };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error(`[${timestamp}] Error requesting VC:`, error);
    return { success: false, message: errorMessage };
  }
}

// export async function receiveCredential(
//   io: Server,
//   req: Request,
//   res: Response
// ) {
//   try {
//     const unpackedDIDCommMessage = await resolveDIDCommMessage(req.body);
//     const credential = unpackedDIDCommMessage.message.body;
//     res.sendStatus(200);
//     await uploadVC(credential);
//     io.emit("vc-received", credential);
//   } catch (error) {
//     res.status(500).send({ error: "An error occured handling the message" });
//     console.error("Error processing credential:", error);
//     io.emit("custom-error", {
//       title: "Credential reception error",
//       errorMessage: "Failed to process credential",
//     });
//   }
// }

export async function receiveCredential(req: Request, res: Response) {
  try {
    const unpackedDIDCommMessage = await resolveDIDCommMessage(req.body);

    if (!unpackedDIDCommMessage?.message?.body) {
      return res.status(400).json({ error: "Invalid DIDComm message format" });
    }

    const credential = unpackedDIDCommMessage.message.body;

    // Save credential first
    await uploadVC(credential);

    // // Emit event after saving
    // io.emit("vc-received", credential);

    // Respond to client after success
    return res
      .status(200)
      .json({ message: "Credential received successfully", credential });
  } catch (error) {
    console.error("Error processing credential:", error);

    return res
      .status(500)
      .json({ error: "An error occurred handling the message" });
  }
}

/**
 * Function to get the VCs of the holder and send them to the client
 * @param socket the socket to send the VCs to
 * @param data the DID of the holder
 */
export async function getVCs() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Getting VCs...`);
  try {
    const IPFSData = await mapAndGetCredentials();

    const credentialIDs = IPFSData.map((data) => data.id);

    console.log(`[${timestamp}] VCs received:`, credentialIDs);
    return IPFSData;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error(`[${timestamp}] Error getting VCs:`, error);
    throw errorMessage;
  }
}

export async function removeVC(
  holderDID: string,
  credentialID: string
): Promise<any> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Attempting to remove VC: ${credentialID}`);

  try {
    if (!credentialID || typeof credentialID !== "string") {
      throw new Error("Invalid credential ID");
    }

    // Check if credential is revoked before deleting, if not, revoke it
    const isRevoked = await isCredentialRevoked(credentialID);
    if (!isRevoked) {
      const receipt = await revokeCredential(holderDID, credentialID);
      if (!receipt) {
        throw new Error("Failed to revoke VC");
      }
    }

    // Fetch the document ID from the database
    const row = (await fetchFirst(db, `SELECT docID FROM cids WHERE vcID = ?`, [
      credentialID,
    ])) as TCidRow;

    if (!row || !row.docID) {
      throw new Error(`No document found for credential ID: ${credentialID}`);
    }

    // Delete the VC from IPFS
    const ipfsResponse = await deletePrivateJSONObject(row.docID);
    if (!ipfsResponse) {
      throw new Error("Failed to delete VC from IPFS");
    }

    // Delete the CID from the database
    await execute(db, `DELETE FROM cids WHERE vcID = ?`, [credentialID]);

    console.log(`[${timestamp}] VC successfully removed: ${credentialID}`);
    return credentialID;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unexpected error occurred";
    console.error(`[${timestamp}] VC removal failed: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}

/**
 * Verifies the provided verifiable credential and sends the result to the client
 * @param socket The socket to send the verification result to
 * @param data The verifiable credential to verify
 * @example
 * verifyVC(socket, data);
 */
export async function verifyVC(credential: VerifiableCredential) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Verifying VC...`);

  try {
    if (!credential) {
      throw new Error("No data provided");
    }

    const result = await verifyCredential(credential);

    console.log(`[${timestamp}] VC verification result:`, result);
    return { id: credential.id, verified: result };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to verify the credential";
    console.error(`[${timestamp}] Error verifying VC:`, error);
    throw errorMessage;
  }
}

/**
 * Fetches the credentials for the holder's DID and sends them to the client
 * @param socket The socket to send the credentials to
 * @param data The holder's DID
 */
export async function checkRevocationStatus(did: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Getting VCs...`);

  try {
    if (!did) {
      throw new Error("Invalid data: DID is missing");
    }

    const response = await getCredentialsForHolder(did);

    if (!response) {
      throw new Error("Failed to get credentials");
    }

    console.log(`[${timestamp}] VCs received:`, response);
    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get credentials";
    console.error(`[${timestamp}] Error getting VCs:`, error);
    throw errorMessage;
  }
}

export async function selfIssueVC(
  holderDID: string,
  requestedCredential: { [key: string]: any },
  credentialName?: string
) {
  console.log(`[${new Date().toISOString()}] Self-issuing VC`);
  try {
    const { credential, txResponse } = await issueCredential(
      holderDID,
      requestedCredential,
      86400,
      credentialName
    );
    if (!credential || !txResponse) {
      throw new Error("Failed to self-issue VC");
    }
    await uploadVC(credential);
    return credential;
    // socket.emit("vc-received", credential);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to self-issue VC";
    console.error(
      `[${new Date().toISOString()}] Error self-issuing VC:`,
      error
    );
    throw errorMessage;
  }
}

/**
 * Function to upload a verifiable credential to IPFS and store its CID in the database
 * @param credential The verifiable credential to upload
 * @returns a promise that resolves to the CID of the uploaded credential
 */
async function uploadVC(credential: VerifiableCredential) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Uploading VC to IPFS...`);
  console.log("Credential: ", credential);
  try {
    const subjectId = credential.credentialSubject.id;
    const vcId = credential.id;

    if (!subjectId || !vcId) {
      throw new Error("Credential is missing required identifiers.");
    }
    console.log("Subject ID: ", subjectId);
    let encrypted: any;
    if (subjectId.startsWith("did:")) {
      const encKey = await getEncryptedKeyFromDID(subjectId);
      if (!encKey) {
        throw new Error("X25519 encryption key not found for DID");
      }

      encrypted = await agent.keyManagerEncryptJWE({
        data: JSON.stringify(credential),
        kid: encKey.kid,
        to: encKey,
      });
    } else {
      console.warn(
        `Subject ID is not a DID, skipping encryption: ${subjectId}`
      );
      encrypted = { raw: JSON.stringify(credential) }; // fallback: store unencrypted
    }

    // // const encKey2 = await getEncryptedKeyFromDID(subjectId);
    // const encKey = await getEncryptedKeyFromDID2(subjectId);
    // if (!encKey) {
    //   throw new Error("X25519 encryption key not found for DID");
    // }

    // // Encrypt the VC
    // const encrypted = await agent.keyManagerEncryptJWE({
    //   data: JSON.stringify(credential),
    //   kid: encKey.kid,
    //   to: encKey,
    // });

    // Upload to IPFS
    const uploadResponse = await uploadPrivateJSONObject({
      id: vcId,
      encryptedCredential: JSON.stringify(encrypted),
    });

    const cid = uploadResponse?.cid;
    if (!cid) {
      throw new Error("Failed to upload VC to IPFS");
    }

    await execute(db, `INSERT OR IGNORE INTO cids (cid) VALUES (?)`, [cid]);
    await execute(db, `UPDATE cids SET docID = ?, vcID = ? WHERE cid = ?`, [
      uploadResponse.id,
      vcId,
      cid,
    ]);

    console.log("VC uploaded to IPFS:", cid);
    return cid;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to upload credential";
    console.error(`[${timestamp}] Error uploading credential:`, error);
    throw new Error(errorMessage);
  }
}

async function validateDID(did: string) {
  const didDocResult = await agent.resolveDid({ didUrl: did });
  if (!didDocResult.didDocument) {
    throw new Error(`Could not resolve DID document for: ${did}`);
  }

  const didDoc = didDocResult.didDocument;

  // Check for usable keyAgreement
  const hasKeyAgreement =
    Array.isArray(didDoc.keyAgreement) && didDoc.keyAgreement.length > 0;

  if (!hasKeyAgreement) {
    console.log(
      `No usable keyAgreement found for DID ${did}. 
       Available verification methods: ${JSON.stringify(
         didDoc.verificationMethod || []
       )}`
    );
  }

  return did;
}

/**
 * Function to map and get credentials from IPFS
 * @returns a promise that resolves to an array of verifiable credentials
 */
async function mapAndGetCredentials() {
  // Retrieve the CIDs from the cids table
  const rows = await fetchAll(db, `SELECT * from cids`, []);
  console.log("Rows: ", rows);

  if (!Array.isArray(rows)) {
    throw new Error("Failed to retrieve CIDs from the database");
  }

  // Retrieve VC data for each CID from IPFS
  const IPFSData = await Promise.all(
    rows.map(async ({ cid }) => {
      const response = await getPrivateJSONObject(cid);
      const data = response?.data;
      console.log("Data private JSON object: ", data);
      if (!isEncryptedVC(data)) {
        throw new Error(`Invalid data format for CID ${cid}`);
      }
      return data;
    })
  );

  const DID = await agent
    .didManagerGetByAlias({
      alias: "default",
    })
    .then((identifier) => identifier.did);
  // await validateDID(DID);
  // await initializeDID(DID);

  // Get all X25519 keys for the holder to try decrypting with
  const allKeys = await getIdentifierKeys(DID);
  const x25519Keys = allKeys.filter((k) => k.type === "X25519");
  if (x25519Keys.length === 0) {
    throw new Error("No X25519 encryption keys found for holder DID");
  }
  console.log(`Found ${x25519Keys.length} X25519 key(s) for decryption`);

  const credentials = await Promise.all(
    IPFSData.map(async (data) => {
      const { id, encryptedCredential } = data;
      if (!id || !encryptedCredential) return null;

      // Try decrypting with each available X25519 key
      for (const encKey of x25519Keys) {
        try {
          const parsed = JSON.parse(encryptedCredential);
          const decrypted = await agent.keyManagerDecryptJWE({
            kid: encKey.kid,
            data: parsed,
          });

          return JSON.parse(decrypted);
        } catch (error) {
          // If this key fails, try the next one
          continue;
        }
      }
      
      // If all keys failed, log the error
      console.error(`Failed to decrypt credential for ID ${id} with any available key`);
      return null;
    })
  );
  return credentials.filter(Boolean) as VerifiableCredential[];
}

/**
 * Type guard to check if the data is an encrypted VC
 * @param data The data to check
 * @returns true if the data is an encrypted VC, false otherwise
 */
function isEncryptedVC(data: any): data is TEncryptedVC {
  return (
    typeof data?.id === "string" &&
    typeof data?.encryptedCredential === "string"
  );
}
