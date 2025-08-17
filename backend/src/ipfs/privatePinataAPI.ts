import 'dotenv/config';
import { GetCIDResponse, PinataSDK, UploadResponse } from 'pinata';
import { PINATA_JWT, PINATA_GATEWAY_URL } from '../config.js';

const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT || 'Pinata JWT',
  pinataGateway: PINATA_GATEWAY_URL || 'Pinata Gateway Address',
});

async function uploadPrivateJSONObject(object: any): Promise<UploadResponse> {
  try {
    const fileName = object.id ? `${object.id}.json` : 'data.json';
    const data = await pinata.upload.json(object, {
      metadata: {
        name: fileName,
      },
    });
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function getPrivateJSONObject(cid: string): Promise<GetCIDResponse> {
  try {
    const file = await pinata.gateways.get(cid);
    if (!file) {
      throw new Error('Failed to get JSON object from IPFS');
    }
    return file;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function deletePrivateJSONObject(documentID: string): Promise<boolean> {
  try {
    const response = await pinata.files.delete([documentID]);

    if (!response || response.length === 0) {
      console.error(`Failed to delete document: ${documentID}`);
      return false;
    }

    console.log(`Successfully deleted document: ${documentID}`);
    return true;
  } catch (error) {
    console.error(`Error deleting document ${documentID} from Pinata:`, error);
    return false;
  }
}

export {
  deletePrivateJSONObject,
  getPrivateJSONObject,
  uploadPrivateJSONObject,
};
