import { 
  listenToAudioPlayer, 
  initAudioPlayer,
  addToAudioPlaylistCommand,
  removeFromAudioPlaylistCommand,
  reorderAudioPlaylistCommand,
  issueAudioCommand
} from './firebaseService.js';
import { getCurrentUserName } from './auth.js';

let audioState = {
  currentVideoId: null,
  isPlaying: false,
  seekTime: 0,
  commandTime: 0,
  volume: 50,
  playlist: [],
  lastUpdated: null
};

let localVolume = 50;
let lastVolumeBeforeMute = 50;
let player = null;
let isReady = false;
let isLoadingVideo = false;
let lastProcessedCommandTime = 0;
let syncInterval = null;
let unsubscribe = null;
let draggedIndex = null;
let pendingState = null;

// Estados de controle
let isShuffle = false;
let isRepeat = false;
let isMuted = false;
let shuffleOrder = [];

function extractYouTubeId(url) {
  if (!url) return null;
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function fetchVideoTitle(videoId) {
  try {
    const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    const data = await response.json();
    if (data && data.title) {
      return data.title;
    }
  } catch (e) {
    console.warn('Could not fetch video title:', e);
  }
  return `YouTube Video`;
}

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    window.onYouTubeIframeAPIReady = () => {
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  });
}

function createPlayer() {
  player = new window.YT.Player('audio-yt-player', {
    height: '0',
    width: '0',
    videoId: '',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0
    },
    events: {
      onReady: () => {
        isReady = true;
        player.setVolume(localVolume);
        syncInterval = setInterval(driftCorrection, 3000);
        updateProgressBarInterval();
        
        if (pendingState) {
          console.log('[onReady] Applying pending state');
          applyStateToPlayer(pendingState);
          pendingState = null;
        }
      },
      onStateChange: (event) => {
        if (!isReady) return;
        
        switch (event.data) {
          case window.YT.PlayerState.CUED:
            console.log('[onStateChange] CUED - isPlaying:', audioState.isPlaying);
            isLoadingVideo = false;
            if (audioState.isPlaying) {
              player.playVideo();
            }
            break;
            
          case window.YT.PlayerState.ENDED:
            handleSongEnded();
            break;
            
          case window.YT.PlayerState.BUFFERING:
            break;
        }
      }
    }
  });
}

function handleSongEnded() {
  if (isRepeat) {
    skipTo(0);
    player.playVideo();
  } else {
    skipNext();
  }
}

function updateProgressBarInterval() {
  setInterval(updateProgressBar, 500);
}

