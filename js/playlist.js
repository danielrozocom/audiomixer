import { state, elements } from './state.js';
import { formatTime, showToast } from './utils.js';
import { deleteStoredAudio, saveAudioBlob, getAudioBlob } from './db.js';
import { playIndex, playNext } from './player.js';

// Setup Drag and Drop
export function setupDragItem(el, index, listType) {
  el.setAttribute('draggable', 'true');
  el.classList.add('drag-item');

  el.addEventListener('dragstart', (e) => {
    state.draggedItemIndex = index;
    state.draggedItemType = listType;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  });

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(item => {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
  });

  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (state.draggedItemType !== listType) return;

    const rect = el.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;

    if (e.clientY < midPoint) {
      el.classList.add('drag-over-top');
      el.classList.remove('drag-over-bottom');
    } else {
      el.classList.add('drag-over-bottom');
      el.classList.remove('drag-over-top');
    }
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  el.addEventListener('drop', (e) => {
    e.preventDefault();
    if (state.draggedItemType !== listType) return;

    const rect = el.getBoundingClientRect();
    const midPoint = rect.top + rect.height / 2;
    const isBelow = e.clientY >= midPoint;

    el.classList.remove('drag-over-top', 'drag-over-bottom');
    const fromIndex = state.draggedItemIndex;
    let toIndex = index;

    if (fromIndex === null) return;

    if (isBelow && fromIndex > index) {
      toIndex = index + 1;
    } else if (!isBelow && fromIndex < index) {
      toIndex = Math.max(0, index - 1);
    }

    if (fromIndex === toIndex) return;

    if (listType === 'queue' && state.draggedItemType === 'queue') {
      const [movedItem] = state.queue.splice(fromIndex, 1);
      state.queue.splice(toIndex, 0, movedItem);
      
      if (state.currentIndex === fromIndex) {
        state.currentIndex = toIndex;
      } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
        state.currentIndex--;
      } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
        state.currentIndex++;
      }
      renderAllLists();
      showToast(`Pista movida a la posición #${toIndex + 1}`, 'info');

    } else if (listType === 'music' && state.draggedItemType === 'music') {
      const [movedItem] = state.musicPool.splice(fromIndex, 1);
      state.musicPool.splice(toIndex, 0, movedItem);
      rebuildQueue();
      showToast("Canción reordenada en la lista de música", 'info');

    } else if (listType === 'jingles' && state.draggedItemType === 'jingles') {
      const [movedItem] = state.jinglesPool.splice(fromIndex, 1);
      state.jinglesPool.splice(toIndex, 0, movedItem);
      rebuildQueue();
      showToast("Anuncio reordenado en la lista de anuncios", 'info');
    }
  });
}

// Rebuild Interleaved Queue based on current ratio
export function rebuildQueue() {
  if (state.musicPool.length === 0 && state.jinglesPool.length === 0) {
    state.queue = [];
    state.currentIndex = -1;
    renderAllLists();
    return;
  }

  const ratio = state.rotationRatio;
  const newQueue = [];
  let mIdx = 0;
  let jIdx = 0;

  const musicList = [...state.musicPool];
  const jinglesList = [...state.jinglesPool];

  if (musicList.length === 0) {
    newQueue.push(...jinglesList);
  } else if (jinglesList.length === 0) {
    newQueue.push(...musicList);
  } else {
    while (mIdx < musicList.length) {
      for (let i = 0; i < ratio && mIdx < musicList.length; i++) {
        newQueue.push(musicList[mIdx]);
        mIdx++;
      }
      if (jinglesList.length > 0) {
        newQueue.push(jinglesList[jIdx % jinglesList.length]);
        jIdx++;
      }
    }
  }

  state.queue = newQueue;
  if (state.currentIndex >= state.queue.length) {
    state.currentIndex = 0;
  }
  renderAllLists();
  updateCycleProgress();
}

