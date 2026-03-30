import { 
  listenToAudioPlayer, 
  initAudioPlayer,
  addToAudioPlaylistCommand,
  removeFromAudioPlaylistCommand,
  reorderAudioPlaylistCommand,
  issueAudioCommand,
  updateAudioVolume
} from './firebaseService.js';
import { getCurrentUserName } from './auth.js';

const DEFAULT_VOLUME = 50;

let audioState = {
  currentVideoId: null,
  isPlaying: false,
  seekTime: 0,
  commandTime: 0,
  volume: DEFAULT_VOLUME,
  playlist: [],
  lastUpdated: null
};

let iframePlayer = null;
let iframeReady = false;
let lastProcessedCommandTime = 0;
let unsubscribe = null;
let draggedIndex = null;

let isShuffle = false;
let isRepeat = false;
let isMuted = false;
let localMutedVolume = 0;
let shuffleOrder = [];

let pendingState = null;
let pendingRetry = null;

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
  } catch (e) {}
  return `YouTube Video`;
}

function getIframe() {
  if (!iframePlayer) {
    iframePlayer = document.getElementById('audio-player-frame');
  }
  return iframePlayer;
}

function sendToIframe(type, payload = {}) {
  const iframe = getIframe();
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ type: `AUDIO_${type}`, payload }, '*');
  }
}

function handleIframeStateUpdate(state) {
  if (!state) return;
  
  if (state.videoId) {
    audioState.currentVideoId = state.videoId;
  }
  audioState.isPlaying = state.isPlaying;
  
  if (state.currentTime !== undefined) {
    audioState.seekTime = state.currentTime;
  }
  
  syncToUI();
  updateProgressBarFromIframe(state);
}

