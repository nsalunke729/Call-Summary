import { logger } from './logger.js';

let _sentry = null;

export async function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const sentry = await import('@sentry/node');
    sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV || 'production',
    });
    _sentry = sentry;
    logger.info('Sentry initialised', { environment: process.env.NODE_ENV || 'production' });
  } catch (err) {
    logger.error('Sentry failed to initialise', { error: err.message });
  }
}

export function captureException(err, context = {}) {
  if (!_sentry) return;
  _sentry.captureException(err, { extra: context });
}
