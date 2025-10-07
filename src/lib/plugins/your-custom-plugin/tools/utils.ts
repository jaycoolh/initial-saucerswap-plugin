import BigNumber from "bignumber.js";
import {
  AccountId,
  Client,
  LedgerId,
  TokenAssociateTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { AgentMode, handleTransaction, type Context } from "hedera-agent-kit";
import { LedgerIdToBaseUrl, LedgerIdToWHbarID } from "./constants";

type MirrorNodeTokenInfo = {
  type?: string;
  decimals?: string;
};

export const fetchTokenInfoFromMirrorNode = async (
  baseUrl: string,
  tokenId: string
): Promise<{ type?: string; decimals: number }> => {
  const response = await fetch(`${baseUrl}/tokens/${tokenId}`);
  if (!response.ok) {
    const errorBody = (await response.text()).trim().slice(0, 200);
    const errorDetails = errorBody ? ` ${errorBody}` : "";
    throw new Error(
      `Mirror Node token lookup failed (${response.status}).${errorDetails}`
    );
  }

  const data = (await response.json()) as MirrorNodeTokenInfo;
  if (!data.decimals) {
    throw new Error("Mirror Node token info missing numeric decimals.");
  }

  return { type: data.type, decimals: Number(data.decimals) };
};

export const requireClientLedger = (client: Client): LedgerId => {
  const ledger = (client as { ledgerId?: LedgerId }).ledgerId;
  if (!ledger) {
    throw new Error("Unable to determine Hedera network from client.");
  }
  return ledger;
};

type MirrorNodeAccountTokensResponse = {
  tokens?: Array<{ token_id?: string | null }>;
  balances?: Array<{ token_id?: string | null }>;
};

type MirrorNodeAccountResponse = {
  max_automatic_token_associations?: number | null;
};

const fetchFromMirrorNode = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const errorBody = (await response.text()).trim().slice(0, 200);
    const errorDetails = errorBody ? ` ${errorBody}` : "";
    throw new Error(
      `Mirror Node request failed (${response.status}).${errorDetails}`
    );
  }
  return (await response.json()) as T;
};

const mirrorNodeAccountHasToken = async (
  baseUrl: string,
  accountId: string,
  tokenId: string
) => {
  const params = new URLSearchParams({ "token.id": tokenId, limit: "1" });
  const data = await fetchFromMirrorNode<MirrorNodeAccountTokensResponse>(
    `${baseUrl}/accounts/${accountId}/tokens?${params.toString()}`
  );

  const relationships = Array.isArray(data.tokens)
    ? data.tokens
    : Array.isArray(data.balances)
    ? data.balances
    : [];

  return relationships.some((entry) => entry.token_id === tokenId);
};

const mirrorNodeAccountMaxAutoAssociations = async (
  baseUrl: string,
  accountId: string
) => {
  const data = await fetchFromMirrorNode<MirrorNodeAccountResponse>(
    `${baseUrl}/accounts/${accountId}`
  );
  const value = data.max_automatic_token_associations;
  return typeof value === "number" ? value : 0;
};

export const ensureTokenAssociation = async (
  client: Client,
  context: Context,
  accountId: string,
  tokenId: string
) => {
  const ledger = requireClientLedger(client);
  const mirrorNodeBaseUrl = LedgerIdToBaseUrl.get(ledger);
  if (!mirrorNodeBaseUrl) {
    throw new Error("Unsupported Hedera network for Mirror Node lookup.");
  }

  const [isAssociated, maxAutoAssociations] = await Promise.all([
    mirrorNodeAccountHasToken(mirrorNodeBaseUrl, accountId, tokenId),
    mirrorNodeAccountMaxAutoAssociations(mirrorNodeBaseUrl, accountId),
  ]);

  const hasUnlimitedAutoAssociations = maxAutoAssociations === -1;

  if (isAssociated || hasUnlimitedAutoAssociations) {
    return;
  }

  if (context.mode === AgentMode.RETURN_BYTES) {
    throw new Error(
      "Recipient account lacks token association. Please associate the token before requesting RETURN_BYTES."
    );
  }

  const associateTx = new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([tokenId])
    .setTransactionMemo("Auto-associate for SaucerSwap");

  const associationResult = await handleTransaction(
    associateTx,
    client,
    context,
    (response) =>
      `Associated token ${tokenId.toString()} with account ${accountId.toString()}. Status: ${
        response.status
      }.`
  );

  if ("raw" in associationResult) {
    if (associationResult.raw.status !== "SUCCESS") {
      throw new Error(
        `Token association failed: ${associationResult.raw.status}`
      );
    }
    return;
  }

  throw new Error("Unexpected RETURN_BYTES result while associating token.");
};

export const resolveSwapPath = (ledger: LedgerId, tokenId: string) => {
  const whbarId = LedgerIdToWHbarID.get(ledger);
  if (!whbarId) {
    throw new Error("Unsupported Hedera network for WHBAR mapping.");
  }

  return [
    TokenId.fromString(whbarId).toEvmAddress(),
    TokenId.fromString(tokenId).toEvmAddress(),
  ];
};
