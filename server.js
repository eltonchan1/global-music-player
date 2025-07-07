const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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

        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                maxResults: 1,
                q: query,
                type: 'video',
                key: API_KEY
            }
        });

        const videoId = response.data.items[0]?.id?.videoId || null;
        
        res.json({ videoId });
        
    } catch (error) {
        console.error('YouTube search error:', error.response?.data || error.message);
        res.status(500).json({ error: 'YouTube search failed' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Music Player Backend is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});