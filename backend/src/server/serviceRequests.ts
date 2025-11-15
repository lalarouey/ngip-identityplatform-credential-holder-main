import { VerifiableCredential } from "@veramo/core";
import { Request, Response } from "express";
import { Server, Socket } from "socket.io";
import { resolveDIDCommMessage, sendDIDCommMessage } from "../didcomm.js";
import { title } from "process";

/**
 * Requests a service from a service provider and sends the response to the client
 * @param socket The socket to send the service response to
 * @param providerDID The DID of the service provider
 * @param holderDID The DID of the requester
 * @param data The request data
 * @example
 * requestService(socket, data);
 */
export async function requestService(
  providerDID: string,
  holderDID: string,
  credential: VerifiableCredential
): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Requesting service...`);

  try {
    validateServiceRequest(providerDID, credential);

    await sendDIDCommMessage(
      holderDID,
      providerDID,
      { credential },
      "requestService",
      "authcrypt"
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    console.error(`[${timestamp}] Error requesting service:`, error);
    throw new Error(errorMessage);
  }
}

export async function handleServiceResponse(
  io: Server | null,
  req: Request,
  res: Response
): Promise<void> {
  const timestamp = new Date().toISOString();
  try {
    const unpackedDIDCommMessage = await resolveDIDCommMessage(req.body);
    const responseData = unpackedDIDCommMessage.message.body as {
      approved?: boolean;
      token?: string;
      error?: string;
    };
    res.sendStatus(200);
    console.log(
      `[${timestamp}] Service response received:`,
      responseData.approved
    );

    if (io) {
      io.emit("service-response", responseData);
    }
  } catch (error) {
    res.status(500).send({ error: "An error occurred handling the message" });
    console.error("Error processing service response:", error);

    if (io) {
      io.emit("custom-error", {
        title: "Service response error",
        errorMessage: "Failed to process service response",
      });
    }
  }
}

function validateServiceRequest(
  did: string,
  credential: VerifiableCredential
): void {
  if (!did || typeof did !== "string") {
    throw new Error("Invalid data: DID is missing or not a string");
  }

  if (!credential || typeof credential !== "object") {
    // TODO: Check if this is a valid VerifiableCredential
    throw new Error("Invalid data: Credential is missing or not an object");
  }
}
