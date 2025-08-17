import { Socket } from 'socket.io';
import {
  getSchema as getSchemaFromRegistry,
  getSchemaNames as getSchemaNamesFromRegistry,
} from '../schemaRegistry.js';

/**
 * This function retrieves the Issuer's schema names from the schema registry.
 *
 * @param socket Issuer socket.
 * @param issuerDID Issuers DID.
 *
 * example usage:
 * getSchemaNames(socket, 'did:example:123');
 */
export async function getSchemaNames(socket: Socket, issuerDID: string) {
  try {
    const schemaNames = await getSchemaNamesFromRegistry(issuerDID);
    console.log('Schema names retrieved for', issuerDID, ':', schemaNames);
    socket.emit('schema-names-retrieval', schemaNames);
  } catch (error) {
    console.error(
      'ServerError: Failed to retrieve list of schema Names',
      error,
    );
    socket.emit('schema-names-retrieval', null);
  }
}

/**
 * This function retrieves the Issuer schema from the schema registry.
 *
 * @param socket Issuer socket.
 * @param issuerDID Issuer's DID.
 * @param schemaName Name of the schema.
 *
 * example usage:
 * getSchema(socket, 'did:example:123', 'schemaName');
 */
export async function getSchema(
  socket: Socket,
  issuerDID: string,
  schemaName: string,
) {
  try {
    const schema = await getSchemaFromRegistry(issuerDID, schemaName);
    console.log('Schema retrieved from issuer:', issuerDID, ':', schema);
    socket.emit('schema-retrieval', schema);
  } catch (error) {
    console.error('ServerError: Failed to retrieve schema', error);
    socket.emit('custom-error', {
      title: 'Schema retrieval error',
      errorMessage: 'Failed to retrieve schema',
    });
  }
}
