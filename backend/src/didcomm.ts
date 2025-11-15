import {
  IDIDCommMessage,
  IPackedDIDCommMessage,
  IUnpackedDIDCommMessage,
} from "@veramo/did-comm";
import { agent } from "./server/server.js";
import { getIdentifierKeys, resolveDIDDocument } from "./utils.js";

/**
 * Send a DIDComm message using optional encryption.
 * @param senderDID The sender of the message
 * @param recipinetDID The recipient of the message
 * @param message The message to send
 * @param serviceEndpoint The serviceEndpoint the message is sent to
 * @param encryption The encryption method to be used
 */
export async function sendDIDCommMessage(
  senderDID: string,
  recipientDID: string,
  message: Record<string, unknown>,
  serviceType: string,
  encryption: "authcrypt" | "anoncrypt" | "none"
): Promise<void> {
  const didDoc = await resolveDIDDocument(recipientDID);
  // const serviceEndpoint = didDoc?.service?.find(
  //   service => service.type === serviceType,
  // )?.serviceEndpoint;

  const serviceEndpoint =
    didDoc?.service?.find((s) => s.type === serviceType)?.serviceEndpoint ??
    didDoc?.service?.find((s) => s.type === "DIDCommMessaging")
      ?.serviceEndpoint;

  if (!serviceEndpoint || typeof serviceEndpoint !== "string") {
    throw new Error(
      `Service endpoint is invalid or undefined for ${serviceType}`
    );
  }

  const didCommMessage: IDIDCommMessage = {
    id: `urn:uuid:${crypto.randomUUID()}`,
    type: "https://didcomm.org/basicmessage/2.0/message",
    to: [recipientDID],
    from: senderDID,
    body: message,
  };

  let packedMessage: IPackedDIDCommMessage;

  if (encryption === "none") {
    packedMessage = await agent.packDIDCommMessage({
      packing: "none",
      message: didCommMessage,
    });
  } else {
    const sender = await agent.didManagerGet({ did: senderDID });
    if (!sender) throw new Error("Sender DID must be managed by the agent");

    const key = (await getIdentifierKeys(senderDID)).find(
      (k) => k.type === "X25519"
    );
    if (!key) throw new Error("X25519 encryption key not found for sender");

    packedMessage = await agent.packDIDCommMessage({
      packing: encryption,
      message: didCommMessage,
      keyRef: key.kid,
    });
  }

  try {
    const response = await fetch(serviceEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packedMessage),
    });

    if (!response.ok) {
      const errorMessage = response.body
        ? await response.json().then((err) => err.error || JSON.stringify(err))
        : response.statusText;

      throw new Error(
        `Message failed to send: ${response.status} - ${errorMessage}`
      );
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Resolve a packed DIDComm message.
 */
export async function resolveDIDCommMessage(packedMessage: {
  message: string;
}): Promise<IUnpackedDIDCommMessage> {
  try {
    const unpackedMessage = await agent.unpackDIDCommMessage(packedMessage);
    return unpackedMessage;
  } catch (error) {
    console.error("Failed to unpack DIDComm message:", error);
    throw error;
  }
}
