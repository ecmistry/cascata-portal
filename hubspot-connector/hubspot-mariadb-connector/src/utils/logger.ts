type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as LogLevel;

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levels[level] >= levels[LOG_LEVEL];
}

function formatMessage(level: LogLevel, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

export const logger = {
  debug(message: string, data?: any) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, data));
    }
  },

  info(message: string, data?: any) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, data));
    }
  },

  warn(message: string, data?: any) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, data));
    }
  },

  error(message: string, error?: any) {
    if (shouldLog('error')) {
      const errorData = error instanceof Error 
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(formatMessage('error', message, errorData));
    }
  },
};
