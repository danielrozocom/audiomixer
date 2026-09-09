import { elements } from './state.js';

// Format Seconds to MM:SS
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Convert Blob to Base64
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert Base64 back to Blob
export function base64ToBlob(base64Data, contentType = 'audio/mpeg') {
  try {
    const parts = base64Data.split(';base64,');
    const mime = parts[0].replace('data:', '') || contentType;
    const byteCharacters = atob(parts[1] || parts[0]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: mime });
  } catch (e) {
    console.error("Base64 to Blob conversion error", e);
    return null;
  }
}

// Extract Audio Duration from File / Blob
export function getAudioDuration(file) {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      audio.preload = 'metadata';
      const url = URL.createObjectURL(file);
      audio.src = url;
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration || null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 2000);
    } catch(e) {
      resolve(null);
    }
  });
}

// Toast Notifications
export function showToast(message, type = 'info') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast-enter pointer-events-auto bg-white dark:bg-zinc-900 border ${
    type === 'success' ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300' :
    type === 'warning' ? 'border-amber-500/40 text-amber-600 dark:text-amber-300' :
    type === 'error' ? 'border-red-500/40 text-red-600 dark:text-red-300' :
    'border-indigo-500/40 text-indigo-600 dark:text-indigo-300'
  } px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium`;

  const iconName = type === 'success' ? 'check-circle' :
                   type === 'warning' ? 'alert-triangle' :
                   type === 'error' ? 'alert-octagon' : 'info';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
    <span class="text-zinc-800 dark:text-zinc-200 flex-1">${message}</span>
  `;
  elements.toastContainer.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}
