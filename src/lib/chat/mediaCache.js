const MEDIA_PURGE_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'chatbot-media-expiry';

let purgeTimerId = null;
const registry = new Map();

function readExpiryMap() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeExpiryMap(map) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function persistRegistry() {
  const expiryMap = {};
  registry.forEach((entry, id) => {
    expiryMap[id] = entry.expiresAt;
  });
  writeExpiryMap(expiryMap);
}

function revokeEntry(id) {
  const entry = registry.get(id);
  if (!entry) return;

  if (entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl);
  }

  registry.delete(id);
}

export function purgeExpiredMedia() {
  const now = Date.now();
  Array.from(registry.keys()).forEach((id) => {
    const entry = registry.get(id);
    if (entry && entry.expiresAt <= now) {
      revokeEntry(id);
    }
  });
  persistRegistry();
}

export function purgeAllMedia() {
  Array.from(registry.keys()).forEach((id) => revokeEntry(id));
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

function schedulePurge() {
  if (purgeTimerId) {
    clearTimeout(purgeTimerId);
  }

  purgeTimerId = setTimeout(() => {
    purgeExpiredMedia();
    if (registry.size > 0) {
      schedulePurge();
    }
  }, 60 * 1000);
}

export function registerMedia({ id, file, objectUrl, dataUrl }) {
  const expiresAt = Date.now() + MEDIA_PURGE_MS;
  registry.set(id, {
    file,
    objectUrl,
    dataUrl,
    expiresAt,
  });
  persistRegistry();
  purgeExpiredMedia();
  schedulePurge();

  return {
    id,
    expiresAt,
    purgeInMinutes: MEDIA_PURGE_MS / 60000,
  };
}

export function getMediaEntry(id) {
  purgeExpiredMedia();
  return registry.get(id) || null;
}

export function getMediaPurgeMinutes() {
  return MEDIA_PURGE_MS / 60000;
}

export function restoreMediaFromSession() {
  if (typeof window === 'undefined') return;

  const expiryMap = readExpiryMap();
  const now = Date.now();

  Object.entries(expiryMap).forEach(([id, expiresAt]) => {
    if (expiresAt <= now) {
      delete expiryMap[id];
    }
  });

  writeExpiryMap(expiryMap);
}

export function formatExpiryCountdown(expiresAt) {
  const remainingMs = Math.max(0, expiresAt - Date.now());
  const minutes = Math.ceil(remainingMs / 60000);
  return minutes;
}
