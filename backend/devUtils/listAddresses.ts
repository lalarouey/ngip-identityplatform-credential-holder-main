import { listIdentifiers } from 'src/identifiers.js';
import { getEthAddress } from 'src/utils.js';

async function listAddresses() {
  await listIdentifiers()
    .then(identifiers => {
      identifiers.forEach(async identifier => {
        const ethrAddress = await getEthAddress(identifier.did);
        console.log(
          '\nalias: ',
          identifier.alias,
          '\nDID: ',
          identifier.did,
          '\nEthereum Address: ',
          ethrAddress,
        );
      });
    })
    .catch(error => {
      console.error('Error fetching identifiers:', error);
    });
}

await listAddresses();
