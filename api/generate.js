import { handleGenerateRequest, sendJson } from '../server/generate-handler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  await handleGenerateRequest(req, res, { scope: 'api/generate' });
}