function updateProgressBar() {
  if (!player || !isReady || !audioState.isPlaying) {
    hideProgressBar();
    return;
  }
  
  try {
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();
    
    if (!duration || duration === 0) {
      hideProgressBar();
      return;
    }
    
    showProgressBar();
    
    const percent = (currentTime / duration) * 100;
    
    const fill = document.getElementById('audio-progress-fill');
    const thumb = document.getElementById('audio-progress-thumb');
    const currentTimeEl = document.getElementById('audio-current-time');
    const durationEl = document.getElementById('audio-duration');
    
    if (fill) fill.style.width = `${percent}%`;
    if (thumb) thumb.style.left = `${percent}%`;
    if (currentTimeEl) currentTimeEl.textContent = formatTime(currentTime);
    if (durationEl) durationEl.textContent = formatTime(duration);
    
  } catch (e) {
    hideProgressBar();
  }
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showProgressBar() {
  const container = document.querySelector('.audio-progress-container');
  if (container) container.classList.add('is-active');
}

function hideProgressBar() {
  const container = document.querySelector('.audio-progress-container');
  if (container) container.classList.remove('is-active');
}

function seekTo(percent) {
  if (!player || !isReady || !audioState.currentVideoId) return;
  
  try {
    const duration = player.getDuration();
    if (!duration || duration === 0) return;
    
    const seekTime = (percent / 100) * duration;
    player.seekTo(seekTime, true);
    
    issueAudioCommand('seek', { seekTime });
  } catch (e) {
    console.warn('Seek error:', e);
  }
}

function generateShuffleOrder() {
  const indices = audioState.playlist.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

function getNextIndex() {
  if (audioState.playlist.length === 0) return -1;
  
  const currentIndex = audioState.playlist.findIndex(p => p.videoId === audioState.currentVideoId);
  
  if (isShuffle) {
    const currentShuffleIndex = shuffleOrder.indexOf(currentIndex);
    const nextShuffleIndex = currentShuffleIndex + 1;
    
    if (nextShuffleIndex >= shuffleOrder.length) {
      return -1;
    }
    return shuffleOrder[nextShuffleIndex];
  }
  
  return (currentIndex + 1) % audioState.playlist.length;
}

function getPrevIndex() {
  if (audioState.playlist.length === 0) return -1;
  
  const currentIndex = audioState.playlist.findIndex(p => p.videoId === audioState.currentVideoId);
  
  if (isShuffle) {
    const currentShuffleIndex = shuffleOrder.indexOf(currentIndex);
    const prevShuffleIndex = currentShuffleIndex - 1;
    
    if (prevShuffleIndex < 0) {
      return shuffleOrder[shuffleOrder.length - 1];
    }
    return shuffleOrder[prevShuffleIndex];
  }
  
  return currentIndex <= 0 ? audioState.playlist.length - 1 : currentIndex - 1;
}

function driftCorrection() {
  if (!player || !isReady || !audioState.currentVideoId) return;
  if (isLoadingVideo) return;
  
  try {
    const currentUrl = player.getVideoUrl();
    if (!currentUrl.includes(audioState.currentVideoId)) return;
    
    const localTime = player.getCurrentTime();
    const expectedPosition = audioState.seekTime + (Date.now() - audioState.commandTime) / 1000;
    
    if (Math.abs(localTime - expectedPosition) > 3) {
      player.seekTo(expectedPosition, true);
    }
  } catch (e) {
    // Player not ready
  }
}

function applyStateToPlayer(state) {
  if (!isReady || !player) {
    console.log('[applyStateToPlayer] Player not ready, saving pending state');
    pendingState = { ...state };
    return;
  }
  
  // Apply pending state and clear it
  if (pendingState) {
    console.log('[applyStateToPlayer] Applying pending state');
    pendingState = null;
  }
  
  isLoadingVideo = true;
  
  const currentUrl = player.getVideoUrl();
  const currentVideoIdLoaded = currentUrl ? extractYouTubeId(currentUrl) : null;
  
  if (currentVideoIdLoaded !== state.currentVideoId) {
    console.log('[applyStateToPlayer] Loading new video:', state.currentVideoId, 'isPlaying:', state.isPlaying);
    if (state.isPlaying) {
      player.loadVideoById({
        videoId: state.currentVideoId,
        startSeconds: state.seekTime,
        suggestedQuality: 'small'
      });
    } else {
      player.cueVideoById({
        videoId: state.currentVideoId,
        startSeconds: state.seekTime,
        suggestedQuality: 'small'
      });
    }
    return;
  }
  
  const playerState = player.getPlayerState();
  console.log('[applyStateToPlayer] Video already loaded, playerState:', playerState, 'isPlaying:', state.isPlaying);
  
  if (state.isPlaying && playerState !== window.YT.PlayerState.PLAYING) {
    player.playVideo();
  } else if (!state.isPlaying && playerState === window.YT.PlayerState.PLAYING) {
    player.pauseVideo();
  }
}

function syncToUI() {
  const sidebar = document.getElementById('audio-sidebar');
  if (!sidebar) return;
  
  const nowPlayingTitle = sidebar.querySelector('.audio-now-playing-title');
  const playlistEl = sidebar.querySelector('.audio-playlist-items');
  const playBtn = document.getElementById('audio-btn-play');
  const prevBtn = document.getElementById('audio-btn-prev');
  const nextBtn = document.getElementById('audio-btn-next');
  const shuffleBtn = document.getElementById('audio-btn-shuffle');
  const repeatBtn = document.getElementById('audio-btn-repeat');
  const muteBtn = document.getElementById('audio-btn-mute');
  const volumeSlider = document.getElementById('audio-volume');
  const playlistCount = document.getElementById('audio-playlist-count');
  
  // Now playing
  if (audioState.currentVideoId) {
    const currentItem = audioState.playlist.find(p => p.videoId === audioState.currentVideoId);
    if (nowPlayingTitle) {
      nowPlayingTitle.textContent = currentItem?.title || 'Música desconhecida';
      nowPlayingTitle.classList.remove('is-hidden');
    }
  } else {
    if (nowPlayingTitle) {
      nowPlayingTitle.textContent = 'Nenhuma música';
      nowPlayingTitle.classList.remove('is-hidden');
    }
  }
  
  // Playlist
  if (playlistEl) {
    playlistEl.innerHTML = audioState.playlist.map((item, index) => {
      const isActive = item.videoId === audioState.currentVideoId;
      return `
        <div class="audio-playlist-item ${isActive ? 'is-active' : ''}" draggable="true" data-index="${index}" data-id="${item.id}">
          <span class="audio-drag-handle"><i class="fas fa-grip-vertical"></i></span>
          <span class="audio-playlist-icon"><i class="fas fa-music"></i></span>
          <span class="audio-playlist-title">${item.title}</span>
          <button class="audio-btn-remove" data-id="${item.id}"><i class="fas fa-times"></i></button>
        </div>
      `;
    }).join('');
    
    playlistEl.querySelectorAll('.audio-playlist-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.audio-btn-remove') || e.target.closest('.audio-drag-handle')) return;
        const index = parseInt(item.dataset.index);
        skipTo(index);
      });
      
      item.addEventListener('dragstart', (e) => {
        draggedIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedIndex = null;
        document.querySelectorAll('.audio-playlist-item').forEach(i => i.classList.remove('drag-over'));
      });
      
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });
      
      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });
      
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const toIndex = parseInt(item.dataset.index);
        if (draggedIndex !== null && draggedIndex !== toIndex) {
          movePlaylistItem(draggedIndex, toIndex);
        }
        draggedIndex = null;
      });
    });
    
    playlistEl.querySelectorAll('.audio-btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        removeFromPlaylist(id);
      });
    });
  }
  
  // Controls
  if (playBtn) {
    playBtn.innerHTML = audioState.isPlaying 
      ? '<i class="fas fa-pause"></i>' 
      : '<i class="fas fa-play"></i>';
  }
  
  if (prevBtn) prevBtn.disabled = !audioState.currentVideoId || audioState.playlist.length === 0;
  if (nextBtn) nextBtn.disabled = audioState.playlist.length === 0;
  
  // Shuffle & Repeat
  if (shuffleBtn) shuffleBtn.classList.toggle('is-active', isShuffle);
  if (repeatBtn) repeatBtn.classList.toggle('is-active', isRepeat);
  
  // Mute
  if (muteBtn) {
    muteBtn.innerHTML = isMuted || localVolume === 0 
      ? '<i class="fas fa-volume-mute"></i>' 
      : '<i class="fas fa-volume-up"></i>';
    muteBtn.classList.toggle('is-muted', isMuted || localVolume === 0);
  }
  
  if (volumeSlider) volumeSlider.value = isMuted ? 0 : localVolume;
  
  if (playlistCount) playlistCount.textContent = audioState.playlist.length;
  
  // Show/hide progress bar
  if (audioState.isPlaying && audioState.currentVideoId) {
    showProgressBar();
  } else {
    hideProgressBar();
  }
}