// Render All Lists
export function renderAllLists() {
  if (elements.musicFileCount) elements.musicFileCount.textContent = `${state.musicPool.length} archivos`;
  if (elements.jinglesFileCount) elements.jinglesFileCount.textContent = `${state.jinglesPool.length} archivos`;
  if (elements.totalMusicBadge) elements.totalMusicBadge.textContent = state.musicPool.length;
  if (elements.totalJinglesBadge) elements.totalJinglesBadge.textContent = state.jinglesPool.length;
  if (elements.totalQueueBadge) elements.totalQueueBadge.textContent = state.queue.length;

  // Render Queue
  elements.queueList.innerHTML = '';
  if (state.queue.length === 0) {
    elements.queueEmptyState.classList.remove('hidden');
  } else {
    elements.queueEmptyState.classList.add('hidden');
    state.queue.forEach((item, index) => {
      const isCurrent = index === state.currentIndex;
      const isJingle = item.type === 'jingle';
      const el = document.createElement('div');
      el.className = `flex items-center justify-between p-2.5 rounded-lg border text-xs transition ${
        isCurrent
          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500/50 text-indigo-950 dark:text-indigo-100 shadow-sm'
          : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-dark-border hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
      }`;
      
      el.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onclick="window.playIndex(${index})">
          <span class="text-zinc-400 hover:text-zinc-600 p-0.5 cursor-grab">
            <i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>
          </span>
          <span class="font-mono text-[11px] w-5 text-zinc-400 font-semibold">${index + 1}</span>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${
            isJingle
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
          }">${isJingle ? 'Anuncio' : 'Música'}</span>
          <div class="truncate flex-1">
            <p class="font-medium truncate ${isCurrent ? 'text-indigo-600 dark:text-indigo-200 font-bold' : 'text-zinc-800 dark:text-zinc-200'}">${item.title}</p>
            <span class="text-[10px] text-zinc-400 capitalize">${item.source} ${item.duration ? '• ' + formatTime(item.duration) : ''}</span>
          </div>
        </div>
        <div class="flex items-center gap-1.5 pl-2">
          ${isCurrent && state.isPlaying ? '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>' : ''}
          <button onclick="window.duplicateQueueItem(${index}, event)" title="Duplicar en la cola" class="text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 p-1">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="window.removeItemFromQueue(${index}, event)" title="Eliminar de la cola" class="text-zinc-400 hover:text-red-500 p-1">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
      setupDragItem(el, index, 'queue');
      elements.queueList.appendChild(el);
    });
  }

  // Render Music Pool
  elements.musicList.innerHTML = '';
  if (state.musicPool.length === 0) {
    elements.musicEmptyState.classList.remove('hidden');
  } else {
    elements.musicEmptyState.classList.add('hidden');
    state.musicPool.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-dark-border text-xs';
      el.innerHTML = `
        <div class="flex items-center gap-2 truncate flex-1">
          <i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-zinc-400"></i>
          <div class="truncate flex-1">
            <p class="font-medium text-zinc-800 dark:text-zinc-200 truncate">${item.title}</p>
            <span class="text-[10px] text-zinc-400 capitalize">${item.source} ${item.duration ? '• ' + formatTime(item.duration) : ''}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="window.duplicatePoolItem('music', ${index})" title="Repetir / Duplicar canción" class="text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 p-1">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="window.removePoolItem('music', ${index})" title="Eliminar canción" class="text-zinc-400 hover:text-red-500 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
      setupDragItem(el, index, 'music');
      elements.musicList.appendChild(el);
    });
  }

  // Render Ads Pool
  elements.jinglesList.innerHTML = '';
  if (state.jinglesPool.length === 0) {
    elements.jinglesEmptyState.classList.remove('hidden');
  } else {
    elements.jinglesEmptyState.classList.add('hidden');
    state.jinglesPool.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-dark-border text-xs';
      el.innerHTML = `
        <div class="flex items-center gap-2 truncate flex-1">
          <i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-zinc-400"></i>
          <div class="truncate flex-1">
            <p class="font-medium text-amber-700 dark:text-amber-200 truncate">${item.title}</p>
            <span class="text-[10px] text-zinc-400 capitalize">${item.source} ${item.duration ? '• ' + formatTime(item.duration) : ''}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="window.duplicatePoolItem('jingle', ${index})" title="Repetir / Duplicar anuncio en la rotación" class="text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 p-1">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="window.removePoolItem('jingle', ${index})" title="Eliminar anuncio" class="text-zinc-400 hover:text-red-500 p-1">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;
      setupDragItem(el, index, 'jingles');
      elements.jinglesList.appendChild(el);
    });
  }

  if (window.lucide) lucide.createIcons();
}

