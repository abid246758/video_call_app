require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 4001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  encryptionKey: process.env.ENCRYPTION_KEY || 'your-32-character-encryption-key',
  
  // CORS Origins
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'],
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // SSL Configuration
  ssl: {
    certPath: process.env.SSL_CERT_PATH,
    keyPath: process.env.SSL_KEY_PATH
  },
  
  // Socket.io Configuration
  socketio: {
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
  }
};

module.exports = config;
