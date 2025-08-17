import 'dotenv/config';
import { PinataSDK, UnpinResponse, GetCIDResponse } from 'pinata-web3';

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT || 'Pinata JWT',
	pinataGateway: process.env.GATEWAY_URL || 'Pinata Gateway Address',
});

async function uploadPublicJSONObject(jsonString: object) {
	try {
		await pinata.upload.json(jsonString).then((data) => {
			console.log(data);
			return data;
		});
	} catch (error) {
		console.log(error);
	}
}

async function getPublicJSONObject(
	cid: string
): Promise<GetCIDResponse | undefined> {
	try {
		const file = await pinata.gateways.get(cid).then((data) => {
			console.log(data);
			return data;
		});
		return file;
	} catch (error) {
		console.log(error);
	}
}

async function deletePublicJSONObject(
	cid: string
): Promise<UnpinResponse[] | undefined> {
	try {
		const unpin = await pinata.unpin([cid]).then((data) => {
			console.log(data);
			return data;
		});
		return unpin;
	} catch (error) {
		console.log(error);
	}
}

export { uploadPublicJSONObject, getPublicJSONObject, deletePublicJSONObject };
