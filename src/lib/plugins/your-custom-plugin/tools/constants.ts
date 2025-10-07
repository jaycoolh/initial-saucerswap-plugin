import { LedgerId } from "@hashgraph/sdk";

export const LedgerIdToRouterContractID: Map<LedgerId, string> = new Map([
  [LedgerId.TESTNET, "0.0.19264"],
  [LedgerId.MAINNET, "0.0.3045981"],
]);

export const LedgerIdToWHbarID: Map<LedgerId, string> = new Map([
  [LedgerId.TESTNET, "0.0.15058"],
  [LedgerId.MAINNET, "0.0.1456986"],
]);

export const DEFAULT_SWAP_GAS = 400_000;
export const DEFAULT_DEADLINE_SECONDS = 300;

export const LedgerIdToBaseUrl: Map<LedgerId, string> = new Map([
  [LedgerId.MAINNET, "https://mainnet-public.mirrornode.hedera.com/api/v1"],
  [LedgerId.TESTNET, "https://testnet.mirrornode.hedera.com/api/v1"],
]);
