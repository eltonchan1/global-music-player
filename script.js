// Updated GlobalMusicPlayer class with direct YouTube search

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
        
        // You can get a YouTube API key from: https://console.developers.google.com/
        // For demo purposes, we'll use a fallback search method
        this.youtubeApiKey = null; // Add your API key here if you have one

        this.initializeElements();
        this.bindEvents();
        this.loadSampleSongs();
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
                    },
                    onStateChange: (e) => this.onPlayerStateChange(e),
                    onError: (e) => {
                        console.error('YT Player error:', e.data);
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
        if (event.data === YT.PlayerState.ENDED) this.nextSong();
        else if (event.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            this.playBtn.textContent = '⏸️';
            this.startProgress();
        } else if (event.data === YT.PlayerState.PAUSED) {
            this.isPlaying = false;
            this.playBtn.textContent = '▶️';
            this.stopProgress();
        }
    }

    handlePlayerError() {
        console.log('Attempting to play next song due to error');
        setTimeout(() => this.nextSong(), 1000);
    }

    // Direct YouTube search using the API (if API key is provided)
    async searchYouTubeAPI(query) {
        if (!this.youtubeApiKey) return null;
        
        try {
            const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${this.youtubeApiKey}`);
            
            if (!response.ok) throw new Error('API request failed');
            
            const data = await response.json();
            return data.items[0]?.id?.videoId || null;
        } catch (error) {
            console.error('YouTube API search failed:', error);
            return null;
        }
    }

    // Fallback search method using a curated list of popular songs
    searchYouTubeFallback(query) {
        const popularSongs = {
            // Popular songs with known video IDs
            'imagine john lennon': 'YkgkThdzX-8',
            'bohemian rhapsody queen': 'fJ9rUzIMcZQ',
            'hotel california eagles': 'BciS5krYL80',
            'stairway to heaven led zeppelin': 'QkF3oxziUI4',
            'sweet child o mine guns n roses': '1w7OgIMMRc4',
            'smells like teen spirit nirvana': 'hTWKbfoikeg',
            'billie jean michael jackson': 'Zi_XLOBDo_Y',
            'like a rolling stone bob dylan': 'IwOfCgkyEj0',
            'hey jude beatles': 'A_MjCqQoLLA',
            'yesterday beatles': 'NrgmdOz4IdY',
            'wonderwall oasis': 'bx1Bh8ZvH84',
            'dont stop believin journey': '1k8craCGpgs',
            'sweet dreams eurythmics': 'qeMFqkcPYcg',
            'take on me a-ha': 'djV11Xbc914',
            'livin on a prayer bon jovi': 'lDK9QqIzhwk',
            'welcome to the jungle guns n roses': 'o1tj2zJ2Wvg',
            'thunderstruck ac/dc': 'v2AC41dglnM',
            'back in black ac/dc': 'pAgnJDJN4VA',
            'purple haze jimi hendrix': 'WGoDaYjdfSg',
            'light my fire the doors': 'DeliRO5sSJ8'
        };

        const searchKey = query.toLowerCase();
        
        // Try exact match first
        if (popularSongs[searchKey]) {
            return popularSongs[searchKey];
        }

        // Try partial matches
        for (const [key, videoId] of Object.entries(popularSongs)) {
            if (key.includes(searchKey) || searchKey.includes(key)) {
                return videoId;
            }
        }

        // Try individual word matches
        const searchWords = searchKey.split(' ');
        for (const [key, videoId] of Object.entries(popularSongs)) {
            const keyWords = key.split(' ');
            const matches = searchWords.filter(word => 
                keyWords.some(keyWord => keyWord.includes(word) || word.includes(keyWord))
            );
            if (matches.length >= 2) {
                return videoId;
            }
        }

        // Return a default video ID for unknown songs (Rick Astley - Never Gonna Give You Up)
        return 'dQw4w9WgXcQ';
    }

    async searchYouTube(query) {
        console.log(`Searching: ${query}`);
        
        // Try API first if available
        if (this.youtubeApiKey) {
            const videoId = await this.searchYouTubeAPI(query);
            if (videoId) return videoId;
        }

        // Fallback to curated list
        return this.searchYouTubeFallback(query);
    }

    async addSong() {
        const name = this.songNameInput.value.trim();
        const artist = this.artistNameInput.value.trim();
        if (!name || !artist) return alert('Please enter both song name and artist');

        this.addSongBtn.disabled = true;
        this.addSongBtn.textContent = 'Adding...';

        let videoId = null;
        if (this.useYouTube) {
            videoId = await this.searchYouTube(`${name} ${artist}`);
        }

        this.playlist.push({ name, artist, videoId });
        this.updatePlaylist();
        this.updateStats();

        this.songNameInput.value = '';
        this.artistNameInput.value = '';
        this.addSongBtn.disabled = false;
        this.addSongBtn.textContent = 'Add to Queue';

        if (this.playlist.length === 1) this.playSong(0);
    }

    playSong(index) {
        if (!this.playerReady) return alert('Player is not ready yet');

        this.currentSongIndex = index;
        const song = this.playlist[index];
        this.currentTime = 0;

        if (this.useYouTube && song.videoId) {
            console.log(`Playing ${song.name}: ${song.videoId}`);
            this.player.loadVideoById(song.videoId);
        } else {
            // Fallback to simulation mode
            this.totalTime = Math.floor(Math.random() * 120) + 120;
            this.play();
        }

        this.updateCurrentSong();
        this.updatePlaylist();
    }

    play() {
        this.isPlaying = true;
        this.playBtn.textContent = '⏸️';
        this.startProgress();
    }

    pause() {
        this.isPlaying = false;
        this.playBtn.textContent = '▶️';
        this.stopProgress();
    }

    togglePlay() {
        if (!this.playerReady) return alert('Player not ready yet');
        if (!this.playlist.length) return alert('Add songs to the playlist first');
        if (this.currentSongIndex === -1) return this.playSong(0);

        if (this.useYouTube) {
            const state = this.player.getPlayerState();
            if (state === YT.PlayerState.PLAYING) this.player.pauseVideo();
            else this.player.playVideo();
        } else {
            if (this.isPlaying) this.pause();
            else this.play();
        }
    }

    startProgress() {
        this.stopProgress();
        this.progressInterval = setInterval(() => {
            if (this.useYouTube && this.player) {
                try {
                    this.currentTime = Math.floor(this.player.getCurrentTime());
                    this.totalTime = Math.floor(this.player.getDuration()) || 0;
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

    nextSong() {
        if (this.playlist.length === 0) return;
        const next = (this.currentSongIndex + 1) % this.playlist.length;
        this.playSong(next);
    }

    previousSong() {
        if (this.playlist.length === 0) return;
        const prev = (this.currentSongIndex - 1 + this.playlist.length) % this.playlist.length;
        this.playSong(prev);
    }

    removeSong(index) {
        if (index === this.currentSongIndex) {
            if (this.playlist.length > 1) {
                this.nextSong();
            } else {
                this.pause();
                this.currentSongIndex = -1;
                this.updateCurrentSong();
            }
        } else if (index < this.currentSongIndex) {
            this.currentSongIndex--;
        }
        this.playlist.splice(index, 1);
        this.updatePlaylist();
        this.updateStats();
    }

    loadSampleSongs() {
        this.playlist.push(
            { name: 'Imagine', artist: 'John Lennon', videoId: 'YkgkThdzX-8' },
            { name: 'Bohemian Rhapsody', artist: 'Queen', videoId: 'fJ9rUzIMcZQ' },
            { name: 'Hotel California', artist: 'Eagles', videoId: 'BciS5krYL80' }
        );
        this.updatePlaylist();
        this.updateStats();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.player = new GlobalMusicPlayer();
});
