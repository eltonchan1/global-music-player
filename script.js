// Enhanced GlobalMusicPlayer class with better error handling and offline fallback

class GlobalMusicPlayer {
    constructor() {
        this.playlist = [];
        this.currentSongIndex = -1;
        this.isPlaying = false;
        this.currentTime = 0;
        this.totalTime = 180;
        this.progressInterval = null;
        this.player = null;
        this.playerReady = false;
        this.useYouTube = false;
        this.socket = null;
        this.isInitiator = false;
        this.serverUrl = 'https://global-music-player.onrender.com';
        this.isConnected = false;
        this.offlineMode = false;
        this.connectionRetryCount = 0;
        this.maxRetries = 3;

        this.initializeElements();
        this.bindEvents();
        this.updateConnectionStatus('connecting', 'Connecting...');
        this.initializeWebSocket();
        this.initializePlayer();
    }

    initializeElements() {
        this.currentSongEl = document.getElementById('currentSong');
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.progressFill = document.getElementById('progressFill');
        this.currentTimeEl = document.getElementById('currentTime');
        this.totalTimeEl = document.getElementById('totalTime');
        this.songNameInput = document.getElementById('songName');
        this.artistNameInput = document.getElementById('artistName');
        this.addSongBtn = document.getElementById('addSongBtn');
        this.playlistContainer = document.getElementById('playlistContainer');
        this.totalSongsEl = document.getElementById('totalSongs');
        this.statusTextEl = document.getElementById('statusText');
        this.statusDotEl = document.getElementById('statusDot');
        this.errorMessageEl = document.getElementById('errorMessage');
    }

