import { refreshTripWeather } from './deepseek.js';
import { readJsonBody, sendJson } from './generate-handler.js';
import { createRateLimitError, logApiError, reserveGenerateRequest, toPublicApiError } from './request-guard.js';

export async function handleWeatherRequest(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }
  let reservation;
  try {
    const body = await readJsonBody(req);
    reservation = reserveGenerateRequest(req, { scope: 'weather', maxRequests: 30 });
    if (!reservation.allowed) throw createRateLimitError(reservation.retryAfterSeconds);
    // Weather attempts use a separate quota, including failures, to bound upstream traffic.
    reservation.commit();
    const weather = await refreshTripWeather(body);
    sendJson(res, 200, weather);
  } catch (error) {
    reservation?.release();
    if (error?.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));
    logApiError('api/weather', error);
    const publicError = toPublicApiError(error, '天气更新失败，请稍后重试。');
    sendJson(res, publicError.status, publicError.body);
  }
}
