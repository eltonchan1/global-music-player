const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com', 'https://your-frontend-url.com'] // Replace with your frontend URLs
        : ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:5500'] // Common local dev ports
}));
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Music Player Backend API',
        status: 'running',
        endpoints: {
            search: 'POST /api/youtube-search',
            health: 'GET /health'
        }
    });
});

// YouTube search endpoint
app.post('/api/youtube-search', async (req, res) => {
    try {
        const { query } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const API_KEY = process.env.YOUTUBE_API_KEY;
        
        if (!API_KEY) {
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
            timeout: 10000 // 10 second timeout
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
            res.status(500).json({ error: 'YouTube search failed' });
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Music Player Backend is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`YouTube API Key configured: ${!!process.env.YOUTUBE_API_KEY}`);
});