// Rotation / Cycle Indicator
export function updateCycleProgress() {
  if (state.queue.length === 0 || state.currentIndex === -1) {
    if (elements.cycleCounter) elements.cycleCounter.textContent = `0 / ${state.rotationRatio} pistas`;
    if (elements.cycleProgressBar) elements.cycleProgressBar.style.width = '0%';
    if (elements.nextScheduledTag) elements.nextScheduledTag.innerHTML = `<i data-lucide="arrow-right-circle" class="w-3.5 h-3.5 text-zinc-400"></i> Próximo tipo en turno: <span class="text-blue-500 font-medium">Música</span>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const nextTrack = state.queue[(state.currentIndex + 1) % state.queue.length];
  const isNextJingle = nextTrack && nextTrack.type === 'jingle';
  
  const stepInCycle = (state.currentIndex % (state.rotationRatio + 1)) + 1;
  const pct = Math.min(100, (stepInCycle / (state.rotationRatio + 1)) * 100);

  if (elements.cycleProgressBar) elements.cycleProgressBar.style.width = `${pct}%`;
  if (elements.cycleCounter) elements.cycleCounter.textContent = `Paso ${stepInCycle} de ${state.rotationRatio + 1}`;
  if (elements.nextScheduledTag) {
    elements.nextScheduledTag.innerHTML = `
      <i data-lucide="arrow-right-circle" class="w-3.5 h-3.5 text-zinc-400"></i> Siguiente en turno: 
      <span class="${isNextJingle ? 'text-amber-500 font-bold' : 'text-blue-500 font-bold'}">${isNextJingle ? 'Anuncio Publicitario' : 'Canción Musical'}</span>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

// Global window actions for inline onclick attributes
window.duplicateQueueItem = function(index, e) {
  if (e) e.stopPropagation();
  if (index < 0 || index >= state.queue.length) return;
  const original = state.queue[index];
  const duplicate = {
    ...original,
    id: original.source === 'local' ? 'loc_' + Math.random().toString(36).substr(2, 9) : 'yt_' + Math.random().toString(36).substr(2, 9),
    title: original.title
  };

  state.queue.splice(index + 1, 0, duplicate);
  if (state.currentIndex > index) state.currentIndex++;
  renderAllLists();
  updateCycleProgress();
  showToast(`Elemento duplicado en la cola (#${index + 2})`, 'success');
};

window.duplicatePoolItem = async function(type, index, e) {
  if (e) e.stopPropagation();
  const pool = type === 'music' ? state.musicPool : state.jinglesPool;
  if (index < 0 || index >= pool.length) return;

  const original = pool[index];
  const newId = (original.source === 'local' ? 'loc_' : 'yt_') + Math.random().toString(36).substr(2, 9);
  
  let newBlob = original.blob || null;
  let newUrl = original.url;

  if (original.source === 'local') {
    if (!newBlob && original.id) {
      const stored = await getAudioBlob(original.id);
      if (stored && stored.blob) newBlob = stored.blob;
    }
    if (newBlob) {
      newUrl = URL.createObjectURL(newBlob);
      await saveAudioBlob(newId, newBlob, { title: original.title, type: original.type, duration: original.duration });
    }
  }

  const duplicatedItem = {
    ...original,
    id: newId,
    url: newUrl,
    blob: newBlob,
  };

  pool.splice(index + 1, 0, duplicatedItem);
  rebuildQueue();
  showToast(`¡${type === 'jingle' ? 'Anuncio' : 'Canción'} duplicado con éxito! Se repetirá en la rotación.`, 'success');
};

window.removeItemFromQueue = function(index, e) {
  if (e) e.stopPropagation();
  if (index === state.currentIndex) {
    playNext(false);
  }
  state.queue.splice(index, 1);
  if (state.currentIndex > index) state.currentIndex--;
  renderAllLists();
  updateCycleProgress();
};

window.removePoolItem = async function(type, index) {
  if (type === 'music') {
    const [removed] = state.musicPool.splice(index, 1);
    if (removed && removed.id) await deleteStoredAudio(removed.id);
  } else {
    const [removed] = state.jinglesPool.splice(index, 1);
    if (removed && removed.id) await deleteStoredAudio(removed.id);
  }
  rebuildQueue();
};
