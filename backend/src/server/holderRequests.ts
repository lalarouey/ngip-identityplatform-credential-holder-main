import { Request, Response } from 'express';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { resolveDIDCommMessage, sendDIDCommMessage } from '../didcomm.js';

export async function challengeResponse(
  socket: Socket,
  holderDID: string,
  recipientDID: string,
  challenge: string,
  decision: boolean,
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
      'verifyOwnership',
      'authcrypt',
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to send response';
    console.error(`[${timestamp}] Error sending response:`, errorMessage);
    socket.emit('custom-error', {
      title: 'Ownership challenge response error',
      errorMessage: 'Failed to send response',
    });
  }
}

export async function verifyOwnership(
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
  req: Request,
  res: Response,
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Ownership verification request received...`);
  try {
    const unpackedMessage = await resolveDIDCommMessage(req.body);

    const challenge = unpackedMessage.message.body.challenge;
    const senderDID = unpackedMessage.message.from;

    if (!challenge || typeof challenge !== 'string') {
      console.error(`[${timestamp}] No challenge found in message`);
      res.status(400).send('Invalid message format');
      return;
    }

    if (!senderDID) {
      console.error(`[${timestamp}] No sender DID found in message`);
      res.status(400).send('Invalid message format');
      return;
    }

    io.emit('ownership-challenge', senderDID, challenge);

    res.status(200).send('Message received');
  } catch (error) {
    console.error('Error unpacking message:', error);
    res.status(400).send('Invalid message format');
  }
}
