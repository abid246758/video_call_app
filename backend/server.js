const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const app = express();

// Security middleware - optimized for mobile
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      mediaSrc: ["'self'", "blob:", "mediastream:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    },
  },
  crossOriginEmbedderPolicy: false, // Allow WebRTC
}));

// Rate limiting - more generous for mobile users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased for mobile users
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true, // Fix for X-Forwarded-For header
});
app.use(limiter);

// CORS configuration - optimized for mobile
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com', 'https://www.yourdomain.com']
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '5mb' })); // Reduced for mobile
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Create HTTP server
const server = http.createServer(app);

// Socket.io configuration - optimized for mobile
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://yourdomain.com', 'https://www.yourdomain.com']
      : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true
  },
  transports: ['websocket', 'polling'], // Polling for mobile compatibility
  pingTimeout: 30000, // Reduced for mobile
  pingInterval: 15000, // More frequent pings for mobile
  allowEIO3: true, // Backward compatibility
  upgradeTimeout: 10000, // Faster upgrade timeout
  maxHttpBufferSize: 1e6, // 1MB buffer for mobile
});

// Store active users and rooms
const activeUsers = new Map();
const activeRooms = new Map();
const roomTimers = new Map(); // Track room expiry timers

// Room structure: { id, users: [user1, user2], createdAt, maxUsers: 2, code: 'ABC123' }
// Generate simple 6-character codes for easy mobile input
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

