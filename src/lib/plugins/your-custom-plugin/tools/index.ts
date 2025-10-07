import type { Context, Tool } from 'hedera-agent-kit';
import { swapHbarForTokenTool, SWAP_HBAR_FOR_TOKEN } from './swap-hbar-for-token';

export const yourCustomPluginToolNames = {
    SWAP_HBAR_FOR_TOKEN,
} as const;

export const buildYourCustomPluginTools = (_context?: Context): Tool[] => {
    void _context;
    return [swapHbarForTokenTool()];
};

export { swapHbarForTokenTool };
