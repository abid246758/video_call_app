const { PeerServer } = require('peer');

const peerServer = PeerServer({
  port: 9000,
  path: '/myapp',
  allow_discovery: true,
  proxied: true
});

console.log('🔗 PeerJS server running on port 9000');