io.on('connection', (socket) => {
  console.log(`👤 User connected: ${socket.id}`);

  // Store user connection
  activeUsers.set(socket.id, {
    id: socket.id,
    name: '',
    roomId: null,
    connectedAt: new Date()
  });

  // Send user their ID
  socket.emit('me', socket.id);

  // Handle user registration
  socket.on('register', ({ name }) => {
    if (activeUsers.has(socket.id)) {
      activeUsers.get(socket.id).name = name;
      console.log(`📝 User ${socket.id} registered as: ${name}`);
    }
  });

  // Handle create room - simplified for mobile
  socket.on('createRoom', ({ name }) => {
    console.log(`🏠 ${name} (${socket.id}) creating room`);

    // Generate a simple 6-character code
    let roomCode;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
    } while (activeRooms.has(roomCode) && attempts < 10);

    if (attempts >= 10) {
      socket.emit('roomError', { message: 'Unable to generate room code. Please try again.' });
      return;
    }

    // Create new room with simple code
    const room = {
      id: roomCode,
      code: roomCode,
      users: [socket.id],
      createdAt: new Date(),
      maxUsers: 2,
      createdBy: socket.id,
      createdByName: name
    };

    activeRooms.set(roomCode, room);
    socket.join(roomCode);

    // Clear any existing timer for this room
    if (roomTimers.has(roomCode)) {
      clearTimeout(roomTimers.get(roomCode));
      roomTimers.delete(roomCode);
    }

    // Update user's room
    if (activeUsers.has(socket.id)) {
      activeUsers.get(socket.id).roomId = roomCode;
    }

    socket.emit('roomCreated', {
      roomId: roomCode,
      roomCode: roomCode,
      message: 'Room created successfully',
      shareUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}?room=${roomCode}`
    });
    console.log(`✅ Room ${roomCode} created by ${socket.id}. Total rooms: ${activeRooms.size}`);
  });

  // Handle join room - improved for mobile
  socket.on('joinRoom', ({ roomCode, name }) => {
    console.log(`🚪 ${name} (${socket.id}) attempting to join room: ${roomCode}`);

    // Normalize room code (uppercase, trim)
    const normalizedCode = roomCode.toUpperCase().trim();

    if (!activeRooms.has(normalizedCode)) {
      console.log(`❌ Room ${normalizedCode} does not exist. Available rooms:`, Array.from(activeRooms.keys()));
      socket.emit('roomError', {
        message: 'Room code not found. Please check the code and try again.',
        code: 'ROOM_NOT_FOUND'
      });
      return;
    }

    const room = activeRooms.get(normalizedCode);

    if (room.users.length >= room.maxUsers) {
      socket.emit('roomError', {
        message: 'Room is full (maximum 2 people)',
        code: 'ROOM_FULL'
      });
      return;
    }

    // Join room
    room.users.push(socket.id);
    socket.join(normalizedCode);

    // Clear any existing timer for this room (room is now active with 2 users)
    if (roomTimers.has(normalizedCode)) {
      clearTimeout(roomTimers.get(normalizedCode));
      roomTimers.delete(normalizedCode);
    }

    // Update user's room
    if (activeUsers.has(socket.id)) {
      activeUsers.get(socket.id).roomId = normalizedCode;
    }

    // Notify existing user in room
    socket.to(normalizedCode).emit('userJoined', {
      userId: socket.id,
      name,
      message: `${name} joined the room`,
      roomCode: normalizedCode
    });

    socket.emit('roomJoined', {
      roomId: normalizedCode,
      roomCode: normalizedCode,
      message: 'Successfully joined room',
      otherUser: room.users.length > 1 ? room.users.find(id => id !== socket.id) : null,
      createdBy: room.createdByName
    });

    console.log(`✅ ${socket.id} joined room ${normalizedCode}. Users: ${room.users.length}/2`);
  });

  // Handle call initiation (when both users are in room)
  socket.on('callUser', ({ userToCall, signalData, from, name }) => {
    console.log(`📞 ${name} (${from}) calling ${userToCall}`);
    io.to(userToCall).emit('callUser', {
      signal: signalData,
      from,
      name,
      callerId: from
    });
  });

  // Handle call answer
  socket.on('answerCall', ({ signal, to }) => {
    console.log(`✅ ${socket.id} answering call from ${to}`);
    io.to(to).emit('callAccepted', { signal });
  });

  // Handle call rejection
  socket.on('rejectCall', ({ to }) => {
    console.log(`❌ ${socket.id} rejected call from ${to}`);
    io.to(to).emit('callRejected', { reason: 'Call rejected' });
  });

  // Handle call end
  socket.on('endCall', ({ to }) => {
    console.log(`📴 ${socket.id} ending call with ${to}`);

    if (to) {
      io.to(to).emit('callEnded');
    }
  });

  // Handle screen sharing events
  socket.on('screenShareStarted', ({ from, name, roomId }) => {
    console.log(`🖥️ ${name} (${from}) started screen sharing in room ${roomId}`);

    // Notify other users in the room
    socket.to(roomId).emit('screenShareStarted', {
      from,
      name,
      roomId
    });
  });

  socket.on('screenShareStopped', ({ from, name, roomId }) => {
    console.log(`🖥️ ${name} (${from}) stopped screen sharing in room ${roomId}`);

    // Notify other users in the room
    socket.to(roomId).emit('screenShareStopped', {
      from,
      name,
      roomId
    });
  });

  // Handle signaling during call
  socket.on('signal', ({ signal, to }) => {
    io.to(to).emit('signal', { signal, from: socket.id });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`👋 User disconnected: ${socket.id}`);

    const user = activeUsers.get(socket.id);
    if (user && user.roomId) {
      const room = activeRooms.get(user.roomId);
      if (room) {
        // Remove user from room
        room.users = room.users.filter(id => id !== socket.id);

        // Notify other user in room
        socket.to(user.roomId).emit('userLeft', {
          userId: socket.id,
          message: 'User left the room'
        });

        // If room becomes empty, delete it immediately
        if (room.users.length === 0) {
          console.log(`🗑️ Room ${user.roomId} deleted (empty)`);
          activeRooms.delete(user.roomId);
        } else if (room.users.length === 1) {
          // If only 1 user left, set a timer to expire the room after 2 minutes (mobile users need more time)
          console.log(`⏰ Room ${user.roomId} will expire in 2 minutes (1 user left)`);

          // Clear any existing timer
          if (roomTimers.has(user.roomId)) {
            clearTimeout(roomTimers.get(user.roomId));
          }

          // Set a timer to expire the room
          const timer = setTimeout(() => {
            const currentRoom = activeRooms.get(user.roomId);
            if (currentRoom && currentRoom.users.length === 1) {
              console.log(`🗑️ Room ${user.roomId} expired after timeout`);

              // Notify remaining user that room expired
              io.to(currentRoom.users[0]).emit('roomExpired', {
                message: 'Room expired due to inactivity. Please create a new room.',
                roomCode: user.roomId
              });

              // Delete room and timer
              activeRooms.delete(user.roomId);
              roomTimers.delete(user.roomId);
            }
          }, 120000); // 2 minutes delay for mobile users

          roomTimers.set(user.roomId, timer);
        }
      }
    }

    activeUsers.delete(socket.id);
  });
});

// Health check endpoint - mobile optimized
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    activeRooms: activeRooms.size,
    version: '2.0.0-mobile',
    features: ['room-codes', 'mobile-optimized', 'webrtc'],
    rooms: Array.from(activeRooms.values()).map(room => ({
      id: room.id,
      code: room.code,
      userCount: room.users.length,
      maxUsers: room.maxUsers,
      createdAt: room.createdAt,
      createdBy: room.createdByName
    }))
  });
});

// Get active rooms - mobile optimized
app.get('/api/rooms', (req, res) => {
  res.json({
    rooms: Array.from(activeRooms.values()).map(room => ({
      id: room.id,
      code: room.code,
      userCount: room.users.length,
      maxUsers: room.maxUsers,
      createdAt: room.createdAt,
      createdBy: room.createdByName
    }))
  });
});

// Mobile app manifest endpoint
app.get('/manifest.json', (req, res) => {
  res.json({
    name: "VideoCall Mobile",
    short_name: "VideoCall",
    description: "Simple video calling with room codes",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#6366f1",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const frontendPath = path.join(__dirname, '../frontend/build');

  // Serve frontend if build directory exists
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));

    // Catch all handler: send back React's index.html file for any non-API routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
    console.log(`📁 Serving frontend from: ${frontendPath}`);
  } else {
    console.log('⚠️  Frontend build directory not found. Run "npm run build" first.');
  }
}

const PORT = process.env.PORT || 4001;

server.listen(PORT, () => {
  console.log(`🚀 Room-based Video Call Server running on port ${PORT}`);
  console.log(`🏠 Room system with 2-person limit enabled`);
  console.log(`🛡️  Security middleware active`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { app, server, io };