export function toggleAudio() {
  const sidebar = document.getElementById('audio-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('is-hidden');
  }
}

export async function addAudioByUrl(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    console.error('Invalid YouTube URL');
    return;
  }
  
  const title = await fetchVideoTitle(videoId);
  const userName = getCurrentUserName();
  await addToAudioPlaylistCommand(videoId, title, userName);
  
  if (isShuffle) {
    shuffleOrder = generateShuffleOrder();
  }
  
  const shouldAutoPlay = !audioState.currentVideoId || !audioState.isPlaying;
  
  if (shouldAutoPlay) {
    await issueAudioCommand('skip', {
      currentVideoId: videoId,
      isPlaying: true,
      seekTime: 0
    });
  }
}

export async function removeFromPlaylist(id) {
  const item = audioState.playlist.find(p => p.id === id);
  if (!item) return;
  
  const wasCurrentVideo = item.videoId === audioState.currentVideoId;
  
  // 1. Encontrar próxima música ANTES de remover
  let nextItem = null;
  if (wasCurrentVideo && audioState.playlist.length > 1) {
    const currentIndex = audioState.playlist.findIndex(p => p.id === id);
    const remainingPlaylist = audioState.playlist.filter(p => p.id !== id);
    if (remainingPlaylist.length > 0) {
      const nextIndex = (currentIndex) % remainingPlaylist.length;
      nextItem = remainingPlaylist[nextIndex];
    }
  }
  
  // 2. Limpar tudo localmente primeiro
  if (wasCurrentVideo) {
    if (player && isReady) {
      player.stopVideo();
    }
    audioState.currentVideoId = null;
    audioState.isPlaying = false;
    audioState.playlist = audioState.playlist.filter(p => p.id !== id);
    hideProgressBar();
    syncToUI();
  }
  
  // 3. Remover do Firebase
  await removeFromAudioPlaylistCommand(id);
  
  // 4. Se tinha próxima, tocar ela
  if (nextItem) {
    await issueAudioCommand('skip', {
      currentVideoId: nextItem.videoId,
      isPlaying: true,
      seekTime: 0
    });
  }
  
  if (isShuffle) {
    shuffleOrder = generateShuffleOrder();
  }
}

