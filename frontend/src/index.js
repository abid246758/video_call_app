import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Comprehensive polyfills for Node.js compatibility
if (typeof process === 'undefined') {
  global.process = { 
    env: {},
    nextTick: (callback) => {
      setTimeout(callback, 0);
    },
    browser: true,
    version: '',
    versions: {}
  };
}

// Polyfill for Buffer
if (typeof Buffer === 'undefined') {
  global.Buffer = {
    isBuffer: () => false,
    from: (data) => new Uint8Array(data),
    alloc: (size) => new Uint8Array(size)
  };
}

// Comprehensive stream polyfill
if (typeof global.stream === 'undefined') {
  global.stream = {
    Readable: class Readable {
      constructor() {
        this._readableState = {
          objectMode: false,
          highWaterMark: 16384,
          buffer: [],
          length: 0,
          pipes: null,
          pipesCount: 0,
          flowing: null,
          ended: false,
          endEmitted: false,
          reading: false,
          sync: true,
          needReadable: false,
          emittedReadable: false,
          readableListening: false,
          resumeScheduled: false,
          destroyed: false,
          defaultEncoding: 'utf8',
          awaitDrain: 0,
          readingMore: false,
          decoder: null,
          encoding: null
        };
      }
    }
  };
}

// Polyfill for readable-stream specifically
if (typeof global.require === 'undefined') {
  global.require = function(id) {
    if (id === 'readable-stream') {
      return global.stream;
    }
    if (id === 'stream') {
      return global.stream;
    }
    if (id === 'util') {
      return {
        inherits: function() {},
        inspect: function() { return '[object Object]'; }
      };
    }
    return {};
  };
}

// Polyfill for events
if (typeof global.EventEmitter === 'undefined') {
  global.EventEmitter = class EventEmitter {
    constructor() {
      this._events = {};
    }
    on(event, listener) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(listener);
      return this;
    }
    emit(event, ...args) {
      if (this._events[event]) {
        this._events[event].forEach(listener => listener(...args));
      }
      return this;
    }
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
