import { Socket } from "socket.io";
import {
  getSchema as getSchemaFromRegistry,
  getSchemaNames as getSchemaNamesFromRegistry,
} from "../schemaRegistry.js";

/**
 * This function retrieves the Issuer's schema names from the schema registry.
 *
 * @param socket Issuer socket.
 * @param issuerDID Issuers DID.
 *
 * example usage:
 * getSchemaNames(socket, 'did:example:123');
 */
export async function getSchemaNames(issuerDID: string) {
  try {
    const schemaNames = await getSchemaNamesFromRegistry(issuerDID);
    console.log("Schema names retrieved for", issuerDID, ":", schemaNames);
    return schemaNames;
  } catch (error: any) {
    console.error(
      "ServerError: Failed to retrieve list of schema Names",
      error
    );
    throw new Error(error.message || "Failed to get schema names");
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
export async function getSchema(issuerDID: string, schemaName: string) {
  try {
    const schema = await getSchemaFromRegistry(issuerDID, schemaName);
    console.log("Schema retrieved from issuer:", issuerDID, ":", schema);
    return schema;
  } catch (error: any) {
    console.error("ServerError: Failed to retrieve schema", error);
    throw new Error(error.message || "Failed to retrieve schema");
  }
}