export async function movePlaylistItem(fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= audioState.playlist.length || toIndex >= audioState.playlist.length) {
    return;
  }
  
  const newPlaylist = [...audioState.playlist];
  const [moved] = newPlaylist.splice(fromIndex, 1);
  newPlaylist.splice(toIndex, 0, moved);
  
  audioState.playlist = newPlaylist;
  syncToUI();
  await reorderAudioPlaylistCommand(newPlaylist);
  
  if (isShuffle) {
    shuffleOrder = generateShuffleOrder();
  }
  
  if (moved.videoId === audioState.currentVideoId) {
    await issueAudioCommand('skip', {
      currentVideoId: moved.videoId,
      isPlaying: audioState.isPlaying,
      seekTime: audioState.seekTime
    });
  }
}

export async function skipTo(index) {
  const item = audioState.playlist[index];
  if (!item) return;
  
  await issueAudioCommand('skip', {
    currentVideoId: item.videoId,
    isPlaying: true,
    seekTime: 0
  });
}

export async function skipNext() {
  if (audioState.playlist.length === 0) return;
  
  const nextIndex = getNextIndex();
  
  if (nextIndex === -1) {
    if (isRepeat) {
      await skipTo(0);
    } else {
      await issueAudioCommand('stop');
    }
    return;
  }
  
  await skipTo(nextIndex);
}

export async function skipPrev() {
  if (audioState.playlist.length === 0) return;
  
  const prevIndex = getPrevIndex();
  
  if (prevIndex === -1) return;
  
  await skipTo(prevIndex);
}

export async function togglePlayPause() {
  if (!audioState.currentVideoId && audioState.playlist.length > 0) {
    await skipTo(0);
    return;
  }
  
  if (!audioState.currentVideoId) return;
  
  const newState = !audioState.isPlaying;
  const currentSeekTime = player ? player.getCurrentTime() : 0;
  
  if (player && isReady) {
    if (newState) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
  }
  
  await issueAudioCommand('playPause', {
    isPlaying: newState,
    seekTime: currentSeekTime
  });
}

export function toggleMute() {
  isMuted = !isMuted;
  
  if (isMuted) {
    lastVolumeBeforeMute = localVolume > 0 ? localVolume : 50;
    localVolume = 0;
  } else {
    localVolume = lastVolumeBeforeMute;
  }
  
  if (player && isReady) {
    player.setVolume(localVolume);
  }
  
  const muteBtn = document.getElementById('audio-btn-mute');
  const volumeSlider = document.getElementById('audio-volume');
  
  if (muteBtn) {
    muteBtn.innerHTML = isMuted 
      ? '<i class="fas fa-volume-mute"></i>' 
      : '<i class="fas fa-volume-up"></i>';
    muteBtn.classList.toggle('is-muted', isMuted);
  }
  
  if (volumeSlider) {
    volumeSlider.value = isMuted ? 0 : localVolume;
  }
}