function updateProgressBarFromIframe(state) {
  if (!state || !audioState.isPlaying || !state.videoId) {
    hideProgressBar();
    return;
  }
  
  const currentTime = state.currentTime || 0;
  const duration = state.duration || 0;
  
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
  if (!audioState.currentVideoId || !iframeReady) return;
  
  sendToIframe('SEEK', { time: percent });
  
  issueAudioCommand('seek', { seekTime: percent });
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

function applyPendingState() {
  if (!pendingState) return;
  const state = pendingState;
  pendingState = null;
  applyStateToPlayer(state);
}

function scheduleRetry(state) {
  if (pendingRetry) clearTimeout(pendingRetry);
  
  pendingRetry = setTimeout(() => {
    if (!iframeReady) {
      scheduleRetry(state);
    } else {
      applyPendingState();
    }
  }, 500);
}

function applyStateToPlayer(state) {
  if (!iframeReady) {
    pendingState = state;
    scheduleRetry(state);
    
    if (state.currentVideoId) {
      const effectiveSeekTime = state.seekTime || 0;
      sendToIframe('LOAD_VIDEO', {
        videoId: state.currentVideoId,
        startSeconds: effectiveSeekTime,
        isPlaying: state.isPlaying
      });
      sendToIframe('SET_VOLUME', { level: isMuted ? 0 : (state.volume || 50) });
      iframeReady = true;
    }
    return;
  }

  if (pendingRetry) {
    clearTimeout(pendingRetry);
    pendingRetry = null;
  }

  if (state.currentVideoId) {
    sendToIframe('LOAD_VIDEO', {
      videoId: state.currentVideoId,
      startSeconds: 0,
      isPlaying: state.isPlaying
    });
  } else if (state.isPlaying) {
    sendToIframe('PLAY');
  } else {
    sendToIframe('PAUSE');
  }
  
  sendToIframe('SET_VOLUME', { level: isMuted ? 0 : (state.volume || 50) });
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
  
  if (playlistEl) {
    playlistEl.innerHTML = audioState.playlist.map((item, index) => {
      const isActive = item.videoId === audioState.currentVideoId;
      return `
        <div class="audio-playlist-item ${isActive ? 'is-active' : ''}" draggable="true" data-index="${index}" data-id="${item.id}">
          <span class="audio-drag-handle"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm6-12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg></span>
          <span class="audio-playlist-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></span>
          <span class="audio-playlist-title">${item.title}</span>
          <button class="audio-btn-remove" data-id="${item.id}"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
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
  
  if (playBtn) {
    playBtn.innerHTML = audioState.isPlaying 
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' 
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  
  if (prevBtn) prevBtn.disabled = !audioState.currentVideoId || audioState.playlist.length === 0;
  if (nextBtn) nextBtn.disabled = audioState.playlist.length === 0;
  
  if (shuffleBtn) shuffleBtn.classList.toggle('is-active', isShuffle);
  if (repeatBtn) repeatBtn.classList.toggle('is-active', isRepeat);
  
  if (muteBtn) {
    muteBtn.innerHTML = isMuted || audioState.volume === 0 
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>' 
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    muteBtn.classList.toggle('is-muted', isMuted || audioState.volume === 0);
  }
  
  if (volumeSlider) volumeSlider.value = isMuted ? 0 : audioState.volume;
  
  if (playlistCount) playlistCount.textContent = audioState.playlist.length;
  
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
  if (!videoId) return;
  
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
  
  let nextItem = null;
  if (wasCurrentVideo && audioState.playlist.length > 1) {
    const currentIndex = audioState.playlist.findIndex(p => p.id === id);
    const remainingPlaylist = audioState.playlist.filter(p => p.id !== id);
    if (remainingPlaylist.length > 0) {
      const nextIndex = (currentIndex) % remainingPlaylist.length;
      nextItem = remainingPlaylist[nextIndex];
    }
  }
  
  if (wasCurrentVideo) {
    sendToIframe('STOP');
    audioState.currentVideoId = null;
    audioState.isPlaying = false;
    audioState.playlist = audioState.playlist.filter(p => p.id !== id);
    hideProgressBar();
    syncToUI();
  }
  
  await removeFromAudioPlaylistCommand(id);
  
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
  
  if (!iframeReady && audioState.currentVideoId) {
    sendToIframe('LOAD_VIDEO', {
      videoId: audioState.currentVideoId,
      startSeconds: 0,
      isPlaying: newState
    });
  } else if (iframeReady) {
    if (newState) {
      sendToIframe('PLAY');
    } else {
      sendToIframe('PAUSE');
    }
  }
  
  await issueAudioCommand('playPause', {
    isPlaying: newState,
    seekTime: 0
  });
}

export function toggleMute() {
  isMuted = !isMuted;
  
  const effectiveVolume = isMuted ? 0 : audioState.volume;
  
  if (iframeReady) {
    sendToIframe('SET_VOLUME', { level: effectiveVolume });
  }
  
  const muteBtn = document.getElementById('audio-btn-mute');
  const volumeSlider = document.getElementById('audio-volume');
  
  if (muteBtn) {
    muteBtn.innerHTML = isMuted 
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>' 
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    muteBtn.classList.toggle('is-muted', isMuted);
  }
  
  if (volumeSlider) {
    volumeSlider.value = isMuted ? 0 : audioState.volume;
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

export async function setVolume(level) {
  const newVolume = Math.max(0, Math.min(100, level));
  
  if (newVolume > 0) {
    isMuted = false;
  }
  
  audioState.volume = newVolume;
  
  if (iframeReady) {
    sendToIframe('SET_VOLUME', { level: isMuted ? 0 : newVolume });
  }
  
  await updateAudioVolume(newVolume);
  
  const muteBtn = document.getElementById('audio-btn-mute');
  const volumeSlider = document.getElementById('audio-volume');
  
  if (muteBtn) {
    muteBtn.innerHTML = newVolume === 0 || isMuted
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    muteBtn.classList.toggle('is-muted', newVolume === 0 || isMuted);
  }
  
  if (volumeSlider) {
    volumeSlider.value = newVolume;
  }
}

export function getVolume() {
  return audioState.volume;
}

let _audioInitialized = false;

export async function initializeAudio() {
  if (_audioInitialized) return;
  _audioInitialized = true;

  const existingData = await initAudioPlayer();
  if (existingData) {
    audioState = {
      currentVideoId: existingData.currentVideoId,
      isPlaying: existingData.isPlaying || false,
      seekTime: existingData.seekTime || 0,
      commandTime: existingData.commandTime || 0,
      volume: existingData.volume || DEFAULT_VOLUME,
      playlist: existingData.playlist || [],
      lastUpdated: existingData.lastUpdated
    };
    
    syncToUI();
    if (audioState.currentVideoId) {
      sendToIframe('LOAD_VIDEO', {
        videoId: audioState.currentVideoId,
        startSeconds: 0,
        isPlaying: true
      });
      sendToIframe('SET_VOLUME', { level: isMuted ? 0 : audioState.volume });
    }
  }

  const volumeSlider = document.getElementById('audio-volume');
  if (volumeSlider) volumeSlider.value = audioState.volume;

  window.addEventListener('message', (event) => {
    if (event.data?.type === 'AUDIO_STATE_UPDATE') {
      const wasReady = iframeReady;
      iframeReady = true;

      if (!wasReady) {
        sendToIframe('SET_VOLUME', { level: isMuted ? 0 : audioState.volume });
        if (audioState.currentVideoId && audioState.isPlaying) {
          sendToIframe('LOAD_VIDEO', {
            videoId: audioState.currentVideoId,
            startSeconds: 0,
            isPlaying: true
          });
        }
        setTimeout(() => {
          if (pendingState) {
            applyPendingState();
          }
        }, 500);
      }

      handleIframeStateUpdate(event.data.state);
    }
  });

  const iframe = getIframe();
  if (iframe) {
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        sendToIframe('SET_VOLUME', { level: isMuted ? 0 : audioState.volume });
        if (pendingState) {
          applyPendingState();
        }
      }, 500);
    });
  }

  setTimeout(() => {
    if (!iframeReady) {
      sendToIframe('GET_STATE', {});
    }
  }, 2000);

  unsubscribe = listenToAudioPlayer((data) => {
    if (!data) return;

    const remoteCommandTime = data.commandTime || 0;
    if (lastProcessedCommandTime > 0 && remoteCommandTime <= lastProcessedCommandTime) return;
    lastProcessedCommandTime = remoteCommandTime;

    audioState = {
      currentVideoId: data.currentVideoId,
      isPlaying: data.isPlaying,
      seekTime: data.seekTime || 0,
      commandTime: data.commandTime,
      volume: data.volume || DEFAULT_VOLUME,
      playlist: data.playlist || [],
      lastUpdated: data.lastUpdated
    };

    syncToUI();
    applyStateToPlayer(audioState);
  });

  setupEventListeners();
}

function setupEventListeners() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#toggle-audio-btn')) {
      toggleAudio();
    }
    if (e.target.closest('#close-audio-btn')) {
      toggleAudio();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('audio-sidebar');
      if (sidebar && !sidebar.classList.contains('is-hidden')) {
        toggleAudio();
      }
    }
  });
  
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
  
  const shuffleBtn = document.getElementById('audio-btn-shuffle');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', toggleShuffle);
  }
  
  const repeatBtn = document.getElementById('audio-btn-repeat');
  if (repeatBtn) {
    repeatBtn.addEventListener('click', toggleRepeat);
  }
  
  const muteBtn = document.getElementById('audio-btn-mute');
  if (muteBtn) {
    muteBtn.addEventListener('click', toggleMute);
  }
  
  const volumeSlider = document.getElementById('audio-volume');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', async (e) => {
      await setVolume(parseInt(e.target.value));
    });
  }
  
  const progressBar = document.getElementById('audio-progress-bar');
  if (progressBar) {
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      seekTo(Math.max(0, Math.min(100, percent)));
    });
  }
  
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
