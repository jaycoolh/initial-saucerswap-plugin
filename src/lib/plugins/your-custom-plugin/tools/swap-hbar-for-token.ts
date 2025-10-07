import BigNumber from "bignumber.js";
import {
  AccountId,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
} from "@hashgraph/sdk";
import {
  AccountResolver,
  handleTransaction,
  type Tool,
} from "hedera-agent-kit";

import {
  DEFAULT_DEADLINE_SECONDS,
  DEFAULT_SWAP_GAS,
  LedgerIdToBaseUrl,
  LedgerIdToRouterContractID,
} from "./constants";
import {
  swapHbarForTokenSchema,
  type SwapHbarForTokenParams,
} from "../schemas";
import {
  ensureTokenAssociation,
  fetchTokenInfoFromMirrorNode,
  requireClientLedger,
  resolveSwapPath,
} from "./utils";

export const SWAP_HBAR_FOR_TOKEN = "your-custom-plugin-swap_hbar_for_token";

export const swapHbarForTokenTool = (): Tool => ({
  method: SWAP_HBAR_FOR_TOKEN,
  name: "SaucerSwap HBAR to Token",
  description:
    "Swap HBAR for an HTS fungible token using SaucerSwap.\n\n" +
    "Parameters:\n" +
    "- hbarAmount (number, required) — HBAR input in whole units.\n" +
    "- minTokenAmount (number, required) — Minimum tokens expected (human-readable).\n" +
    "- tokenId (string, required) — Output HTS token ID.\n" +
    "- recipientAccountId (string, optional) ",
  parameters: swapHbarForTokenSchema,
  execute: async (client: Client, context, params: SwapHbarForTokenParams) => {
    try {
      const ledger = requireClientLedger(client);
      const routerId = LedgerIdToRouterContractID.get(ledger);
      if (!routerId) return "Unsupported Hedera network for SaucerSwap router.";

      const { hbarAmount, tokenId } = params;

      const mirrorNodeBaseUrl = LedgerIdToBaseUrl.get(ledger);
      if (!mirrorNodeBaseUrl) {
        throw new Error("Unsupported Hedera network for Mirror Node lookup.");
      }

      const tokenInfo = await fetchTokenInfoFromMirrorNode(
        mirrorNodeBaseUrl,
        tokenId.toString()
      );

      if (tokenInfo.type && tokenInfo.type !== "FUNGIBLE_COMMON")
        return "This token is not a Fungible Token";

      const recipientAccountId = AccountResolver.resolveAccount(
        params.recipientAccountId,
        context,
        client
      );

      await ensureTokenAssociation(
        client,
        context,
        recipientAccountId,
        tokenId
      );

      const path = resolveSwapPath(ledger, tokenId);

      const deadline = Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_SECONDS;

      // fetch the correct EVM address for recipient account id from mirrornode
      const recipientAccountEvmAddress = (
        await AccountId.fromString(
          recipientAccountId
        ).populateAccountEvmAddress(client)
      ).toEvmAddress();

      const functionParams = new ContractFunctionParameters()
        .addUint256(0) // TO DO: minimum output currently hardcoded to. Should query the estimated return from SC and then add slippage of ~1%
        .addAddressArray(path)
        .addAddress(recipientAccountEvmAddress)
        .addUint256(deadline);

      const tx = new ContractExecuteTransaction()
        .setContractId(routerId)
        .setGas(DEFAULT_SWAP_GAS)
        .setPayableAmount(new Hbar(hbarAmount))
        .setFunction("swapExactETHForTokens", functionParams);

      const result = await handleTransaction(tx, client, context);
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected error during SaucerSwap swap.";

      console.error(message);
      return {
        raw: { error: message },
        humanMessage: message,
      };
    }
  },
});