export function toggleShuffle() {
  isShuffle = !isShuffle;
  
  if (isShuffle) {
    shuffleOrder = generateShuffleOrder();
  }
  
  const shuffleBtn = document.getElementById('audio-btn-shuffle');
  if (shuffleBtn) {
    shuffleBtn.classList.toggle('is-active', isShuffle);
  }
}

export function toggleRepeat() {
  isRepeat = !isRepeat;
  
  const repeatBtn = document.getElementById('audio-btn-repeat');
  if (repeatBtn) {
    repeatBtn.classList.toggle('is-active', isRepeat);
  }
}

export function setVolume(level) {
  localVolume = Math.max(0, Math.min(100, level));
  
  if (localVolume > 0) {
    isMuted = false;
  }
  
  if (player && isReady) {
    player.setVolume(localVolume);
  }
  
  const muteBtn = document.getElementById('audio-btn-mute');
  const volumeSlider = document.getElementById('audio-volume');
  
  if (muteBtn) {
    muteBtn.innerHTML = localVolume === 0 || isMuted
      ? '<i class="fas fa-volume-mute"></i>'
      : '<i class="fas fa-volume-up"></i>';
    muteBtn.classList.toggle('is-muted', localVolume === 0 || isMuted);
  }
  
  if (volumeSlider) {
    volumeSlider.value = localVolume;
  }
}

export function getVolume() {
  return localVolume;
}

export async function initializeAudio() {
  await initAudioPlayer();
  await loadYouTubeAPI();
  createPlayer();
  
  unsubscribe = listenToAudioPlayer((data) => {
    if (!data) return;
    
    const remoteCommandTime = data.commandTime || 0;
    if (remoteCommandTime <= lastProcessedCommandTime) return;
    lastProcessedCommandTime = remoteCommandTime;
    
    audioState = {
      currentVideoId: data.currentVideoId,
      isPlaying: data.isPlaying,
      seekTime: data.seekTime || 0,
      commandTime: data.commandTime,
      volume: data.volume || 50,
      playlist: data.playlist || [],
      lastUpdated: data.lastUpdated
    };
    
    syncToUI();
    applyStateToPlayer(audioState);
  });
  
  setupEventListeners();
}

function setupEventListeners() {
  // Toggle audio
  const toggleBtn = document.getElementById('toggle-audio-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleAudio);
  }
  
  const closeBtn = document.getElementById('close-audio-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', toggleAudio);
  }
  
  // Play controls
  const playBtn = document.getElementById('audio-btn-play');
  if (playBtn) {
    playBtn.addEventListener('click', togglePlayPause);
  }
  
  const prevBtn = document.getElementById('audio-btn-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', skipPrev);
  }
  
  const nextBtn = document.getElementById('audio-btn-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', skipNext);
  }
  
  // Shuffle & Repeat
  const shuffleBtn = document.getElementById('audio-btn-shuffle');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', toggleShuffle);
  }
  
  const repeatBtn = document.getElementById('audio-btn-repeat');
  if (repeatBtn) {
    repeatBtn.addEventListener('click', toggleRepeat);
  }
  
  // Mute
  const muteBtn = document.getElementById('audio-btn-mute');
  if (muteBtn) {
    muteBtn.addEventListener('click', toggleMute);
  }
  
  // Volume
  const volumeSlider = document.getElementById('audio-volume');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      setVolume(parseInt(e.target.value));
    });
  }
  
  // Progress bar click
  const progressBar = document.getElementById('audio-progress-bar');
  if (progressBar) {
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      seekTo(Math.max(0, Math.min(100, percent)));
    });
  }
  
  // Add music
  const addBtn = document.getElementById('audio-add-btn');
  const urlInput = document.getElementById('audio-url-input');
  
  if (addBtn && urlInput) {
    addBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (url) {
        await addAudioByUrl(url);
        urlInput.value = '';
      }
    });
    
    urlInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const url = urlInput.value.trim();
        if (url) {
          await addAudioByUrl(url);
          urlInput.value = '';
        }
      }
    });
  }
}

export default {
  initializeAudio,
  toggleAudio,
  addAudioByUrl,
  removeFromPlaylist,
  skipTo,
  skipNext,
  skipPrev,
  togglePlayPause,
  toggleMute,
  toggleShuffle,
  toggleRepeat,
  setVolume,
  getVolume
};
