import { providers } from "near-api-js";

export function createFailoverProvider() {
  const jsonProviders = [
    new providers.JsonRpcProvider(
      { url: "https://1rpc.io/near" },
      {
        retries: 5,
        backoff: 2,
        wait: 1000,
      },
    ),
    new providers.JsonRpcProvider(
      { url: "https://free.rpc.fastnear.com" },
      {
        retries: 5,
        backoff: 2,
        wait: 1000,
      },
    ),
    new providers.JsonRpcProvider(
      { url: "https://near.blockpi.network/v1/rpc/public" },
      {
        retries: 5,
        backoff: 2,
        wait: 1000,
      },
    ),
    new providers.JsonRpcProvider(
      { url: "https://rpc.intea.rs" },
      {
        retries: 5,
        backoff: 2,
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
      { url: "https://endpoints.omniatech.io/v1/near/mainnet/public" },
      {
        retries: 5,
        backoff: 2,
        wait: 1000,
      },
    ),
    // Tatum has strict rate limits (5 req/min free tier), use conservative retry config
    new providers.JsonRpcProvider(
      { url: "https://near-mainnet.gateway.tatum.io/" },
      {
        retries: 2,
        backoff: 3,
        wait: 3000,
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
