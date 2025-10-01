# Video Chat App - Render Deployment

This is a full-stack video chat application that can be deployed on Render as a single web service.

## Project Structure
- `frontend/` - React frontend application
- `backend/` - Node.js/Express backend with Socket.io
- `package.json` - Root package.json for Render deployment

## Deployment on Render

### Option 1: Automatic Deployment (Recommended)
1. Connect your GitHub repository to Render
2. Render will automatically detect the `render.yaml` file
3. The app will build and deploy automatically

### Option 2: Manual Web Service
1. Create a new Web Service on Render
2. Connect your repository
3. Set the following:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Plan**: Free (or higher)

### Environment Variables
The app will automatically use Render's provided PORT environment variable. No additional configuration needed for basic deployment.

## Local Development

### Prerequisites
- Node.js 16+ and npm 8+

### Setup
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies  
cd frontend && npm install && cd ..

# Run in development mode (both frontend and backend)
npm run dev
```

### Available Scripts
- `npm start` - Start production server (serves built frontend + backend)
- `npm run build` - Build frontend for production
- `npm run dev` - Run both frontend and backend in development mode
- `npm test` - Run tests for both frontend and backend

## Features
- WebRTC video calling
- Room-based system with 6-character codes
- End-to-end encryption
- Mobile-optimized interface
- Socket.io real-time communication

## Tech Stack
- **Frontend**: React, Material-UI, Socket.io-client
- **Backend**: Node.js, Express, Socket.io
- **WebRTC**: PeerJS, Simple-peer
- **Security**: Helmet, CORS, Rate limiting