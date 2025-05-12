declare module 'next-logger' {
  interface Logger {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  }
  interface LoggerRequest extends Request {
    logger?: Logger;
  }
} 