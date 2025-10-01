import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  CallEnd,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  ContentCopy,
  Share,
  ArrowBack,
  Security,
  Wifi,
  WifiOff,
  Person,
  VideoCall,
  Refresh,
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { usePeerJS } from '../contexts/PeerJSContext';

const VideoCallPage = () => {
  const navigate = useNavigate();
  const {
    call,
    callAccepted,
    myVideo,
    userVideo,
    stream,
    screenStream,
    name,
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
    answerCall,
    leaveCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    callUser,
    reconnect,
  } = usePeerJS();

  const [showShareDialog, setShowShareDialog] = useState(false);

  // Auto-call when other user joins (room-based system)
  useEffect(() => {
    if (otherUser && stream && !callAccepted && peerReady) {
      console.log('Auto-calling other user:', otherUser, 'peer ready:', peerReady);
      // Add a small delay to ensure peer is fully ready
      setTimeout(() => {
        callUser(otherUser);
      }, 2000); // Increased delay for better connection
    }
  }, [otherUser, stream, callAccepted, peerReady, callUser]);

  // Auto-answer calls in room-based system
  useEffect(() => {
    if (call.isReceivingCall && stream) {
      console.log('Auto-answering call in room-based system');
      answerCall();
    }
  }, [call.isReceivingCall, stream, answerCall]);

  // Debug connection state
  useEffect(() => {
    console.log('🔍 Connection Debug:', {
      otherUser,
      stream: !!stream,
      callAccepted,
      peerReady,
      isConnected,
      currentRoom
    });
  }, [otherUser, stream, callAccepted, peerReady, isConnected, currentRoom]);

  const copyUserId = () => {
    if (me) {
      navigator.clipboard.writeText(me);
      toast.success('User ID copied to clipboard!');
    }
  };

  const handleLeaveCall = () => {
    leaveCall();
    navigate('/');
  };

  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}?room=${currentRoom}`;
    navigator.clipboard.writeText(roomLink);
    toast.success('Room link copied to clipboard!');
    setShowShareDialog(false);
  };

  // Add a small delay to allow socket events to process
  const [showNoRoom, setShowNoRoom] = useState(false);
  
  useEffect(() => {
    if (!currentRoom) {
      const timer = setTimeout(() => {
        setShowNoRoom(true);
      }, 2000); // Wait 2 seconds before showing "No Room Active"
      
      return () => clearTimeout(timer);
    } else {
      setShowNoRoom(false);
    }
  }, [currentRoom]);

  if (!currentRoom && showNoRoom) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box textAlign="center">
          <Typography variant="h4" gutterBottom>
            No Room Active
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Please create or join a room first.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/')}
            sx={{ mt: 2 }}
          >
            Go Back to Home
          </Button>
        </Box>
      </Container>
    );
  }

  // Show loading while waiting for room state
  if (!currentRoom) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box textAlign="center">
          <Typography variant="h4" gutterBottom>
            Loading Room...
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Please wait while we set up your room.
          </Typography>
          {roomError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {roomError}
            </Alert>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(236, 72, 153, 0.05) 0%, transparent 50%)
          `,
          zIndex: 0
        }}
      />

      <Container maxWidth="xl" sx={{ py: 2, position: 'relative', zIndex: 1 }}>
      {/* Header */}
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          mb={3}
          sx={{
            background: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: 3,
            p: 2,
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}
        >
        <Box display="flex" alignItems="center" gap={2}>
            <IconButton 
              onClick={() => navigate('/')} 
              sx={{
                background: 'rgba(99, 102, 241, 0.1)',
                '&:hover': { background: 'rgba(99, 102, 241, 0.2)' }
              }}
            >
            <ArrowBack />
          </IconButton>
            <Box>
              <Typography variant="h5" fontWeight={600}>
            Room: {currentRoom}
          </Typography>
              <Box display="flex" gap={1} mt={0.5}>
          <Chip
            icon={isConnected ? <Wifi /> : <WifiOff />}
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            variant="outlined"
            size="small"
          />
          {otherUser && (
            <Chip
              icon={<Person />}
              label="2/2 Users"
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
                {isScreenSharing && (
                  <Chip
                    icon={<ScreenShare />}
                    label="Screen Sharing"
                    color="secondary"
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
            </Box>
        </Box>
        
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh Connection">
            <IconButton 
              onClick={() => {
                console.log('🔄 Manual refresh connection');
                reconnect();
              }}
              sx={{
                background: 'rgba(16, 185, 129, 0.1)',
                '&:hover': { background: 'rgba(16, 185, 129, 0.2)' }
              }}
            >
              <Refresh />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Share Room Link">
              <IconButton 
                onClick={() => setShowShareDialog(true)} 
                sx={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  '&:hover': { background: 'rgba(16, 185, 129, 0.2)' }
                }}
              >
              <Share />
            </IconButton>
          </Tooltip>
          </Box>
      </Box>

        {/* Error Messages */}
      {connectionError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {connectionError}
        </Alert>
      )}

      {roomError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {roomError}
        </Alert>
      )}

        {/* Main Video Container */}
        <Box sx={{ position: 'relative', mb: 4 }}>
          {/* Remote Video - Main View */}
          <Card
            sx={{
              height: { xs: '60vh', sm: '70vh' },
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <CardContent sx={{ height: '100%', p: 0, position: 'relative' }}>
              {callAccepted ? (
                <Box
                  component="video"
                  ref={userVideo}
                  autoPlay
                  playsInline
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 2,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'text.secondary',
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                  }}
                >
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'linear-gradient(45deg, #6366f1, #10b981)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3,
                      animation: 'pulse 2s infinite'
                    }}
                  >
                    <VideoCall sx={{ fontSize: 40, color: 'white' }} />
                  </Box>
                  <Typography variant="h5" gutterBottom fontWeight={600}>
                    {otherUser ? 'Connecting...' : 'Waiting for another user...'}
                  </Typography>
                  <Typography variant="body1" textAlign="center" color="text.secondary">
                    {otherUser 
                      ? 'Establishing secure connection...'
                      : 'Share the room code with someone to start the call'
                    }
                  </Typography>
                  
                  {/* Manual retry button if stuck connecting */}
                  {otherUser && !callAccepted && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
                        console.log('🔄 Manual retry connection');
                        callUser(otherUser);
                      }}
                      sx={{
                        mt: 2,
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.5)',
                        color: 'white',
                        '&:hover': {
                          background: 'rgba(16, 185, 129, 0.3)',
                        }
                      }}
                    >
                      Retry Connection
                    </Button>
                  )}
                  
                  {!otherUser && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                      Room Code: <strong>{currentRoom}</strong>
                    </Typography>
                  )}
                </Box>
              )}
              
              {/* Remote Video Overlay */}
              {callAccepted && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    background: 'rgba(0, 0, 0, 0.8)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <Typography variant="body2" color="white" fontWeight={500}>
                    {call.name || 'Remote User'}
                  </Typography>
                  <Box display="flex" gap={1} mt={0.5}>
                    <Chip
                      icon={<Security />}
                      label="Encrypted"
                      size="small"
                      color="success"
                      sx={{ fontSize: '0.7rem' }}
                    />
                    {isScreenSharing && (
                      <Chip
                        icon={<ScreenShare />}
                        label="You're Sharing"
                        size="small"
                        color="primary"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                    {otherUserScreenSharing && !isScreenSharing && (
                      <Chip
                        icon={<ScreenShare />}
                        label="Screen Share"
                        size="small"
                        color="secondary"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* My Video - Picture in Picture */}
          <Card
            sx={{
              height: { xs: '120px', sm: '160px' },
              width: { xs: '90px', sm: '120px' },
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              border: '2px solid rgba(99, 102, 241, 0.3)',
              position: 'absolute',
              top: 16,
              right: 16,
              overflow: 'hidden',
              borderRadius: 2,
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}
          >
            <CardContent sx={{ height: '100%', p: 0, position: 'relative' }}>
              {stream && (
                <Box
                  component="video"
                  ref={myVideo}
                  autoPlay
                  muted
                  playsInline
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              )}
              
              {/* Video Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  right: 4,
                  background: 'rgba(0, 0, 0, 0.8)',
                  backdropFilter: 'blur(5px)',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography variant="caption" color="white" display="block" fontWeight={500}>
                  {name || 'You'}
                </Typography>
                <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                  {isMuted && <Chip label="Muted" size="small" color="error" sx={{ fontSize: '0.6rem', height: '16px' }} />}
                  {isVideoOff && <Chip label="Video Off" size="small" color="error" sx={{ fontSize: '0.6rem', height: '16px' }} />}
                  {isScreenSharing && <Chip label="Screen" size="small" color="primary" sx={{ fontSize: '0.6rem', height: '16px' }} />}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Call Controls - Professional Design */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
            gap: { xs: 2, sm: 3 },
            p: { xs: 3, sm: 4 },
            background: 'rgba(30, 41, 59, 0.8)',
            backdropFilter: 'blur(20px)',
            borderRadius: 4,
          border: '1px solid rgba(99, 102, 241, 0.2)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            flexWrap: 'wrap',
        }}
      >
        <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
          <IconButton
            onClick={toggleMute}
            color={isMuted ? 'error' : 'inherit'}
              size="large"
            sx={{
                background: isMuted 
                  ? 'linear-gradient(45deg, #ef4444, #dc2626)' 
                  : 'linear-gradient(45deg, #6366f1, #818cf8)',
                color: 'white',
                width: { xs: '64px', sm: '72px' },
                height: { xs: '64px', sm: '72px' },
              '&:hover': {
                  background: isMuted 
                    ? 'linear-gradient(45deg, #dc2626, #b91c1c)' 
                    : 'linear-gradient(45deg, #4f46e5, #6366f1)',
                  transform: 'scale(1.05)',
              },
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
            }}
          >
              {isMuted ? <MicOff fontSize="large" /> : <Mic fontSize="large" />}
          </IconButton>
        </Tooltip>

        <Tooltip title={isVideoOff ? 'Turn On Video' : 'Turn Off Video'}>
          <IconButton
            onClick={toggleVideo}
            color={isVideoOff ? 'error' : 'inherit'}
              size="large"
            sx={{
                background: isVideoOff 
                  ? 'linear-gradient(45deg, #ef4444, #dc2626)' 
                  : 'linear-gradient(45deg, #6366f1, #818cf8)',
                color: 'white',
                width: { xs: '64px', sm: '72px' },
                height: { xs: '64px', sm: '72px' },
              '&:hover': {
                  background: isVideoOff 
                    ? 'linear-gradient(45deg, #dc2626, #b91c1c)' 
                    : 'linear-gradient(45deg, #4f46e5, #6366f1)',
                  transform: 'scale(1.05)',
              },
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
            }}
          >
              {isVideoOff ? <VideocamOff fontSize="large" /> : <Videocam fontSize="large" />}
          </IconButton>
        </Tooltip>

        <Tooltip title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}>
          <IconButton
            onClick={toggleScreenShare}
            color={isScreenSharing ? 'primary' : 'inherit'}
              size="large"
            sx={{
                background: isScreenSharing 
                  ? 'linear-gradient(45deg, #10b981, #34d399)' 
                  : 'linear-gradient(45deg, #6366f1, #818cf8)',
                color: 'white',
                width: { xs: '64px', sm: '72px' },
                height: { xs: '64px', sm: '72px' },
              '&:hover': {
                  background: isScreenSharing 
                    ? 'linear-gradient(45deg, #059669, #10b981)' 
                    : 'linear-gradient(45deg, #4f46e5, #6366f1)',
                  transform: 'scale(1.05)',
              },
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
            }}
          >
              <ScreenShare fontSize="large" />
          </IconButton>
        </Tooltip>

          <Tooltip title="Leave Call">
          <IconButton
            onClick={handleLeaveCall}
            color="error"
              size="large"
            sx={{
                background: 'linear-gradient(45deg, #ef4444, #dc2626)',
                color: 'white',
                width: { xs: '64px', sm: '72px' },
                height: { xs: '64px', sm: '72px' },
              '&:hover': {
                  background: 'linear-gradient(45deg, #dc2626, #b91c1c)',
                  transform: 'scale(1.05)',
              },
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
            }}
          >
              <CallEnd fontSize="large" />
          </IconButton>
        </Tooltip>
      </Box>

        {/* Screen Share Info */}
        {(isScreenSharing || otherUserScreenSharing) && (
          <Alert 
            severity="info" 
            sx={{ 
              mt: 2, 
              borderRadius: 2,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}
          >
            <Typography variant="body2">
              {isScreenSharing ? (
                <>
                  <strong>You are sharing your screen:</strong> The other participant can see your screen in the main video area. 
                  Click the screen share button again to stop sharing.
                </>
              ) : otherUserScreenSharing ? (
                <>
                  <strong>Other participant is sharing their screen:</strong> You can see their screen in the main video area above.
                </>
              ) : null}
            </Typography>
          </Alert>
        )}
      </Container>

      {/* Share Dialog */}
      <Dialog 
        open={showShareDialog} 
        onClose={() => setShowShareDialog(false)}
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ color: 'text.primary' }}>Share Room</DialogTitle>
        <DialogContent>
          <Typography gutterBottom color="text.secondary">
            Share this room with others:
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mt={2}>
            <TextField
              value={`${window.location.origin}?room=${currentRoom}`}
              variant="outlined"
              size="small"
              fullWidth
              InputProps={{
                readOnly: true,
                style: { fontFamily: 'monospace' }
              }}
            />
            <IconButton onClick={copyRoomLink} color="primary">
              <ContentCopy />
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowShareDialog(false)}
            sx={{ color: 'text.primary' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VideoCallPage;