const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Log dizinini oluştur
const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Özel format
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        return `[${timestamp}] ${level.toUpperCase()}: ${stack || message}`;
    })
);

// Logger oluştur
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        // Tüm logları combined.log'a yaz
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // Sadece hataları error.log'a yaz
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});

// Development ortamında console'a da yaz
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            customFormat
        )
    }));
}

// HTTP Request Logger Middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

        logger[logLevel](`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - IP: ${req.ip}`);
    });

    next();
};

// Error Logger Middleware
const errorLogger = (err, req, res, next) => {
    logger.error(`${req.method} ${req.originalUrl} - Error: ${err.message}`, {
        stack: err.stack,
        body: req.body,
        params: req.params,
        query: req.query,
        ip: req.ip
    });
    next(err);
};

module.exports = {
    logger,
    requestLogger,
    errorLogger
};
