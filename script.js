class GlobalMusicPlayer {
    constructor() {
        this.playlist = [];
        this.currentSongIndex = -1;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.totalTime = 200;
        this.volume = 50;
        this.progressInterval = null;
        this.playbackUpdateTimeout = null;
        this.lastEventTime = 0;
        this.eventThrottleDelay = 100;
        
        // WebSocket connection
        this.socket = null;
        this.isConnected = false;
        this.serverUrl = 'http://localhost:3001'; // Change this to your server URL
        
        this.initializeElements();
        this.bindEvents();
        this.connectToServer();
        this.updateDisplay();
    }

    initializeElements() {
        this.elements = {
            currentSong: document.getElementById('currentSong'),
            playBtn: document.getElementById('playBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            currentTime: document.getElementById('currentTime'),
            totalTime: document.getElementById('totalTime'),
            songName: document.getElementById('songName'),
            artistName: document.getElementById('artistName'),
            addSongBtn: document.getElementById('addSongBtn'),
            playlistContainer: document.getElementById('playlistContainer'),
            totalSongs: document.getElementById('totalSongs'),
            statusText: document.getElementById('statusText'),
            statusDot: document.getElementById('statusDot'),
            messageContainer: document.getElementById('messageContainer'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue')
        };
    }

    connectToServer() {
        this.updateConnectionStatus('connecting');
        this.showMessage('Connecting to server...', 'info');
        
        try {
            // Load socket.io from CDN
            if (typeof io === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js';
                script.onload = () => this.initializeSocket();
                script.onerror = () => this.fallbackToOfflineMode();
                document.head.appendChild(script);
            } else {
                this.initializeSocket();
            }
        } catch (error) {
            console.error('Error loading socket.io:', error);
            this.fallbackToOfflineMode();
        }
    }

    initializeSocket() {
        try {
            this.socket = io(this.serverUrl);
            
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.updateConnectionStatus('connected');
                this.showMessage('Connected to server - Real-time sync enabled!', 'success');
                console.log('Connected to server');
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.showMessage('Disconnected from server - Working offline', 'error');
                console.log('Disconnected from server');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.fallbackToOfflineMode();
            });

            // Listen for state synchronization
            this.socket.on('sync-state', (state) => {
                this.playlist = state.playlist || [];
                this.currentSongIndex = state.currentSongIndex || -1;
                this.isPlaying = state.isPlaying || false;
                this.currentTime = state.currentTime || 0;
                this.updateDisplay();
                console.log('State synchronized with server');
            });

            // Listen for playlist updates
            this.socket.on('playlist-updated', (playlist) => {
                this.playlist = playlist;
                this.updateDisplay();
            });

            // Listen for playback changes
            this.socket.on('playback-changed', (data) => {
                this.isPlaying = data.isPlaying;
                this.currentTime = data.currentTime;
                this.updateDisplay();
                
                if (this.isPlaying) {
                    this.startProgress();
                } else {
                    this.stopProgress();
                }
            });

            // Listen for song changes
            this.socket.on('song-changed', (data) => {
                this.currentSongIndex = data.currentSongIndex;
                this.currentTime = data.currentTime;
                this.updateDisplay();
                
                if (this.isPlaying) {
                    this.startProgress();
                }
            });

        } catch (error) {
            console.error('Socket initialization error:', error);
            this.fallbackToOfflineMode();
        }
    }

    fallbackToOfflineMode() {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.showMessage('Running in offline mode - songs stored locally', 'info');
        this.loadFromStorage();
    }

    updateConnectionStatus(status) {
        const statusText = {
            'connecting': 'Connecting...',
            'connected': 'Online - Real-time sync',
            'disconnected': 'Offline Mode'
        };
        
        this.elements.statusText.textContent = statusText[status];
        this.elements.statusDot.className = `status-dot ${status}`;
    }

    bindEvents() {
        this.elements.playBtn.addEventListener('click', () => this.togglePlay());
        this.elements.prevBtn.addEventListener('click', () => this.previousSong());
        this.elements.nextBtn.addEventListener('click', () => this.nextSong());
        this.elements.addSongBtn.addEventListener('click', () => this.addSong());
        
        // Progress bar click to seek
        this.elements.progressBar.addEventListener('click', (e) => this.seekTo(e));
        
        // Volume control
        this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        
        // Enter key support
        this.elements.songName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSong();
        });
        this.elements.artistName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSong();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.previousSong();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextSong();
                    break;
            }
        });
    }

    loadFromStorage() {
        if (this.isConnected) return; // Don't load from storage if connected to server
        
        const saved = localStorage.getItem('globalMusicPlayer');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.playlist = data.playlist || [];
                this.currentSongIndex = data.currentSongIndex || -1;
                this.volume = data.volume || 50;
                this.elements.volumeSlider.value = this.volume;
                this.elements.volumeValue.textContent = this.volume + '%';
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }

    saveToStorage() {
        if (this.isConnected) return; // Don't save to storage if connected to server
        
        const data = {
            playlist: this.playlist,
            currentSongIndex: this.currentSongIndex,
            volume: this.volume
        };
        localStorage.setItem('globalMusicPlayer', JSON.stringify(data));
    }

    async searchYouTube(query) {
        if (!this.isConnected) {
            this.showMessage('YouTube search requires server connection', 'error');
            return null;
        }

        try {
            const response = await fetch(`${this.serverUrl}/api/youtube-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.videoId;
        } catch (error) {
            console.error('YouTube search error:', error);
            this.showMessage('YouTube search failed - check server connection', 'error');
            return null;
        }
    }

    showMessage(message, type = 'info') {
        const now = Date.now();
        if (now - this.lastEventTime < this.eventThrottleDelay) {
            return;
        }
        this.lastEventTime = now;

        this.elements.messageContainer.textContent = message;
        this.elements.messageContainer.className = `message ${type}-message`;
        this.elements.messageContainer.style.display = 'block';
        
        setTimeout(() => {
            this.elements.messageContainer.style.display = 'none';
        }, 4000);
    }

    async addSong() {
        const name = this.elements.songName.value.trim();
        const artist = this.elements.artistName.value.trim();
        
        if (!name || !artist) {
            this.showMessage('Please enter both song name and artist', 'error');
            return;
        }

        // Check for duplicates
        const exists = this.playlist.some(song => 
            song.name.toLowerCase() === name.toLowerCase() && 
            song.artist.toLowerCase() === artist.toLowerCase()
        );

        if (exists) {
            this.showMessage('Song already exists in playlist', 'error');
            return;
        }

        this.showMessage('Searching for song on YouTube...', 'info');
        
        // Search for the song on YouTube
        const query = `${name} ${artist}`;
        const videoId = await this.searchYouTube(query);

        const song = {
            name,
            artist,
            videoId: videoId || null,
            duration: Math.floor(Math.random() * 120) + 120, // Default duration if no video found
            id: Date.now() + Math.random()
        };

        if (this.isConnected && this.socket) {
            // Send to server via WebSocket
            this.socket.emit('add-song', song);
            this.showMessage(videoId ? 
                `Added "${name}" by ${artist} with YouTube video` : 
                `Added "${name}" by ${artist} (YouTube video not found)`, 
                'success');
        } else {
            // Add locally
            this.playlist.push(song);
            this.updatePlaylist();
            this.saveToStorage();
            this.showMessage(`Added "${name}" by ${artist} (offline mode)`, 'success');
            
            // If this is the first song, set it as current
            if (this.playlist.length === 1) {
                this.currentSongIndex = 0;
                this.updateCurrentSong();
            }
        }
        
        // Clear inputs
        this.elements.songName.value = '';
        this.elements.artistName.value = '';
    }

    removeSong(index) {
        if (index >= 0 && index < this.playlist.length) {
            const removedSong = this.playlist[index];
            
            if (this.isConnected && this.socket) {
                // Send to server via WebSocket
                this.socket.emit('remove-song', index);
            } else {
                // Remove locally
                this.playlist.splice(index, 1);
                
                // Adjust current song index if needed
                if (index === this.currentSongIndex) {
                    if (this.playlist.length > 0) {
                        this.currentSongIndex = index >= this.playlist.length ? 0 : index;
                    } else {
                        this.currentSongIndex = -1;
                        this.isPlaying = false;
                        this.isPaused = false;
                    }
                } else if (index < this.currentSongIndex) {
                    this.currentSongIndex--;
                }
                
                this.updateDisplay();
                this.saveToStorage();
            }
            
            this.showMessage(`Removed "${removedSong.name}" from playlist`, 'success');
        }
    }

    playSong(index) {
        if (index >= 0 && index < this.playlist.length) {
            if (this.isConnected && this.socket) {
                this.socket.emit('change-song', index);
            } else {
                this.currentSongIndex = index;
                this.currentTime = 0;
                this.isPlaying = true;
                this.isPaused = false;
                this.updateDisplay();
                this.startProgress();
                this.saveToStorage();
            }
        }
    }

    togglePlay() {
        if (this.playlist.length === 0) {
            this.showMessage('Add songs to the playlist first', 'error');
            return;
        }

        if (this.currentSongIndex < 0) {
            this.currentSongIndex = 0;
        }

        if (this.isConnected && this.socket) {
            if (this.isPlaying) {
                this.socket.emit('pause');
            } else {
                this.socket.emit('play');
            }
        } else {
            if (this.isPlaying) {
                this.isPlaying = false;
                this.isPaused = true;
                this.stopProgress();
                this.showMessage('Paused', 'info');
            } else {
                this.isPlaying = true;
                this.isPaused = false;
                this.startProgress();
                this.showMessage('Playing', 'info');
            }
            
            this.updateDisplay();
            this.saveToStorage();
        }
    }

    nextSong() {
        if (this.playlist.length === 0) return;
        
        if (this.isConnected && this.socket) {
            this.socket.emit('next-song');
        } else {
            this.currentSongIndex = (this.currentSongIndex + 1) % this.playlist.length;
            this.currentTime = 0;
            
            if (this.isPlaying) {
                this.startProgress();
            }
            
            this.updateDisplay();
            this.saveToStorage();
            this.showMessage('Next song', 'info');
        }
    }

    previousSong() {
        if (this.playlist.length === 0) return;
        
        if (this.isConnected && this.socket) {
            this.socket.emit('previous-song');
        } else {
            this.currentSongIndex = (this.currentSongIndex - 1 + this.playlist.length) % this.playlist.length;
            this.currentTime = 0;
            
            if (this.isPlaying) {
                this.startProgress();
            }
            
            this.updateDisplay();
            this.saveToStorage();
            this.showMessage('Previous song', 'info');
        }
    }

    seekTo(event) {
        if (this.currentSongIndex < 0) return;
        
        const rect = this.elements.progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        const newTime = Math.max(0, Math.min(this.totalTime, percent * this.totalTime));
        
        if (this.isConnected && this.socket) {
            this.socket.emit('seek', newTime);
        } else {
            this.currentTime = newTime;
            this.updateProgressBar();
            this.updateTimeDisplay();
            this.saveToStorage();
        }
        
        this.showMessage(`Seeked to ${this.formatTime(newTime)}`, 'info');
    }

    setVolume(value) {
        this.volume = parseInt(value);
        this.elements.volumeValue.textContent = this.volume + '%';
        this.saveToStorage();
    }

    startProgress() {
        this.stopProgress();
        
        if (this.currentSongIndex >= 0 && this.currentSongIndex < this.playlist.length) {
            this.totalTime = this.playlist[this.currentSongIndex].duration;
        }
        
        this.progressInterval = setInterval(() => {
            if (this.isPlaying && !this.isPaused) {
                this.currentTime += 1;
                
                if (this.currentTime >= this.totalTime) {
                    this.currentTime = 0;
                    this.nextSong();
                    return;
                }
                
                this.updateProgressBar();
                this.updateTimeDisplay();
                
                // Send time update to server if connected
                if (this.isConnected && this.socket) {
                    this.socket.emit('time-update', this.currentTime);
                }
            }
        }, 1000);
    }

    stopProgress() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    updateDisplay() {
        this.updateCurrentSong();
        this.updatePlaylist();
        this.updateProgressBar();
        this.updateTimeDisplay();
        this.updateControls();
        this.updateStats();
    }

    updateCurrentSong() {
        if (this.currentSongIndex >= 0 && this.currentSongIndex < this.playlist.length) {
            const song = this.playlist[this.currentSongIndex];
            this.elements.currentSong.textContent = `${song.name} - ${song.artist}`;
            this.totalTime = song.duration;
        } else {
            this.elements.currentSong.textContent = 'Add a song to get started!';
            this.totalTime = 200;
        }
    }

    updatePlaylist() {
        this.elements.playlistContainer.innerHTML = '';
        
        if (this.playlist.length === 0) {
            this.elements.playlistContainer.innerHTML = '<p style="text-align: center; color: #6c757d;">No songs in playlist</p>';
            return;
        }

        this.playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = `playlist-item ${index === this.currentSongIndex ? 'current' : ''}`;
            
            const youtubeIcon = song.videoId ? '🎵' : '🎶';
            const youtubeStatus = song.videoId ? 'YouTube' : 'Local';
            
            item.innerHTML = `
                <div class="song-info">
                    <div class="song-name">${youtubeIcon} ${song.name}</div>
                    <div class="song-artist">${song.artist} • ${this.formatTime(song.duration)} • ${youtubeStatus}</div>
                </div>
                <button class="remove-btn" onclick="musicPlayer.removeSong(${index})">Remove</button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('remove-btn')) {
                    this.playSong(index);
                }
            });
            
            this.elements.playlistContainer.appendChild(item);
        });
    }

    updateProgressBar() {
        const progressPercent = this.totalTime > 0 ? (this.currentTime / this.totalTime) * 100 : 0;
        this.elements.progressFill.style.width = `${Math.min(progressPercent, 100)}%`;
    }

    updateTimeDisplay() {
        this.elements.currentTime.textContent = this.formatTime(this.currentTime);
        this.elements.totalTime.textContent = this.formatTime(this.totalTime);
    }

    updateControls() {
        this.elements.playBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
        this.elements.playBtn.title = this.isPlaying ? 'Pause' : 'Play';
        
        if (this.isPlaying) {
            this.elements.playBtn.classList.add('playing');
        } else {
            this.elements.playBtn.classList.remove('playing');
        }
    }

    updateStats() {
        this.elements.totalSongs.textContent = this.playlist.length;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the music player when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.musicPlayer = new GlobalMusicPlayer();
});
