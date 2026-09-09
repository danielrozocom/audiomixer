// State Management
export const state = {
  musicPool: [],      // Array of items: { id, title, type: 'music', source: 'local'|'youtube', url, ytId, duration }
  jinglesPool: [],    // Array of items: { id, title, type: 'jingle', source: 'local'|'youtube', url, ytId, duration }
  queue: [],          // Active combined queue
  currentIndex: -1,   // Current playing index in queue
  isPlaying: false,
  rotationRatio: 2,   // X music tracks per 1 jingle
  transitionMode: 'chime', // Fixed Radio broadcast chime
  customTransitionUrl: null, // Custom user transition jingle URL
  crossfadeDuration: 2.0, // Seconds of overlap crossfade
  isCrossfading: false,
  autoDj: true,
  volume: 1.0, // Full 100% Master Volume always
  isMuted: false,
  activeTab: 'queue',
  theme: 'system',      // Default theme is 'system'
  activeDeck: 'A',    // 'A' or 'B' for crossfading local audio
  draggedItemIndex: null,
  draggedItemType: null, // 'queue', 'music', or 'jingle'
};

// DOM Elements
export const elements = {
  html: document.documentElement,
  themeLightBtn: document.getElementById('themeLightBtn'),
  themeDarkBtn: document.getElementById('themeDarkBtn'),
  themeSystemBtn: document.getElementById('themeSystemBtn'),

  musicFileInput: document.getElementById('musicFileInput'),
  jinglesFileInput: document.getElementById('jinglesFileInput'),
  ytUrlInput: document.getElementById('ytUrlInput'),
  ytCategorySelect: document.getElementById('ytCategorySelect'),
  importYtBtn: document.getElementById('importYtBtn'),
  importYtBtnText: document.getElementById('importYtBtnText'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  
  rotationRatio: document.getElementById('rotationRatio'),
  rotationValueDisplay: document.getElementById('rotationValueDisplay'),
  transitionModeSelect: document.getElementById('transitionModeSelect'),
  transitionAudioWrapper: document.getElementById('transitionAudioWrapper'),
  transitionAudioLabel: document.getElementById('transitionAudioLabel'),
  transitionFileInput: document.getElementById('transitionFileInput'),
  previewChimeBtn: document.getElementById('previewChimeBtn'),
  crossfadeSliderWrapper: document.getElementById('crossfadeSliderWrapper'),
  crossfadeSlider: document.getElementById('crossfadeSlider'),
  crossfadeValueDisplay: document.getElementById('crossfadeValueDisplay'),
  ratioSummary: document.getElementById('ratioSummary'),
  cycleCounter: document.getElementById('cycleCounter'),
  cycleProgressBar: document.getElementById('cycleProgressBar'),
  nextScheduledTag: document.getElementById('nextScheduledTag'),
  
  musicFileCount: document.getElementById('musicFileCount'),
  jinglesFileCount: document.getElementById('jinglesFileCount'),
  totalQueueBadge: document.getElementById('totalQueueBadge'),
  totalMusicBadge: document.getElementById('totalMusicBadge'),
  totalJinglesBadge: document.getElementById('totalJinglesBadge'),
  
  playPauseBtn: document.getElementById('playPauseBtn'),
  playIcon: document.getElementById('playIcon'),
  pauseIcon: document.getElementById('pauseIcon'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  autoPlayToggle: document.getElementById('autoPlayToggle'),
  shuffleMusicBtn: document.getElementById('shuffleMusicBtn'),
  
  trackProgress: document.getElementById('trackProgress'),
  currentTime: document.getElementById('currentTime'),
  totalDuration: document.getElementById('totalDuration'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumePercent: document.getElementById('volumePercent'),
  muteBtn: document.getElementById('muteBtn'),
  volumeIcon: document.getElementById('volumeIcon'),
  
  currentTrackTitle: document.getElementById('currentTrackTitle'),
  currentTrackArtist: document.getElementById('currentTrackArtist'),
  playingBadge: document.getElementById('playingBadge'),
  sourceBadge: document.getElementById('sourceBadge'),
  playerGlow: document.getElementById('playerGlow'),
  engineStatus: document.getElementById('engineStatus'),
  enginePulseDot: document.getElementById('enginePulseDot'),
  visualizerBars: document.querySelectorAll('#visualizerContainer .bar'),
  
  tabQueue: document.getElementById('tabQueue'),
  tabMusic: document.getElementById('tabMusic'),
  tabJingles: document.getElementById('tabJingles'),
  viewQueue: document.getElementById('viewQueue'),
  viewMusic: document.getElementById('viewMusic'),
  viewJingles: document.getElementById('viewJingles'),
  queueList: document.getElementById('queueList'),
  musicList: document.getElementById('musicList'),
  jinglesList: document.getElementById('jinglesList'),
  queueEmptyState: document.getElementById('queueEmptyState'),
  musicEmptyState: document.getElementById('musicEmptyState'),
  jinglesEmptyState: document.getElementById('jinglesEmptyState'),
  
  deckA: document.getElementById('audioEngineA'),
  deckB: document.getElementById('audioEngineB'),
  youtubePlayerWrapper: document.getElementById('youtubePlayerWrapper'),
  toastContainer: document.getElementById('toastContainer'),
};
