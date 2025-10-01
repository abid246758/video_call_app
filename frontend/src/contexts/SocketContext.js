import React, { createContext, useState, useRef, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';

const SocketContext = createContext();

// Socket connection
const createSocketConnection = () => {
  let token = localStorage.getItem('authToken');
  if (!token) {
    token = uuidv4();
    localStorage.setItem('authToken', token);
  }
  
  return io(process.env.REACT_APP_SERVER_URL || 'http://localhost:4001', {
    transports: ['websocket', 'polling'],
    timeout: 20000,
    forceNew: true
  });
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [stream, setStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [name, setName] = useState('');
  const [call, setCall] = useState({});
  const [me, setMe] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomError, setRoomError] = useState(null);
  const [otherUser, setOtherUser] = useState(null);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  // Initialize socket connection
  useEffect(() => {
    const newSocket = createSocketConnection();
    setSocket(newSocket);

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Connected to server with ID:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server. Reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionError(`Connection failed: ${error.message}`);
      setIsConnected(false);
    });

    // Socket event handlers
    newSocket.on('me', (id) => {
      setMe(id);
      console.log('My ID:', id);
    });

    newSocket.on('roomCreated', ({ roomId, message }) => {
      console.log('🏠 Room created successfully:', roomId, message);
      setCurrentRoom(roomId);
      setRoomError(null);
      setOtherUser(null);
    });

    newSocket.on('roomJoined', ({ roomId, message, otherUser }) => {
      console.log('🚪 Room joined successfully:', roomId, message);
      setCurrentRoom(roomId);
      setRoomError(null);
      if (otherUser) {
        setOtherUser(otherUser);
      }
    });

    newSocket.on('roomError', ({ message }) => {
      console.error('❌ Room error:', message);
      setRoomError(message);
    });

    newSocket.on('roomExpired', ({ message }) => {
      console.log('🗑️ Room expired:', message);
      setCurrentRoom(null);
      setOtherUser(null);
      setCall({});
      setCallAccepted(false);
      setCallEnded(false);
      setRoomError('Room expired. Please create a new room.');
    });

    newSocket.on('userJoined', ({ userId, name, message }) => {
      console.log('👥 User joined:', name, '(', userId, ')');
      setOtherUser(userId);
    });

    newSocket.on('userLeft', ({ userId, message }) => {
      console.log('👋 User left:', userId);
      setOtherUser(null);
      setCall({});
      setCallAccepted(false);
      setCallEnded(false);
    });

    newSocket.on('callUser', ({ signal, from, name, callerId }) => {
      console.log('📞 Incoming call from:', name, '(', from, ')');
      setCall({ 
        isReceivingCall: true, 
        from, 
        name, 
        signal,
        callerId
      });
    });

    newSocket.on('callAccepted', ({ signal }) => {
      console.log('✅ Call accepted');
      setCallAccepted(true);
      connectionRef.current?.signal(signal);
    });

    newSocket.on('callRejected', ({ reason }) => {
      console.log('❌ Call rejected:', reason);
      setCall({});
      setCallAccepted(false);
      setCallEnded(false);
    });

    newSocket.on('callEnded', () => {
      console.log('📴 Call ended');
      leaveCall();
    });

    newSocket.on('signal', ({ signal, from }) => {
      if (connectionRef.current && !connectionRef.current.destroyed) {
        try {
          connectionRef.current.signal(signal);
        } catch (error) {
          console.error('❌ Error signaling peer:', error);
        }
      }
    });

    return () => {
      // Clean up peer connection
      if (connectionRef.current) {
        connectionRef.current.destroy();
        connectionRef.current = null;
      }
      
      // Clean up media streams
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      
      // Close socket
      newSocket.close();
    };
  }, []);

  // Get user media
  useEffect(() => {
    const getUserMedia = async () => {
      try {
        const currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }, 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setConnectionError('Unable to access camera/microphone. Please check permissions.');
      }
    };

    getUserMedia();
  }, []);

  // Register user with name
  const registerUser = (userName) => {
    if (socket) {
      socket.emit('register', { name: userName });
      setName(userName);
    }
  };

  // Create room
  const createRoom = (roomId) => {
    if (socket && socket.connected) {
      console.log('🏠 Creating room:', roomId, 'with name:', name);
      // Clear any previous room errors
      setRoomError(null);
      // Don't set current room immediately - wait for backend confirmation
      socket.emit('createRoom', { roomId, name });
      console.log('📤 createRoom event emitted');
    } else {
      console.error('❌ Cannot create room: Socket not connected', { socket: !!socket, connected: socket?.connected });
      setRoomError('Connection not ready. Please try again.');
    }
  };

  // Join room
  const joinRoom = (roomId) => {
    if (socket && socket.connected) {
      console.log('🚪 Joining room:', roomId, 'with name:', name);
      console.log('🔍 Socket state:', { connected: socket.connected, id: socket.id });
      // Clear any previous room errors
      setRoomError(null);
      // Don't set current room immediately - wait for backend confirmation
      socket.emit('joinRoom', { roomId, name });
    } else {
      console.error('❌ Cannot join room: Socket not connected', { socket: !!socket, connected: socket?.connected });
      setRoomError('Connection not ready. Please try again.');
    }
  };

  // Call user
  const callUser = (id) => {
    if (!stream) {
      console.error('❌ Cannot call: No stream available');
      return;
    }

    // Clean up existing peer
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }

    console.log('📞 Calling user:', id);
    
    // Ensure we have a valid stream
    const currentStream = (isScreenSharing && screenStream) ? screenStream : stream;
    
    console.log('🔍 Stream validation:', {
      stream: !!stream,
      screenStream: !!screenStream,
      isScreenSharing,
      currentStream: !!currentStream,
      hasGetTracks: currentStream && !!currentStream.getTracks
    });
    
    if (!currentStream || !currentStream.getTracks) {
      console.error('❌ Invalid stream for peer connection');
      return;
    }
    
    const peer = new Peer({ 
      initiator: true, 
      trickle: false, 
      objectMode: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    
    // Add stream after peer creation
    if (currentStream) {
      peer.addStream(currentStream);
    }

    peer.on('signal', (data) => {
      if (socket && !peer.destroyed) {
        socket.emit('callUser', { 
          userToCall: id, 
          signalData: data, 
          from: me, 
          name 
        });
      }
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });

    peer.on('error', (err) => {
      console.error('❌ Peer error:', err);
    });

    peer.on('close', () => {
      console.log('🔌 Peer connection closed');
    });

    // Remove existing callAccepted listener to prevent duplicates
    socket.off('callAccepted');
    socket.on('callAccepted', ({ signal }) => {
      if (peer && !peer.destroyed) {
        setCallAccepted(true);
        peer.signal(signal);
      }
    });

    connectionRef.current = peer;
  };

  // Answer call
  const answerCall = () => {
    if (!stream) {
      console.error('❌ Cannot answer: No stream available');
      return;
    }

    // Clean up existing peer
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }

    setCallAccepted(true);

    // Ensure we have a valid stream
    const currentStream = (isScreenSharing && screenStream) ? screenStream : stream;
    
    if (!currentStream || !currentStream.getTracks) {
      console.error('❌ Invalid stream for peer connection');
      return;
    }
    
    const peer = new Peer({ 
      initiator: false, 
      trickle: false, 
      objectMode: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });
    
    // Add stream after peer creation
    if (currentStream) {
      peer.addStream(currentStream);
    }

    peer.on('signal', (data) => {
      if (socket && !peer.destroyed) {
        socket.emit('answerCall', { signal: data, to: call.from });
      }
    });

    peer.on('stream', (currentStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });

    peer.on('error', (err) => {
      console.error('❌ Peer error:', err);
    });

    peer.on('close', () => {
      console.log('🔌 Peer connection closed');
    });

    if (call.signal && !peer.destroyed) {
      peer.signal(call.signal);
    }
    
    connectionRef.current = peer;
  };

  // Reject call
  const rejectCall = () => {
    socket.emit('rejectCall', { to: call.from });
    setCall({});
  };

  // Leave call
  const leaveCall = () => {
    setCallEnded(true);
    setCallAccepted(false);
    
    if (connectionRef.current) {
      connectionRef.current.destroy();
      connectionRef.current = null;
    }
    
    // Clean up video streams
    if (userVideo.current) {
      userVideo.current.srcObject = null;
    }
    
    if (socket) {
      socket.emit('endCall', { to: call.from });
    }
    
    // Reset call state
    setCall({});
    setCallEnded(false);
    setOtherUser(null);
    setCurrentRoom(null);
  };

  // Toggle mute
  const toggleMute = () => {
    try {
      console.log('🔇 Toggle mute called, stream:', !!stream);
      if (stream && stream.getAudioTracks && stream.getAudioTracks().length > 0) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          setIsMuted(!audioTrack.enabled);
          console.log('🔇 Mute toggled:', !audioTrack.enabled);
        }
      } else {
        console.warn('⚠️ No audio track available for muting. Stream:', stream);
      }
    } catch (error) {
      console.error('❌ Error toggling mute:', error);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    try {
      console.log('📹 Toggle video called, stream:', !!stream);
      if (stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          setIsVideoOff(!videoTrack.enabled);
          console.log('📹 Video toggled:', !videoTrack.enabled);
        }
      } else {
        console.warn('⚠️ No video track available for toggling. Stream:', stream);
      }
    } catch (error) {
      console.error('❌ Error toggling video:', error);
    }
  };

  // Toggle screen share
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        
        setScreenStream(screenStream);
        setIsScreenSharing(true);
        
        // Replace video track in the peer connection
        if (connectionRef.current && !connectionRef.current.destroyed) {
          const videoTrack = screenStream.getVideoTracks()[0];
          if (videoTrack) {
            const sender = connectionRef.current.getSenders().find(
              s => s.track && s.track.kind === 'video'
            );
            
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          }
        }
        
        // Update local video display
        if (myVideo.current) {
          myVideo.current.srcObject = screenStream;
        }
        
        // Handle screen share end
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopScreenShare();
          };
        }
        
        console.log('🖥️ Screen sharing started');
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('❌ Screen share error:', error);
    }
  };

  // Stop screen share
  const stopScreenShare = () => {
    try {
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
        setIsScreenSharing(false);
        
        // Restore camera stream
        if (myVideo.current && stream) {
          myVideo.current.srcObject = stream;
        }
        
        // Replace video track back to camera
        if (connectionRef.current && !connectionRef.current.destroyed && stream) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const sender = connectionRef.current.getSenders().find(
              s => s.track && s.track.kind === 'video'
            );
            
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          }
        }
        
        console.log('🖥️ Screen sharing stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping screen share:', error);
    }
  };

  // Reconnect socket
  const reconnect = () => {
    if (socket) {
      socket.disconnect();
      const newSocket = createSocketConnection();
      setSocket(newSocket);
    }
  };

  const value = {
    socket,
    call,
    callAccepted,
    myVideo,
    userVideo,
    stream,
    screenStream,
    name,
    setName,
    callEnded,
    me,
    isConnected,
    connectionError,
    isMuted,
    isVideoOff,
    isScreenSharing,
    currentRoom,
    roomError,
    otherUser,
    callUser,
    answerCall,
    rejectCall,
    leaveCall,
    registerUser,
    createRoom,
    joinRoom,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    reconnect,
    connectionRef
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;