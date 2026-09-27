import 'dotenv/config';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { handleGenerateRequest, sendJson } from './server/generate-handler.js';
import { publicSitePlugin } from './site/vite-plugin.js';

export default defineConfig({
  plugins: [react(), travelApiPlugin(), publicSitePlugin()],
  server: {
    port: 3000,
    strictPort: true,
  },
});

function travelApiPlugin() {
  return {
    name: 'travel-api',
    configureServer(server) {
      server.middlewares.use('/api/health', (_req, res) => {
        sendJson(res, 200, { ok: true, hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY) });
      });

      server.middlewares.use('/api/generate', (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        void handleGenerateRequest(req, res, { scope: 'vite/api/generate' });
      });
    },
  };
}
