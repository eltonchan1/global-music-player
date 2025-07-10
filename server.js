const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3001;

// Global state for the music player
let globalState = {
    playlist: [
        { name: 'Imagine', artist: 'John Lennon', videoId: 'YkgkThdzX-8' }
    ],
    currentSongIndex: 0,
    isPlaying: false,
    currentTime: 0,
    lastUpdateTime: Date.now()
};

// Temporary permissive CORS for testing
app.use(cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));

app.use(express.json());

// Add request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current state to newly connected client
    socket.emit('sync-state', globalState);
    
    // Handle playlist updates
    socket.on('add-song', (song) => {
        globalState.playlist.push(song);
        io.emit('playlist-updated', globalState.playlist);
        console.log('Song added:', song.name, 'by', song.artist);
    });
    
    socket.on('remove-song', (index) => {
        if (index >= 0 && index < globalState.playlist.length) {
            const removedSong = globalState.playlist.splice(index, 1)[0];
            
            // Adjust current song index if needed
            if (index === globalState.currentSongIndex) {
                if (globalState.playlist.length > 0) {
                    globalState.currentSongIndex = index >= globalState.playlist.length ? 0 : index;
                } else {
                    globalState.currentSongIndex = -1;
                    globalState.isPlaying = false;
                }
            } else if (index < globalState.currentSongIndex) {
                globalState.currentSongIndex--;
            }
            
            io.emit('sync-state', globalState);
            console.log('Song removed:', removedSong.name);
        }
    });
    
    // Handle playback control
    socket.on('play', () => {
        globalState.isPlaying = true;
        globalState.lastUpdateTime = Date.now();
        io.emit('playback-changed', {
            isPlaying: true,
            currentTime: globalState.currentTime,
            timestamp: globalState.lastUpdateTime
        });
        console.log('Playback started');
    });
    
    socket.on('pause', () => {
        globalState.isPlaying = false;
        globalState.lastUpdateTime = Date.now();
        io.emit('playback-changed', {
            isPlaying: false,
            currentTime: globalState.currentTime,
            timestamp: globalState.lastUpdateTime
        });
        console.log('Playback paused');
    });
    
    socket.on('seek', (time) => {
        globalState.currentTime = time;
        globalState.lastUpdateTime = Date.now();
        io.emit('playback-changed', {
            isPlaying: globalState.isPlaying,
            currentTime: globalState.currentTime,
            timestamp: globalState.lastUpdateTime
        });
        console.log('Seeked to:', time);
    });
    
    socket.on('change-song', (index) => {
        if (index >= 0 && index < globalState.playlist.length) {
            globalState.currentSongIndex = index;
            globalState.currentTime = 0;
            globalState.lastUpdateTime = Date.now();
            io.emit('song-changed', {
                currentSongIndex: index,
                currentTime: 0,
                timestamp: globalState.lastUpdateTime
            });
            console.log('Changed to song:', globalState.playlist[index].name);
        }
    });
    
    socket.on('next-song', () => {
        if (globalState.playlist.length > 0) {
            globalState.currentSongIndex = (globalState.currentSongIndex + 1) % globalState.playlist.length;
            globalState.currentTime = 0;
            globalState.lastUpdateTime = Date.now();
            io.emit('song-changed', {
                currentSongIndex: globalState.currentSongIndex,
                currentTime: 0,
                timestamp: globalState.lastUpdateTime
            });
            console.log('Next song:', globalState.playlist[globalState.currentSongIndex].name);
        }
    });
    
    socket.on('previous-song', () => {
        if (globalState.playlist.length > 0) {
            globalState.currentSongIndex = (globalState.currentSongIndex - 1 + globalState.playlist.length) % globalState.playlist.length;
            globalState.currentTime = 0;
            globalState.lastUpdateTime = Date.now();
            io.emit('song-changed', {
                currentSongIndex: globalState.currentSongIndex,
                currentTime: 0,
                timestamp: globalState.lastUpdateTime
            });
            console.log('Previous song:', globalState.playlist[globalState.currentSongIndex].name);
        }
    });
    
    // Handle time sync updates
    socket.on('time-update', (time) => {
        globalState.currentTime = time;
        globalState.lastUpdateTime = Date.now();
        // Don't broadcast time updates to avoid loops
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Update global time periodically
setInterval(() => {
    if (globalState.isPlaying && globalState.playlist.length > 0) {
        const now = Date.now();
        const elapsed = (now - globalState.lastUpdateTime) / 1000;
        globalState.currentTime += elapsed;
        globalState.lastUpdateTime = now;
    }
}, 1000);

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Global Music Player Backend API',
        status: 'running',
        connectedClients: io.engine.clientsCount,
        currentSong: globalState.playlist[globalState.currentSongIndex] || null,
        playlistLength: globalState.playlist.length,
        endpoints: {
            search: 'POST /api/youtube-search',
            health: 'GET /health',
            state: 'GET /api/state'
        }
    });
});

// Get current state endpoint
app.get('/api/state', (req, res) => {
    res.json(globalState);
});

// YouTube search endpoint
app.post('/api/youtube-search', async (req, res) => {
    try {
        const { query } = req.body;
        
        console.log('Received search request for:', query);
        
        if (!query) {
            console.error('No query provided');
            return res.status(400).json({ error: 'Query is required' });
        }

        const API_KEY = process.env.YOUTUBE_API_KEY;
        
        if (!API_KEY) {
            console.error('YouTube API key not configured');
            return res.status(500).json({ error: 'YouTube API key not configured' });
        }

        console.log(`Searching YouTube for: ${query}`);

        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                maxResults: 1,
                q: query,
                type: 'video',
                key: API_KEY
            },
            timeout: 10000
        });

        const videoId = response.data.items[0]?.id?.videoId || null;
        
        if (videoId) {
            console.log(`Found video: ${videoId}`);
        } else {
            console.log(`No video found for: ${query}`);
        }
        
        res.json({ videoId });
        
    } catch (error) {
        console.error('YouTube search error:', error.response?.data || error.message);
        
        if (error.response?.status === 403) {
            res.status(403).json({ error: 'YouTube API quota exceeded or invalid key' });
        } else if (error.code === 'ECONNABORTED') {
            res.status(408).json({ error: 'YouTube API timeout' });
        } else {
            res.status(500).json({ error: 'YouTube search failed', details: error.message });
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Global Music Player Backend is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        connectedClients: io.engine.clientsCount,
        youtubeApiConfigured: !!process.env.YOUTUBE_API_KEY
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`YouTube API Key configured: ${!!process.env.YOUTUBE_API_KEY}`);
});
