import { z } from "zod";

export const swapHbarForTokenSchema = z.object({
  hbarAmount: z
    .number()
    .gt(0)
    .describe("HBAR amount to spend, in whole HBAR (decimals allowed)."),
  tokenId: z
    .string()
    .min(3)
    .describe("HTS token ID to receive, e.g. 0.0.12345."),
  recipientAccountId: z
    .string()
    .min(3)
    .optional()
    .describe(
      "Optional recipient Hedera AccountId. Defaults to the active account."
    ),
});

export type SwapHbarForTokenParams = z.infer<typeof swapHbarForTokenSchema>;
