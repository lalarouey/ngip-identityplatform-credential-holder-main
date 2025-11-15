import { Request, Response } from "express";
import { DefaultEventsMap, Server, Socket } from "socket.io";
import { resolveDIDCommMessage, sendDIDCommMessage } from "../didcomm.js";
import { didToSocketMap } from "./server.js";

export async function challengeResponse(
  holderDID: string,
  recipientDID: string,
  challenge: string,
  decision: boolean
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Ownership challenge response received`);

  try {
    if (decision) {
      console.log(`[${timestamp}] Ownership challenge accepted`);
    } else {
      console.log(`[${timestamp}] Ownership challenge rejected`);
    }

    await sendDIDCommMessage(
      holderDID,
      recipientDID,
      { challenge: challenge, response: decision },
      "verifyOwnership",
      "authcrypt"
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send response";
    console.error(`[${timestamp}] Error sending response:`, errorMessage);
    throw errorMessage;
  }
}

export async function verifyOwnership(
  req: Request,
  res: Response
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Ownership verification request received...`);
  try {
    const unpackedMessage = await resolveDIDCommMessage(req.body);

    const challenge = unpackedMessage.message.body.challenge;
    const senderDID = unpackedMessage.message.from;
    const recipientDID = Array.isArray(unpackedMessage.message?.to)
      ? unpackedMessage.message.to[0]
      : unpackedMessage.message?.to;

    console.log("Unpacked DIDComm:", unpackedMessage);
    console.log("Challenge:", challenge);
    console.log("From:", senderDID);
    console.log("To:", recipientDID);

    if (!challenge || typeof challenge !== "string") {
      console.error(`[${timestamp}] No challenge found in message`);
      res.status(400).send("Invalid message format");
      return;
    }

    if (!senderDID || !recipientDID) {
      console.error(`[${timestamp}] Missing from/to DID`);
      return res.status(400).send("Invalid message format");
    }

    // if (io) {
    //   io.emit("ownership-challenge", senderDID, challenge);
    // }
    const socketEntry = didToSocketMap.get(recipientDID);
    if (socketEntry?.socket) {
      console.log(
        `[${timestamp}] Emitting ownership challenge to socket for ${recipientDID}`
      );
      socketEntry.challenge = challenge;
      socketEntry.from = senderDID;
      socketEntry.socket.emit("ownership-challenge", {
        from: senderDID,
        challenge,
      });
    } else {
      console.warn(
        `[${timestamp}] No active socket found for ${recipientDID}. Challenge stored.`
      );
      didToSocketMap.set(recipientDID, {
        socket: null,
        challenge,
        from: senderDID,
      });
    }

    res.status(200).send("Message received");
  } catch (error) {
    console.error("Error unpacking message:", error);
    res.status(400).send("Invalid message format");
  }
}
