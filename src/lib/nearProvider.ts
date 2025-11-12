import { providers } from "near-api-js";

export function createFailoverProvider() {
  const jsonProviders = [
    new providers.JsonRpcProvider({ url: "https://1rpc.io/near" }),
    new providers.JsonRpcProvider({ url: "https://free.rpc.fastnear.com" }),
    new providers.JsonRpcProvider({ url: "https://near.blockpi.network/v1/rpc/public" }),
    new providers.JsonRpcProvider({ url: "https://near.lava.build" }),
    new providers.JsonRpcProvider({ url: "https://near.api.pocket.network" }),
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
