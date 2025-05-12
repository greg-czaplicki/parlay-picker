import pino from 'pino';

// Configure Pino logger with redaction for sensitive fields
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: [
    'req.headers.authorization',
    'req.body.password',
    'req.body.token',
    'req.headers.cookie',
  ],
  // No transport: ensures compatibility with Next.js API/serverless environments
}); 