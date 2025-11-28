import { providers } from "near-api-js";

export function createFailoverProvider() {
  const jsonProviders = [
    // TIER 1: Unlimited providers - Aggressive retries for maximum reliability
    new providers.JsonRpcProvider(
      { url: "https://free.rpc.fastnear.com" },
      {
        retries: 5,
        backoff: 2, // Exponential: 1s, 2s, 4s, 8s, 16s
        wait: 1000,
      },
    ),
    new providers.JsonRpcProvider(
      { url: "https://near.lava.build:443" },
      {
        retries: 5,
        backoff: 2,
        wait: 1000,
      },
    ),
    new providers.JsonRpcProvider(
      { url: "https://near.rpc.grove.city/v1/01fdb492" },
      {
        retries: 5,
        backoff: 2,
        wait: 1000,
      },
    ),

    // TIER 2: High capacity providers - Moderate retries
    new providers.JsonRpcProvider(
      { url: "https://near.drpc.org" },
      {
        retries: 4,
        backoff: 2,
        wait: 1000,
      },
    ),
    new providers.JsonRpcProvider(
      { url: "https://near.blockpi.network/v1/rpc/public" },
      {
        retries: 4,
        backoff: 2,
        wait: 1000,
      },
    ),

    // TIER 3: Moderate capacity - Conservative retries
    new providers.JsonRpcProvider(
      { url: "https://1rpc.io/near" },
      {
        retries: 3,
        backoff: 2,
        wait: 1500,
      },
    ),

    // TIER 4: Unknown/limited capacity - Very conservative
    new providers.JsonRpcProvider(
      { url: "https://endpoints.omniatech.io/v1/near/mainnet/public" },
      {
        retries: 2,
        backoff: 3,
        wait: 2000,
      },
    ),
    new providers.JsonRpcProvider(
      { url: "https://rpc.intea.rs" },
      {
        retries: 2,
        backoff: 3,
        wait: 2000,
      },
    ),

    // TIER 5: Strict rate limits (5 req/min) - Last resort with minimal retries
    new providers.JsonRpcProvider(
      { url: "https://near-mainnet.gateway.tatum.io/" },
      {
        retries: 1,
        backoff: 4,
        wait: 5000,
      },
    ),
  ];

  return new providers.FailoverRpcProvider(jsonProviders);
}

let providerInstance: ReturnType<typeof createFailoverProvider> | null = null;

export function getSharedProvider() {
  if (!providerInstance) {
    providerInstance = createFailoverProvider();
  }
  return providerInstance;
}