    bindEvents() {
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.previousSong());
        this.nextBtn.addEventListener('click', () => this.nextSong());
        this.addSongBtn.addEventListener('click', () => this.addSong());
        this.songNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSong();
        });
        this.artistNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addSong();
        });
    }

    updateConnectionStatus(status, message) {
        this.statusTextEl.textContent = message;
        this.statusDotEl.className = `status-dot ${status}`;
        
        if (status === 'connected') {
            this.isConnected = true;
            this.offlineMode = false;
            this.connectionRetryCount = 0;
        } else if (status === 'disconnected') {
            this.isConnected = false;
            if (this.connectionRetryCount >= this.maxRetries) {
                this.offlineMode = true;
                this.statusTextEl.textContent = 'Offline Mode';
                this.showMessage('Running in offline mode. Songs will be stored locally.', 'info');
            }
        }
    }

    showMessage(message, type = 'error') {
        this.errorMessageEl.textContent = message;
        this.errorMessageEl.className = type === 'error' ? 'error-message' : 'success-message';
        this.errorMessageEl.style.display = 'block';
        
        setTimeout(() => {
            this.errorMessageEl.style.display = 'none';
        }, 5000);
    }

    initializeWebSocket() {
        try {
            console.log('Connecting to WebSocket server...');
            this.socket = io(this.serverUrl, {
                timeout: 10000,
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.updateConnectionStatus('connected', 'Connected');
                this.connectionRetryCount = 0;
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.updateConnectionStatus('disconnected', 'Disconnected');
                this.handleDisconnection();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                this.connectionRetryCount++;
                this.updateConnectionStatus('disconnected', `Connection failed (${this.connectionRetryCount}/${this.maxRetries})`);
                this.handleDisconnection();
            });

            this.socket.on('sync-state', (state) => {
                console.log('Received state sync:', state);
                this.syncWithServerState(state);
            });

            this.socket.on('playlist-updated', (playlist) => {
                console.log('Playlist updated:', playlist);
                this.playlist = playlist;
                this.updatePlaylist();
                this.updateStats();
            });

            this.socket.on('playback-changed', (data) => {
                console.log('Playback changed:', data);
                if (!this.isInitiator) {
                    this.handlePlaybackChange(data);
                }
                this.isInitiator = false;
            });

            this.socket.on('song-changed', (data) => {
                console.log('Song changed:', data);
                if (!this.isInitiator) {
                    this.handleSongChange(data);
                }
                this.isInitiator = false;
            });

        } catch (error) {
            console.error('WebSocket initialization failed:', error);
            this.handleDisconnection();
        }
    }

    handleDisconnection() {
        if (this.connectionRetryCount < this.maxRetries) {
            setTimeout(() => {
                this.updateConnectionStatus('connecting', 'Reconnecting...');
                this.initializeWebSocket();
            }, 2000 * this.connectionRetryCount);
        } else {
            this.offlineMode = true;
            this.updateConnectionStatus('disconnected', 'Offline Mode');
            this.showMessage('Running in offline mode. Songs will be stored locally.', 'info');
        }
    }

    syncWithServerState(state) {
        this.playlist = state.playlist || [];
        this.currentSongIndex = state.currentSongIndex || -1;
        this.isPlaying = state.isPlaying || false;
        this.currentTime = state.currentTime || 0;
        
        // Calculate current time based on server timestamp
        if (this.isPlaying && state.lastUpdateTime) {
            const elapsed = (Date.now() - state.lastUpdateTime) / 1000;
            this.currentTime = Math.max(0, this.currentTime + elapsed);
        }
        
        this.updatePlaylist();
        this.updateCurrentSong();
        this.updateStats();
        
        if (this.currentSongIndex >= 0 && this.playerReady) {
            this.syncPlayback();
        }
    }

    handlePlaybackChange(data) {
        this.isPlaying = data.isPlaying;
        this.currentTime = data.currentTime || 0;
        
        // Calculate current time based on server timestamp
        if (this.isPlaying && data.timestamp) {
            const elapsed = (Date.now() - data.timestamp) / 1000;
            this.currentTime = Math.max(0, this.currentTime + elapsed);
        }
        
        this.syncPlayback();
    }

    handleSongChange(data) {
        this.currentSongIndex = data.currentSongIndex;
        this.currentTime = data.currentTime || 0;
        
        this.updateCurrentSong();
        this.updatePlaylist();
        
        if (this.playerReady) {
            this.syncPlayback();
        }
    }

    initializePlayer() {
        const playerContainer = document.createElement('div');
        playerContainer.id = 'youtube-player';
        playerContainer.style.display = 'none';
        document.body.appendChild(playerContainer);

        // Initialize without YouTube for now to avoid dependency issues
        this.playerReady = true;
        this.useYouTube = false;
        console.log('Player initialized in simulation mode');

        // Try to load YouTube API, but don't block if it fails
        this.loadYouTubeAPI();
    }

    loadYouTubeAPI() {
        try {
            window.onYouTubeIframeAPIReady = () => {
                console.log('YT IFrame API is ready');
                this.player = new YT.Player('youtube-player', {
                    height: '0',
                    width: '0',
                    playerVars: { autoplay: 0, controls: 0 },
                    events: {
                        onReady: () => {
                            console.log('YT Player ready');
                            this.useYouTube = true;
                            this.showMessage('YouTube player loaded successfully!', 'success');
                            
                            // Sync with current state if available
                            if (this.currentSongIndex >= 0 && this.playlist.length > 0) {
                                this.syncPlayback();
                            }
                        },
                        onStateChange: (e) => this.onPlayerStateChange(e),
                        onError: (e) => {
                            console.error('YT Player error:', e.data, 'trying next song');
                            this.handlePlayerError();
                        }
                    }
                });
            };

            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            tag.onerror = () => {
                console.log('YouTube API failed to load, continuing in simulation mode');
            };
            document.body.appendChild(tag);
        } catch (error) {
            console.error('Failed to load YouTube API:', error);
        }
    }

    onPlayerStateChange(event) {
        if (!this.useYouTube) return;
        
        if (event.data === YT.PlayerState.ENDED) {
            this.nextSong();
        } else if (event.data === YT.PlayerState.PLAYING) {
            this.playBtn.textContent = '⏸️';
            this.startProgress();
        } else if (event.data === YT.PlayerState.PAUSED) {
            this.playBtn.textContent = '▶️';
            this.stopProgress();
        }
    }

    handlePlayerError() {
        console.log('Video unavailable, skipping to next song');
        setTimeout(() => this.nextSong(), 1000);
    }

    syncPlayback() {
        if (this.currentSongIndex < 0 || this.currentSongIndex >= this.playlist.length) {
            return;
        }

        const song = this.playlist[this.currentSongIndex];
        
        if (this.useYouTube && song.videoId) {
            console.log(`Syncing playback: ${song.name} at ${this.currentTime}s`);
            
            this.player.loadVideoById({
                videoId: song.videoId,
                startSeconds: Math.max(0, this.currentTime)
            });
            
            if (this.isPlaying) {
                setTimeout(() => {
                    this.player.playVideo();
                }, 1000);
            }
        } else {
            // Fallback to simulation mode
            this.totalTime = Math.floor(Math.random() * 120) + 120;
            this.playBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
            if (this.isPlaying) {
                this.startProgress();
            } else {
                this.stopProgress();
            }
        }
    }

    async searchYouTube(query) {
        if (!this.isConnected) {
            return null;
        }

        console.log(`Searching: ${query}`);
        try {
            const response = await fetch(`${this.serverUrl}/api/youtube-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
                timeout: 10000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.videoId;
        } catch (error) {
            console.error('YouTube search failed:', error);
            return null;
        }
    }

    async addSong() {
        const name = this.songNameInput.value.trim();
        const artist = this.artistNameInput.value.trim();
        
        if (!name || !artist) {
            this.showMessage('Please enter both song name and artist');
            return;
        }

        this.addSongBtn.disabled = true;
        this.addSongBtn.textContent = 'Adding...';

        try {
            let videoId = null;
            
            // Try to search YouTube if connected
            if (this.isConnected && this.useYouTube) {
                this.addSongBtn.textContent = 'Searching YouTube...';
                videoId = await this.searchYouTube(`${name} ${artist}`);
            }

            const song = { name, artist, videoId };
            
            if (this.isConnected && this.socket) {
                // Send to server if connected
                this.socket.emit('add-song', song);
                this.showMessage(`Added "${name}" by ${artist} to the global playlist!`, 'success');
            } else {
                // Add locally in offline mode
                this.playlist.push(song);
                this.updatePlaylist();
                this.updateStats();
                this.showMessage(`Added "${name}" by ${artist} to local playlist (offline mode)`, 'success');
                
                // If this is the first song, set it as current
                if (this.playlist.length === 1) {
                    this.currentSongIndex = 0;
                    this.updateCurrentSong();
                }
            }

            this.songNameInput.value = '';
            this.artistNameInput.value = '';
            
        } catch (error) {
            console.error('Error adding song:', error);
            this.showMessage('Failed to add song. Please try again.');
        } finally {
            this.addSongBtn.disabled = false;
            this.addSongBtn.textContent = 'Add to Queue';
        }
    }

    playSong(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        if (this.isConnected && this.socket) {
            this.isInitiator = true;
            this.socket.emit('change-song', index);
        } else {
            // Handle locally in offline mode
            this.currentSongIndex = index;
            this.currentTime = 0;
            this.updateCurrentSong();
            this.updatePlaylist();
            this.syncPlayback();
        }
    }

    togglePlay() {
        if (!this.playlist.length) {
            this.showMessage('Add songs to the playlist first');
            return;
        }

        if (this.currentSongIndex < 0) {
            this.currentSongIndex = 0;
            this.updateCurrentSong();
        }
        
        if (this.isConnected && this.socket) {
            this.isInitiator = true;
            if (this.isPlaying) {
                this.socket.emit('pause');
            } else {
                this.socket.emit('play');
            }
        } else {
            // Handle locally in offline mode
            this.isPlaying = !this.isPlaying;
            this.syncPlayback();
        }
    }

    nextSong() {
        if (!this.playlist.length) return;
        
        if (this.isConnected && this.socket) {
            this.isInitiator = true;
            this.socket.emit('next-song');
        } else {
            // Handle locally in offline mode
            this.currentSongIndex = (this.currentSongIndex + 1) % this.playlist.length;
            this.currentTime = 0;
            this.updateCurrentSong();
            this.updatePlaylist();
            this.syncPlayback();
        }
    }

    previousSong() {
        if (!this.playlist.length) return;
        
        if (this.isConnected && this.socket) {
            this.isInitiator = true;
            this.socket.emit('previous-song');
        } else {
            // Handle locally in offline mode
            this.currentSongIndex = (this.currentSongIndex - 1 + this.playlist.length) % this.playlist.length;
            this.currentTime = 0;
            this.updateCurrentSong();
            this.updatePlaylist();
            this.syncPlayback();
        }
    }

    removeSong(index) {
        if (this.isConnected && this.socket) {
            this.socket.emit('remove-song', index);
        } else {
            // Handle locally in offline mode
            if (index >= 0 && index < this.playlist.length) {
                const removedSong = this.playlist.splice(index, 1)[0];
                
                // Adjust current song index if needed
                if (index === this.currentSongIndex) {
                    if (this.playlist.length > 0) {
                        this.currentSongIndex = index >= this.playlist.length ? 0 : index;
                    } else {
                        this.currentSongIndex = -1;
                        this.isPlaying = false;
                    }
                } else if (index < this.currentSongIndex) {
                    this.currentSongIndex--;
                }
                
                this.updatePlaylist();
                this.updateCurrentSong();
                this.updateStats();
                this.showMessage(`Removed "${removedSong.name}" from playlist`, 'success');
            }
        }
    }

    updatePlaylist() {
        this.playlistContainer.innerHTML = '';
        
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = '<p style="text-align: center; color: #6c757d;">No songs in playlist</p>';
            return;
        }

        this.playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = `playlist-item ${index === this.currentSongIndex ? 'current' : ''}`;
            item.innerHTML = `
                <div class="song-info">
                    <div class="song-name">${song.name}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <button class="remove-btn" onclick="musicPlayer.removeSong(${index})">Remove</button>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('remove-btn')) {
                    this.playSong(index);
                }
            });
            
            this.playlistContainer.appendChild(item);
        });
    }

    updateCurrentSong() {
        if (this.currentSongIndex >= 0 && this.currentSongIndex < this.playlist.length) {
            const song = this.playlist[this.currentSongIndex];
            this.currentSongEl.textContent = `${song.name} - ${song.artist}`;
        } else {
            this.currentSongEl.textContent = 'Add a song to get started!';
        }
    }

    updateStats() {
        this.totalSongsEl.textContent = this.playlist.length;
    }

    startProgress() {
        this.stopProgress();
        this.progressInterval = setInterval(() => {
            if (this.useYouTube && this.player && this.player.getCurrentTime) {
                try {
                    this.currentTime = this.player.getCurrentTime();
                    this.totalTime = this.player.getDuration() || 180;
                } catch (error) {
                    console.error('Error getting player time:', error);
                }
            } else {
                // Simulation mode
                this.currentTime += 1;
                if (this.currentTime >= this.totalTime) {
                    this.nextSong();
                    return;
                }
            }
            
            this.updateProgressBar();
            this.updateTimeDisplay();
            
            // Send time updates to server (throttled)
            if (this.isConnected && this.socket && this.currentTime % 5 === 0) {
                this.socket.emit('time-update', this.currentTime);
            }
        }, 1000);
    }

    stopProgress() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    updateProgressBar() {
        const progressPercent = (this.currentTime / this.totalTime) * 100;
        this.progressFill.style.width = `${Math.min(progressPercent, 100)}%`;
    }

    updateTimeDisplay() {
        this.currentTimeEl.textContent = this.formatTime(this.currentTime);
        this.totalTimeEl.textContent = this.formatTime(this.totalTime);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the music player when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Load Socket.IO from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js';
    script.onload = () => {
        console.log('Socket.IO loaded');
        window.musicPlayer = new GlobalMusicPlayer();
    };
    script.onerror = () => {
        console.log('Socket.IO failed to load, starting in offline mode');
        // Create a mock io object for offline mode
        window.io = () => ({
            on: () => {},
            emit: () => {},
            disconnect: () => {}
        });
        window.musicPlayer = new GlobalMusicPlayer();
    };
    document.head.appendChild(script);
});
