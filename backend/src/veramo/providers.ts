import Bottleneck from 'bottleneck';
import { JsonRpcProvider } from 'ethers';
import { alchemyApiKey, infuraApiKey } from '../config.js';

// --- Rate-limited provider ---
const limiter = new Bottleneck({ minTime: 200, maxConcurrent: 1 });

class RateLimitedProvider extends JsonRpcProvider {
  async send(method: string, params: any[]): Promise<any> {
    return limiter.schedule(() => super.send(method, params));
  }
}

let providerUrl: string | null = null;

if (alchemyApiKey) {
  providerUrl = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
} else if (infuraApiKey) {
  providerUrl = `https://sepolia.infura.io/v3/${infuraApiKey}`;
}

if (!providerUrl) {
  throw Error(
    'No Ethereum provider configured. Set ALCHEMY_API_KEY or INFURA_PROJECT_ID in your .env file.',
  );
}

export const ethSepoliaProvider = new RateLimitedProvider(
  providerUrl,
  {
    name: 'sepolia',
    chainId: 11155111,
  },
  {
    staticNetwork: true,
  },
);
