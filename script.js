class GlobalMusicPlayer {
    constructor() {
        this.playlist = [];
        this.currentSongIndex = -1;
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.totalTime = 200; // Default song length
        this.volume = 50;
        this.progressInterval = null;
        this.playbackUpdateTimeout = null;
        this.lastEventTime = 0;
        this.eventThrottleDelay = 100; // Prevent rapid event firing

        this.initializeElements();
        this.bindEvents();
        this.loadFromStorage();
        this.updateDisplay();
        this.showMessage('Running in offline mode - songs stored locally', 'info');
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
        const data = {
            playlist: this.playlist,
            currentSongIndex: this.currentSongIndex,
            volume: this.volume
        };
        localStorage.setItem('globalMusicPlayer', JSON.stringify(data));
    }

    showMessage(message, type = 'info') {
        const now = Date.now();
        if (now - this.lastEventTime < this.eventThrottleDelay) {
            return; // Throttle rapid messages
        }
        this.lastEventTime = now;

        this.elements.messageContainer.textContent = message;
        this.elements.messageContainer.className = `message ${type}-message`;
        this.elements.messageContainer.style.display = 'block';
        
        setTimeout(() => {
            this.elements.messageContainer.style.display = 'none';
        }, 4000);
    }

    addSong() {
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

        const song = {
            name,
            artist,
            duration: Math.floor(Math.random() * 120) + 120, // Random duration 2-4 minutes
            id: Date.now() + Math.random()
        };

        this.playlist.push(song);
        this.updatePlaylist();
        this.saveToStorage();
        this.showMessage(`Added "${name}" by ${artist} to playlist`, 'success');
        
        // Clear inputs
        this.elements.songName.value = '';
        this.elements.artistName.value = '';
        
        // If this is the first song, set it as current
        if (this.playlist.length === 1) {
            this.currentSongIndex = 0;
            this.updateCurrentSong();
        }
    }

    removeSong(index) {
        if (index >= 0 && index < this.playlist.length) {
            const removedSong = this.playlist[index];
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
            this.showMessage(`Removed "${removedSong.name}" from playlist`, 'success');
        }
    }

    playSong(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.currentSongIndex = index;
            this.currentTime = 0;
            this.isPlaying = true;
            this.isPaused = false;
            this.updateDisplay();
            this.startProgress();
            this.saveToStorage();
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

    nextSong() {
        if (this.playlist.length === 0) return;
        
        this.currentSongIndex = (this.currentSongIndex + 1) % this.playlist.length;
        this.currentTime = 0;
        
        if (this.isPlaying) {
            this.startProgress();
        }
        
        this.updateDisplay();
        this.saveToStorage();
        this.showMessage('Next song', 'info');
    }

    previousSong() {
        if (this.playlist.length === 0) return;
        
        this.currentSongIndex = (this.currentSongIndex - 1 + this.playlist.length) % this.playlist.length;
        this.currentTime = 0;
        
        if (this.isPlaying) {
            this.startProgress();
        }
        
        this.updateDisplay();
        this.saveToStorage();
        this.showMessage('Previous song', 'info');
    }

    seekTo(event) {
        if (this.currentSongIndex < 0) return;
        
        const rect = this.elements.progressBar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        this.currentTime = Math.max(0, Math.min(this.totalTime, percent * this.totalTime));
        
        this.updateProgressBar();
        this.updateTimeDisplay();
        this.showMessage(`Seeked to ${this.formatTime(this.currentTime)}`, 'info');
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
            item.innerHTML = `
                <div class="song-info">
                    <div class="song-name">${song.name}</div>
                    <div class="song-artist">${song.artist} • ${this.formatTime(song.duration)}</div>
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
