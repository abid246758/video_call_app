import React, { createContext, useState, useRef, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import Peer from 'peerjs';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

const PeerJSContext = createContext();

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

export const PeerJSProvider = ({ children }) => {
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
  const [peerId, setPeerId] = useState(null);
  const [peerReady, setPeerReady] = useState(false);
  const [otherUserScreenSharing, setOtherUserScreenSharing] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const peerRef = useRef();

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

    newSocket.on('userJoined', ({ userId, name, message }) => {
      console.log('👤 User joined:', userId, name);
      setOtherUser(userId);
    });

    newSocket.on('userLeft', ({ userId, message }) => {
      console.log('👋 User left:', userId);
      setOtherUser(null);
      setCallAccepted(false);
    });

    newSocket.on('roomExpired', ({ message }) => {
      console.log('⏰ Room expired:', message);
      setCurrentRoom(null);
      setOtherUser(null);
      setCallAccepted(false);
    });

    newSocket.on('screenShareStarted', ({ from, name: sharerName }) => {
      console.log('🖥️ Screen sharing started by:', sharerName);
      setOtherUserScreenSharing(true);
      toast.info(`${sharerName} started screen sharing`);
    });

    newSocket.on('screenShareStopped', ({ from, name: sharerName }) => {
      console.log('🖥️ Screen sharing stopped by:', sharerName);
      setOtherUserScreenSharing(false);
      toast.info(`${sharerName} stopped screen sharing`);
    });

    newSocket.on('callEnded', () => {
      console.log('📴 Call ended');
      leaveCall();
    });

    return () => {
      // Clean up peer connection
      if (connectionRef.current) {
        connectionRef.current.close();
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

  // Get user media - optimized for mobile
  useEffect(() => {
    const getUserMedia = async () => {
      try {
        // Mobile-optimized constraints
        const constraints = {
          video: { 
            width: { 
              min: 320,
              ideal: 640,
              max: 1280
            },
            height: { 
              min: 240,
              ideal: 480,
              max: 720
            },
            frameRate: { 
              min: 15,
              ideal: 24,
              max: 30
            },
            facingMode: 'user' // Front camera on mobile
          }, 
          audio: { 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          } 
        };

        // Try with ideal constraints first
        let currentStream;
        try {
          currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
          console.warn('Failed with ideal constraints, trying basic:', error);
          // Fallback to basic constraints for older devices
          currentStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
        }
        
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

  // Initialize PeerJS connection
  useEffect(() => {
    if (me && !peerRef.current) {
      console.log('🔗 Initializing PeerJS with ID:', me);
      
      const peer = new Peer(me, {
        host: 'localhost',
        port: 9000,
        path: '/myapp',
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.ekiga.net' },
            { urls: 'stun:stun.ideasip.com' },
            { urls: 'stun:stun.schlund.de' },
            { urls: 'stun:stun.stunprotocol.org:3478' },
            { urls: 'stun:stun.voiparound.com' },
            { urls: 'stun:stun.voipbuster.com' },
            { urls: 'stun:stun.voipstunt.com' },
            { urls: 'stun:stun.counterpath.com' },
            { urls: 'stun:stun.1und1.de' },
            { urls: 'stun:stun.gmx.net' },
            { urls: 'stun:stun.callwithus.com' },
            { urls: 'stun:stun.counterpath.net' },
            { urls: 'stun:stun.internetcalls.com' }
          ],
          iceCandidatePoolSize: 20,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        },
        debug: 0,
        secure: false,
        timeout: 30000,
        key: 'peerjs',
        allow_discovery: true
      });

      peer.on('open', (id) => {
        console.log('✅ PeerJS connected with ID:', id);
        setPeerId(id);
        setPeerReady(true);
      });

      peer.on('call', (call) => {
        console.log('📞 Incoming call from:', call.peer);
        
        if (stream) {
          call.answer(stream);
          
          call.on('stream', (remoteStream) => {
            console.log('📹 Received remote stream');
            if (userVideo.current) {
              userVideo.current.srcObject = remoteStream;
            }
            setCallAccepted(true);
          });

          call.on('close', () => {
            console.log('📞 Call closed');
            setCallAccepted(false);
          });

          call.on('error', (err) => {
            console.error('❌ Call error:', err);
          });

          connectionRef.current = call;
        } else {
          console.warn('⚠️ No stream available to answer call');
        }
      });

      peer.on('error', (err) => {
        console.error('❌ PeerJS error:', err);
        
        // Handle different types of errors
        if (err.type === 'peer-unavailable') {
          console.log('🔄 Peer unavailable, will retry...');
          setTimeout(() => {
            if (peerRef.current && !peerRef.current.destroyed) {
              peerRef.current.destroy();
            }
            peerRef.current = null;
            setPeerId(null);
            setPeerReady(false);
          }, 1000);
        } else if (err.type === 'network') {
          console.log('🔄 Network error, attempting reconnection...');
          setTimeout(() => {
            if (peerRef.current && !peerRef.current.destroyed) {
              peerRef.current.destroy();
            }
            peerRef.current = null;
            setPeerId(null);
            setPeerReady(false);
          }, 2000);
        } else if (err.type === 'server-error') {
          console.log('🔄 Server error, reconnecting...');
          setTimeout(() => {
            if (peerRef.current && !peerRef.current.destroyed) {
              peerRef.current.destroy();
            }
            peerRef.current = null;
            setPeerId(null);
            setPeerReady(false);
          }, 3000);
        }
      });

      // Monitor connection state
      peer.on('connection', (conn) => {
        console.log('🔗 Peer connection established');
        conn.on('close', () => {
          console.log('🔌 Peer connection closed');
          setCallAccepted(false);
        });
        conn.on('error', (err) => {
          console.error('❌ Peer connection error:', err);
        });
      });

      // Monitor peer connection state
      peer.on('disconnected', () => {
        console.log('🔌 Peer disconnected, attempting reconnection...');
        peer.reconnect();
      });

      peer.on('close', () => {
        console.log('🔌 Peer closed, will recreate...');
        setTimeout(() => {
          if (peerRef.current && peerRef.current.destroyed) {
            peerRef.current = null;
            setPeerId(null);
            setPeerReady(false);
          }
        }, 1000);
      });

      peerRef.current = peer;
    }

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
        setPeerId(null);
        setPeerReady(false);
      }
    };
  }, [me, stream]);

  // Register user
  const registerUser = (userName) => {
    if (socket) {
      socket.emit('register', { name: userName });
      setName(userName);
    }
  };

  // Create room - simplified for mobile
  const createRoom = () => {
    if (socket && socket.connected) {
      console.log('🏠 Creating room with name:', name);
      // Clear any previous room errors
      setRoomError(null);
      // Don't set current room immediately - wait for backend confirmation
      socket.emit('createRoom', { name });
    } else {
      console.error('❌ Cannot create room: Socket not connected', { socket: !!socket, connected: socket?.connected });
      setRoomError('Connection not ready. Please try again.');
    }
  };

  // Join room - updated for room codes
  const joinRoom = (roomCode) => {
    if (socket && socket.connected) {
      console.log('🚪 Joining room:', roomCode, 'with name:', name);
      console.log('🔍 Socket state:', { connected: socket.connected, id: socket.id });
      // Clear any previous room errors
      setRoomError(null);
      // Don't set current room immediately - wait for backend confirmation
      socket.emit('joinRoom', { roomCode, name });
    } else {
      console.error('❌ Cannot join room: Socket not connected', { socket: !!socket, connected: socket?.connected });
      setRoomError('Connection not ready. Please try again.');
    }
  };

  // Call user - Enhanced with better error handling
  const callUser = (id) => {
    console.log('📞 Attempting to call user:', id);
    console.log('📞 Call conditions:', {
      stream: !!stream,
      peer: !!peerRef.current,
      peerReady,
      id
    });

    if (!stream) {
      console.error('❌ Cannot call: No stream available');
      toast.error('No media stream available');
      return;
    }

    if (!peerRef.current || !peerReady) {
      console.error('❌ Cannot call: Peer not ready yet', { peer: !!peerRef.current, ready: peerReady });
      toast.error('Connection not ready, please wait...');
      return;
    }

    if (!id) {
      console.error('❌ Cannot call: No user ID provided');
      return;
    }

    // Clean up existing connection
    if (connectionRef.current) {
      console.log('🧹 Cleaning up existing connection');
      connectionRef.current.close();
      connectionRef.current = null;
    }

    console.log('📞 Creating call to user:', id);
    
    try {
      // Use the existing peer to call
      const call = peerRef.current.call(id, stream);
      
      if (!call) {
        console.error('❌ Failed to create call');
        toast.error('Failed to create call');
        return;
      }
      
      console.log('📞 Call created successfully');
      
      call.on('stream', (remoteStream) => {
        console.log('📹 Received remote stream');
        if (userVideo.current) {
          userVideo.current.srcObject = remoteStream;
        }
        setCallAccepted(true);
        toast.success('Call connected!');
      });

      call.on('close', () => {
        console.log('📞 Call closed');
        setCallAccepted(false);
        toast.info('Call ended');
      });

      call.on('error', (err) => {
        console.error('❌ Call error:', err);
        toast.error(`Call failed: ${err.message || 'Unknown error'}`);
        setCallAccepted(false);
      });

      connectionRef.current = call;
      
      // Set a timeout to retry if no response
      setTimeout(() => {
        if (!callAccepted && connectionRef.current === call) {
          console.log('⏰ Call timeout, retrying...');
          toast.info('Retrying connection...');
          callUser(id);
        }
      }, 10000); // 10 second timeout
      
    } catch (error) {
      console.error('❌ Error creating call:', error);
      toast.error(`Call error: ${error.message}`);
    }
  };

  // Answer call - Enhanced
  const answerCall = () => {
    console.log('📞 Answering call...');
    console.log('📞 Answer conditions:', {
      call: !!call,
      isReceivingCall: call.isReceivingCall,
      stream: !!stream,
      peerReady
    });

    if (!call.isReceivingCall) {
      console.log('❌ No incoming call to answer');
      return;
    }

    if (!stream) {
      console.error('❌ Cannot answer: No stream available');
      toast.error('No media stream available');
      return;
    }

    if (!peerReady) {
      console.error('❌ Cannot answer: Peer not ready');
      toast.error('Connection not ready');
      return;
    }

    try {
      // The call is already handled in the peer.on('call') event
      // We just need to set the accepted state
      setCallAccepted(true);
      toast.success('Call answered!');
      console.log('✅ Call answered successfully');
    } catch (error) {
      console.error('❌ Error answering call:', error);
      toast.error('Failed to answer call');
    }
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
      connectionRef.current.close();
      connectionRef.current = null;
    }
    
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
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

  // Toggle screen share - Fixed implementation
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        console.log('🖥️ Starting screen share...');
        
        // Get screen share stream with optimized settings
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 15, max: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        setScreenStream(screenStream);
        setIsScreenSharing(true);
        
        // Notify other user about screen sharing
        if (socket && socket.connected) {
          socket.emit('screenShareStarted', { 
            from: me, 
            name: name,
            roomId: currentRoom 
          });
        }
        
        // Update local video display to show screen share
        if (myVideo.current) {
          myVideo.current.srcObject = screenStream;
        }
        
        // Replace video track in the peer connection
        if (connectionRef.current && !connectionRef.current.destroyed) {
          const videoTrack = screenStream.getVideoTracks()[0];
          if (videoTrack) {
            // For PeerJS, we need to recreate the call with the new stream
            console.log('🔄 Recreating call with screen share stream...');
            
            // Store the current peer connection
            const currentConnection = connectionRef.current;
            const peerId = currentConnection.peer;
            
            // Close current connection
            currentConnection.close();
            
            // Create new call with screen share stream
            const newCall = peerRef.current.call(peerId, screenStream);
            
            newCall.on('stream', (remoteStream) => {
              console.log('📹 Received remote stream during screen share');
              if (userVideo.current) {
                userVideo.current.srcObject = remoteStream;
              }
            });
            
            newCall.on('close', () => {
              console.log('📞 Screen share call closed');
            });
            
            newCall.on('error', (err) => {
              console.error('❌ Screen share call error:', err);
            });
            
            connectionRef.current = newCall;
          }
        }
        
        // Handle screen share end
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            console.log('🖥️ Screen share ended by user');
            stopScreenShare();
          };
        }
        
        console.log('🖥️ Screen sharing started successfully');
        toast.success('Screen sharing started');
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('❌ Screen share error:', error);
      toast.error('Failed to start screen sharing. Please check permissions.');
    }
  };

  // Stop screen share - Fixed implementation
  const stopScreenShare = () => {
    try {
      if (screenStream) {
        console.log('🖥️ Stopping screen share...');
        
        // Notify other user that screen sharing stopped
        if (socket && socket.connected) {
          socket.emit('screenShareStopped', { 
            from: me, 
            name: name,
            roomId: currentRoom 
          });
        }
        
        // Stop screen share tracks
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
        setIsScreenSharing(false);
        
        // Restore camera stream in local video
        if (myVideo.current && stream) {
          myVideo.current.srcObject = stream;
        }
        
        // Recreate call with camera stream
        if (connectionRef.current && !connectionRef.current.destroyed && stream) {
          console.log('🔄 Recreating call with camera stream...');
          
          // Store the current peer connection
          const currentConnection = connectionRef.current;
          const peerId = currentConnection.peer;
          
          // Close current connection
          currentConnection.close();
          
          // Create new call with camera stream
          const newCall = peerRef.current.call(peerId, stream);
          
          newCall.on('stream', (remoteStream) => {
            console.log('📹 Received remote stream after screen share');
            if (userVideo.current) {
              userVideo.current.srcObject = remoteStream;
            }
          });
          
          newCall.on('close', () => {
            console.log('📞 Camera call closed');
          });
          
          newCall.on('error', (err) => {
            console.error('❌ Camera call error:', err);
          });
          
          connectionRef.current = newCall;
        }
        
        console.log('🖥️ Screen sharing stopped successfully');
        toast.success('Screen sharing stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping screen share:', error);
      toast.error('Error stopping screen sharing');
    }
  };

  // Reconnect socket
  const reconnect = () => {
    console.log('🔄 Reconnecting...');
    if (socket) {
      socket.disconnect();
    }
    
    // Reset all states
    setCallAccepted(false);
    setOtherUser(null);
    setCurrentRoom(null);
    setRoomError(null);
    setIsScreenSharing(false);
    setOtherUserScreenSharing(false);
    
    // Recreate socket connection
    const newSocket = createSocketConnection();
    setSocket(newSocket);
    
    // Reinitialize peer
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    
    // Recreate peer with new ID
    const newPeer = new Peer(null, {
      host: 'localhost',
      port: 9000,
      path: '/myapp',
      secure: false,
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.ekiga.net' },
          { urls: 'stun:stun.ideasip.com' },
          { urls: 'stun:stun.schlund.de' },
          { urls: 'stun:stun.stunprotocol.org:3478' },
          { urls: 'stun:stun.voiparound.com' },
          { urls: 'stun:stun.voipbuster.com' },
          { urls: 'stun:stun.voipstunt.com' },
          { urls: 'stun:stun.voxgratia.org' },
          { urls: 'stun:stun.xten.com' },
          { urls: 'stun:stun.1und1.de' },
          { urls: 'stun:stun.gmx.net' },
          { urls: 'stun:stun.callwithus.com' },
          { urls: 'stun:stun.counterpath.com' },
          { urls: 'stun:stun.1und1.de' }
        ]
      },
      iceCandidatePoolSize: 20,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });
    
    newPeer.on('open', (id) => {
      console.log('🆔 New Peer ID:', id);
      setPeerId(id);
      setPeerReady(true);
    });
    
    newPeer.on('call', (call) => {
      console.log('📞 Incoming call from:', call.peer);
      setCall({ isReceivingCall: true, from: call.peer, name: call.metadata?.name });
      
      call.answer(stream);
      call.on('stream', (remoteStream) => {
        console.log('📹 Received remote stream');
        if (userVideo.current) {
          userVideo.current.srcObject = remoteStream;
        }
        setCallAccepted(true);
      });
      
      call.on('close', () => {
        console.log('📞 Call closed');
        setCallAccepted(false);
      });
      
      call.on('error', (err) => {
        console.error('❌ Call error:', err);
      });
      
      connectionRef.current = call;
    });
    
    newPeer.on('connection', (conn) => {
      console.log('🔗 Peer connection established');
    });
    
    newPeer.on('disconnected', () => {
      console.log('🔌 Peer disconnected, reconnecting...');
      newPeer.reconnect();
    });
    
    newPeer.on('close', () => {
      console.log('❌ Peer closed');
      setPeerReady(false);
    });
    
    newPeer.on('error', (err) => {
      console.error('❌ Peer error:', err);
      if (err.type === 'peer-unavailable') {
        console.log('🔄 Peer unavailable, retrying...');
        setTimeout(() => {
          if (newPeer && !newPeer.destroyed) {
            newPeer.reconnect();
          }
        }, 2000);
      }
    });
    
    peerRef.current = newPeer;
    
    toast.success('Connection refreshed');
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
    peerId,
    peerReady,
    isConnected,
    connectionError,
    isMuted,
    isVideoOff,
    isScreenSharing,
    currentRoom,
    roomError,
    otherUser,
    otherUserScreenSharing,
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
    <PeerJSContext.Provider value={value}>
      {children}
    </PeerJSContext.Provider>
  );
};

export const usePeerJS = () => {
  const context = useContext(PeerJSContext);
  if (!context) {
    throw new Error('usePeerJS must be used within a PeerJSProvider');
  }
  return context;
};

export default PeerJSContext;
