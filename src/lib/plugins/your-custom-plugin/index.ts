import type { Plugin } from 'hedera-agent-kit';
import { buildYourCustomPluginTools } from './tools';

export const yourCustomPlugin: Plugin = {
    name: 'your-custom-plugin',
    version: '0.1.0',
    description: 'Custom Hedera tools including SaucerSwap HBAR-to-token swap.',
    tools: buildYourCustomPluginTools,
};

export { buildYourCustomPluginTools };
