import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
  Fab,
  Snackbar,
  InputAdornment,
} from '@mui/material';
import {
  VideoCall,
  Security,
  Speed,
  ContentCopy,
  Refresh,
  Wifi,
  WifiOff,
  Add,
  Login,
  Share,
  QrCode,
  Phone,
  PhoneDisabled,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { usePeerJS } from '../contexts/PeerJSContext';

const HomePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    me, 
    name, 
    setName, 
    isConnected, 
    connectionError, 
    reconnect,
    registerUser,
    createRoom,
    joinRoom,
    currentRoom,
    roomError,
    otherUser,
    socket
  } = usePeerJS();
  
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [showRoomCreated, setShowRoomCreated] = useState(false);
  const [showShareSnackbar, setShowShareSnackbar] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Check for room code in URL
  useEffect(() => {
    const urlRoomCode = searchParams.get('room');
    if (urlRoomCode) {
      setRoomCode(urlRoomCode.toUpperCase());
    }
  }, [searchParams]);

  const handleRegister = () => {
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    registerUser(name);
    setIsRegistered(true);
    toast.success(`Registered as ${name}`);
  };

  const handleCreateRoom = async () => {
    if (!isConnected || !socket?.connected) {
      toast.error('Not connected to server. Please wait and try again.');
      return;
    }
    
    if (!name || !me) {
      toast.error('Please register your name first.');
      return;
    }
    
    console.log('🚀 Starting room creation process:', { name, me, isConnected });
    
    setIsLoading(true);
    try {
      createRoom(); // No room ID needed - server generates code
      toast.success('Creating room...');
      
      // Listen for room creation success
      const handleRoomCreated = (data) => {
        console.log('📥 Received roomCreated event:', data);
        console.log('✅ Room created successfully');
        setCreatedRoomCode(data.roomCode);
        setShareUrl(data.shareUrl);
        setShowRoomCreated(true);
        setIsLoading(false);
        toast.success(`Room ${data.roomCode} created! Share this code with others.`);
      };
      
      const handleRoomJoined = (data) => {
        console.log('📥 Received roomJoined event:', data);
        console.log('✅ Room joined successfully, navigating to call page');
        navigate('/call');
        setIsLoading(false);
      };
      
      const handleRoomError = (data) => {
        console.error('❌ Room creation failed:', data.message);
        toast.error(`Room creation failed: ${data.message}`);
        setIsLoading(false);
      };
      
      // Add event listeners
      socket.on('roomCreated', handleRoomCreated);
      socket.on('roomJoined', handleRoomJoined);
      socket.on('roomError', handleRoomError);
      
      // Cleanup listeners after 5 seconds
      setTimeout(() => {
        socket.off('roomCreated', handleRoomCreated);
        socket.off('roomJoined', handleRoomJoined);
        socket.off('roomError', handleRoomError);
        if (isLoading) {
          toast.error('Room creation timed out. Please try again.');
          setIsLoading(false);
        }
      }, 5000);
      
    } catch (error) {
      toast.error('Failed to create room');
      console.error('Create room error:', error);
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      toast.error('Please enter a room code');
      return;
    }
    
    if (!isConnected || !socket?.connected) {
      toast.error('Not connected to server. Please wait and try again.');
      return;
    }
    
    setIsLoading(true);
    try {
      joinRoom(roomCode.toUpperCase().trim());
      toast.success(`Joining room ${roomCode.toUpperCase()}...`);
      
      // Listen for room joining success
      const handleRoomJoined = (data) => {
        if (data.roomCode === roomCode.toUpperCase()) {
          console.log('✅ Room joined successfully, navigating to call page');
          navigate('/call');
          setIsLoading(false);
        }
      };
      
      const handleRoomError = (data) => {
        console.error('❌ Room joining failed:', data.message);
        toast.error(`Failed to join room: ${data.message}`);
        setIsLoading(false);
      };
      
      // Add event listeners
      socket.on('roomJoined', handleRoomJoined);
      socket.on('roomError', handleRoomError);
      
      // Cleanup listeners after 5 seconds
      setTimeout(() => {
        socket.off('roomJoined', handleRoomJoined);
        socket.off('roomError', handleRoomError);
        if (isLoading) {
          toast.error('Room joining timed out. Please check the room code and try again.');
          setIsLoading(false);
        }
      }, 5000);
      
    } catch (error) {
      toast.error('Failed to join room');
      console.error('Join room error:', error);
      setIsLoading(false);
    }
  };

  const copyUserId = () => {
    if (me) {
      navigator.clipboard.writeText(me);
      toast.success('User ID copied to clipboard!');
    }
  };

  const copyCreatedRoomCode = () => {
    if (createdRoomCode) {
      navigator.clipboard.writeText(createdRoomCode);
      toast.success('Room code copied to clipboard!');
    }
  };

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setShowShareSnackbar(true);
      toast.success('Share link copied to clipboard!');
    }
  };

  const enterRoom = () => {
    if (createdRoomCode) {
      navigate('/call');
    }
  };

  const copyJoinRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      toast.success('Room code copied to clipboard!');
    }
  };

  const shareRoom = async () => {
    if (shareUrl && navigator.share) {
      try {
        await navigator.share({
          title: 'Join my video call',
          text: `Join my video call with code: ${createdRoomCode}`,
          url: shareUrl,
        });
      } catch (error) {
        console.log('Share cancelled or failed:', error);
        copyShareUrl();
      }
    } else {
      copyShareUrl();
    }
  };

  const formatRoomCode = (code) => {
    if (!code) return '';
    return code.toUpperCase().replace(/(.{3})/g, '$1 ').trim();
  };

  return (
    <Box sx={{ minHeight: '100vh', pb: 8 }}>
      <Container maxWidth="sm" sx={{ py: 2 }}>
        {/* Header */}
        <Box textAlign="center" mb={3}>
          <Typography
            variant="h1"
            component="h1"
            gutterBottom
            sx={{
              background: 'linear-gradient(45deg, #6366f1, #10b981)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 700,
            }}
          >
            VideoCall
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Simple video calling with room codes
          </Typography>
          
          {/* Connection Status */}
          <Box display="flex" justifyContent="center" alignItems="center" gap={1} mt={2}>
            {isConnected ? (
              <Chip
                icon={<Wifi />}
                label="Connected"
                color="success"
                variant="outlined"
                size="small"
              />
            ) : (
              <Chip
                icon={<WifiOff />}
                label="Disconnected"
                color="error"
                variant="outlined"
                size="small"
                onClick={reconnect}
                clickable
              />
            )}
          </Box>
        </Box>

        {/* Error Messages */}
        {connectionError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {connectionError}
            <Button onClick={reconnect} size="small" sx={{ ml: 1 }}>
              <Refresh fontSize="small" /> Reconnect
            </Button>
          </Alert>
        )}

        {roomError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {roomError}
          </Alert>
        )}

        {/* Main Content */}
        <Paper
          elevation={8}
          sx={{
            p: 3,
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 3,
          }}
        >
          {!isRegistered ? (
            <>
              <Typography variant="h4" gutterBottom textAlign="center">
                Get Started
              </Typography>
              
              <TextField
                fullWidth
                label="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                variant="outlined"
                sx={{ mb: 3 }}
                placeholder="Enter your display name"
                size="large"
              />
              
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleRegister}
                disabled={!isConnected || !name.trim()}
                startIcon={<VideoCall />}
                sx={{
                  py: 2,
                  background: 'linear-gradient(45deg, #6366f1, #818cf8)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #4f46e5, #6366f1)',
                  },
                }}
              >
                Continue
              </Button>
            </>
          ) : showRoomCreated ? (
            <>
              <Typography variant="h4" gutterBottom textAlign="center">
                🎉 Room Created!
              </Typography>
              
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Room Code: {formatRoomCode(createdRoomCode)}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  Share this code with others to let them join:
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mt={2}>
                  <TextField
                    value={createdRoomCode}
                    variant="outlined"
                    size="small"
                    fullWidth
                    InputProps={{
                      readOnly: true,
                      style: { 
                        fontFamily: 'monospace', 
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        textAlign: 'center',
                        letterSpacing: '0.2em'
                      }
                    }}
                  />
                  <Tooltip title="Copy Room Code">
                    <IconButton onClick={copyCreatedRoomCode} color="primary">
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Alert>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={enterRoom}
                    startIcon={<VideoCall />}
                    sx={{
                      py: 2,
                      background: 'linear-gradient(45deg, #10b981, #34d399)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #059669, #10b981)',
                      },
                    }}
                  >
                    Enter Room
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={shareRoom}
                    startIcon={<Share />}
                    sx={{ py: 2 }}
                  >
                    Share
                  </Button>
                </Grid>
              </Grid>
              
              <Button
                fullWidth
                variant="text"
                onClick={() => setShowRoomCreated(false)}
                sx={{ mt: 2 }}
              >
                Create Another Room
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h4" gutterBottom textAlign="center">
                Join a Call
              </Typography>
              
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleCreateRoom}
                    disabled={isLoading || !isConnected}
                    startIcon={isLoading ? <CircularProgress size={20} /> : <Add />}
                    sx={{
                      py: 2,
                      background: 'linear-gradient(45deg, #6366f1, #818cf8)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #4f46e5, #6366f1)',
                      },
                    }}
                  >
                    Create Room
                  </Button>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="large"
                    onClick={handleJoinRoom}
                    disabled={isLoading || !isConnected || !roomCode.trim()}
                    startIcon={isLoading ? <CircularProgress size={20} /> : <Login />}
                    sx={{ py: 2 }}
                  >
                    Join Room
                  </Button>
                </Grid>
              </Grid>
              
              <TextField
                fullWidth
                label="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                variant="outlined"
                placeholder="Enter 6-character room code"
                InputProps={{
                  style: { 
                    fontFamily: 'monospace', 
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    textAlign: 'center',
                    letterSpacing: '0.2em'
                  },
                  endAdornment: roomCode && (
                    <InputAdornment position="end">
                      <Tooltip title="Copy Room Code">
                        <IconButton onClick={copyJoinRoomCode} edge="end">
                          <ContentCopy />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Enter a 6-character room code to join an existing call
              </Typography>
            </>
          )}
        </Paper>

        {/* Features */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom textAlign="center">
            Features
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Card sx={{ p: 2, textAlign: 'center', background: 'rgba(99, 102, 241, 0.1)' }}>
                <VideoCall color="primary" />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  HD Video
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ p: 2, textAlign: 'center', background: 'rgba(16, 185, 129, 0.1)' }}>
                <Security color="primary" />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Secure
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={4}>
              <Card sx={{ p: 2, textAlign: 'center', background: 'rgba(99, 102, 241, 0.1)' }}>
                <Speed color="primary" />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Fast
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>

      {/* Share Snackbar */}
      <Snackbar
        open={showShareSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowShareSnackbar(false)}
        message="Share link copied to clipboard!"
      />
    </Box>
  );
};

export default HomePage;