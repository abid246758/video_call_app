// Polyfill for process variable
if (typeof process === 'undefined') {
  global.process = { 
    env: {},
    nextTick: (callback) => {
      setTimeout(callback, 0);
    }
  };
}

// Mock process.env for browser environment
if (typeof window !== 'undefined' && !window.process) {
  window.process = { 
    env: {},
    nextTick: function(callback) {
      setTimeout(callback, 0);
    }
  };
}
