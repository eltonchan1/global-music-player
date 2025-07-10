// Updated GlobalMusicPlayer class with WebSocket synchronization

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
        this.isInitiator = false; // Track if this client initiated an action
        this.serverUrl = 'https://global-music-player.onrender.com';

        this.initializeElements();
        this.bindEvents();
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

    initializeWebSocket() {
        console.log('Connecting to WebSocket server...');
        this.socket = io(this.serverUrl);

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        this.socket.on('sync-state', (state) => {
            console.log('Received state sync:', state);
            this.playlist = state.playlist;
            this.currentSongIndex = state.currentSongIndex;
            this.isPlaying = state.isPlaying;
            this.currentTime = state.currentTime;
            
            // Calculate current time based on server timestamp
            if (this.isPlaying && state.lastUpdateTime) {
                const elapsed = (Date.now() - state.lastUpdateTime) / 1000;
                this.currentTime += elapsed;
            }
            
            this.updatePlaylist();
            this.updateCurrentSong();
            this.updateStats();
            
            if (this.currentSongIndex >= 0 && this.playerReady) {
                this.syncPlayback();
            }
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
                this.isPlaying = data.isPlaying;
                this.currentTime = data.currentTime;
                
                // Calculate current time based on server timestamp
                if (this.isPlaying && data.timestamp) {
                    const elapsed = (Date.now() - data.timestamp) / 1000;
                    this.currentTime += elapsed;
                }
                
                this.syncPlayback();
            }
            this.isInitiator = false;
        });

        this.socket.on('song-changed', (data) => {
            console.log('Song changed:', data);
            if (!this.isInitiator) {
                this.currentSongIndex = data.currentSongIndex;
                this.currentTime = data.currentTime;
                
                this.updateCurrentSong();
                this.updatePlaylist();
                
                if (this.playerReady) {
                    this.syncPlayback();
                }
            }
            this.isInitiator = false;
        });
    }

    initializePlayer() {
        const playerContainer = document.createElement('div');
        playerContainer.id = 'youtube-player';
        playerContainer.style.display = 'none';
        document.body.appendChild(playerContainer);

        window.onYouTubeIframeAPIReady = () => {
            console.log('YT IFrame API is ready');
            this.player = new YT.Player('youtube-player', {
                height: '0',
                width: '0',
                playerVars: { autoplay: 0, controls: 0 },
                events: {
                    onReady: () => {
                        console.log('YT Player ready');
                        this.playerReady = true;
                        this.useYouTube = true;
                        
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
        document.body.appendChild(tag);
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
        if (!this.playerReady || this.currentSongIndex < 0 || this.currentSongIndex >= this.playlist.length) {
            return;
        }

        const song = this.playlist[this.currentSongIndex];
        
        if (this.useYouTube && song.videoId) {
            console.log(`Syncing playback: ${song.name} at ${this.currentTime}s`);
            
            this.player.loadVideoById({
                videoId: song.videoId,
                startSeconds: this.currentTime
            });
            
            if (this.isPlaying) {
                setTimeout(() => {
                    this.player.playVideo();
                }, 1000);
            }
        } else {
            // Fallback to simulation mode
            this.totalTime = Math.floor(Math.random() * 120) + 120;
            if (this.isPlaying) {
                this.startProgress();
            }
        }
    }

    async searchYouTube(query) {
        console.log(`Searching: ${query}`);
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
            console.error('YouTube search failed:', error);
            return null;
        }
    }

    async addSong() {
        const name = this.songNameInput.value.trim();
        const artist = this.artistNameInput.value.trim();
        if (!name || !artist) return alert('Please enter both song name and artist');

        this.addSongBtn.disabled = true;
        this.addSongBtn.textContent = 'Searching...';

        let videoId = null;
        if (this.useYouTube) {
            videoId = await this.searchYouTube(`${name} ${artist}`);
        }

        const song = { name, artist, videoId };
        
        // Emit to server instead of adding locally
        this.socket.emit('add-song', song);

        this.songNameInput.value = '';
        this.artistNameInput.value = '';
        this.addSongBtn.disabled = false;
        this.addSongBtn.textContent = 'Add to Queue';
    }

    playSong(index) {
        if (!this.playerReady) return alert('Player is not ready yet');
        
        this.isInitiator = true;
        this.socket.emit('change-song', index);
    }

    togglePlay() {
        if (!this.playerReady) return alert('Player not ready yet');
        if (!this.playlist.length) return alert('Add songs to the playlist first');
        
        this.isInitiator = true;
        
        if (this.isPlaying) {
            this.socket.emit('pause');
        } else {
            this.socket.emit('play');
        }
    }

    nextSong() {
        if (!this.playlist.length) return;
        
        this.isInitiator = true;
        this.socket.emit('next-song');
    }

    previousSong() {
        if (!this.playlist.length) return;
        
        this.isInitiator = true;
        this.socket.emit('previous-song');
    }

    removeSong(index) {
        this.socket.emit('remove-song', index);
    }

    startProgress() {
        this.stopProgress();
        this.progressInterval = setInterval(() => {
            if (this.useYouTube && this.player) {
                try {
                    this.currentTime = Math.floor(this.player.getCurrentTime());
                    this.totalTime = Math.floor(this.player.getDuration()) || 0;
                    
                    // Send time update to server occasionally
                    if (Math.floor(this.currentTime) % 5 === 0) {
                        this.socket.emit('time-update', this.currentTime);
                    }
                } catch (e) {
                    console.error('Error getting player time:', e);
                }
            } else {
                this.currentTime += 1;
                if (this.currentTime >= this.totalTime) {
                    this.nextSong();
                    return;
                }
            }
            this.updateProgress();
        }, 1000);
    }

    stopProgress() {
        if (this.progressInterval) clearInterval(this.progressInterval);
    }

    updateProgress() {
        const percent = (this.currentTime / this.totalTime) * 100;
        this.progressFill.style.width = `${Math.min(percent, 100)}%`;
        this.currentTimeEl.textContent = this.formatTime(this.currentTime);
        this.totalTimeEl.textContent = this.formatTime(this.totalTime);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateCurrentSong() {
        const song = this.playlist[this.currentSongIndex];
        this.currentSongEl.textContent = song ? `${song.name} - ${song.artist}` : 'No song playing';
    }

    updatePlaylist() {
        this.playlistContainer.innerHTML = '';
        this.playlist.forEach((song, i) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            if (i === this.currentSongIndex) item.classList.add('current');
            item.innerHTML = `
                <div><b>${song.name}</b> - ${song.artist}</div>
                <button onclick="player.removeSong(${i})">Remove</button>`;
            item.addEventListener('click', (e) => {
                if (!e.target.matches('button')) this.playSong(i);
            });
            this.playlistContainer.appendChild(item);
        });
    }

    updateStats() {
        this.totalSongsEl.textContent = this.playlist.length;
    }
}

// Load Socket.IO library
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js';
script.onload = () => {
    document.addEventListener('DOMContentLoaded', () => {
        window.player = new GlobalMusicPlayer();
    });
};
document.head.appendChild(script);
