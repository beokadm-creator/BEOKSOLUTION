export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

const LOG_PREFIX = {
  DEBUG: '🔍',
  INFO: 'ℹ️',
  WARN: '⚠️',
  ERROR: '❌'
};

const getTimestamp = () => {
  return new Date().toISOString().split('T')[1].split('.')[0];
};

const shouldLog = (level: LogLevel) => {
  if (typeof window === 'undefined') return false;
  
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') {
    return level >= LogLevel.WARN;
  }
  
  const config = localStorage.getItem('log_level');
  if (config) {
    return level >= parseInt(config, 10);
  }
  
  return true;
};

const formatMessage = (context: string, message: string, data?: any) => {
  const timestamp = getTimestamp();
  const formatted = `[${timestamp}][${context}] ${message}`;
  return data ? { formatted, data } : { formatted };
};

export const logger = {
  debug: (context: string, message: string, data?: any) => {
    if (!shouldLog(LogLevel.DEBUG)) return;
    const { formatted, ...rest } = formatMessage(context, message, data);
    console.debug(`${LOG_PREFIX.DEBUG}`, formatted, ...(data ? [data] : []));
  },
  
  info: (context: string, message: string, data?: any) => {
    if (!shouldLog(LogLevel.INFO)) return;
    const { formatted, ...rest } = formatMessage(context, message, data);
    console.info(`${LOG_PREFIX.INFO}`, formatted, ...(data ? [data] : []));
  },
  
  warn: (context: string, message: string, data?: any) => {
    if (!shouldLog(LogLevel.WARN)) return;
    const { formatted, ...rest } = formatMessage(context, message, data);
    console.warn(`${LOG_PREFIX.WARN}`, formatted, ...(data ? [data] : []));
  },
  
  error: (context: string, message: string, error?: any) => {
    if (!shouldLog(LogLevel.ERROR)) return;
    const { formatted, ...rest } = formatMessage(context, message, error);
    console.error(`${LOG_PREFIX.ERROR}`, formatted, ...(error ? [error] : []));
  }
};

export const setLogLevel = (level: LogLevel) => {
  localStorage.setItem('log_level', level.toString());
};

export const disableLogging = () => {
  localStorage.setItem('log_level', LogLevel.NONE.toString());
};
