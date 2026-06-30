import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

// Custom text format for development/console console logs
const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `[EMERALD-CORE] [${timestamp}] ${level}: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  transports: [
    // Write telemetry errors to standard file logger
    new winston.transports.File({ 
      filename: 'logs/telemetry.log',
      level: 'info' 
    }),
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        consoleFormat
      )
    })
  ]
});

export default logger;
