const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4']);
const AUDIO_TYPES = new Set(['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/flac', 'audio/x-flac']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function createAttachmentId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function processSelectedFiles(files) {
  const attachments = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      attachments.push({
        id: createAttachmentId(),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        kind: 'error',
        error: `File exceeds ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB limit`,
      });
      continue;
    }

    const id = createAttachmentId();
    const mimeType = file.type || 'application/octet-stream';
    const objectUrl = typeof URL !== 'undefined' ? URL.createObjectURL(file) : null;

    if (IMAGE_TYPES.has(mimeType)) {
      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({
        id,
        name: file.name,
        mimeType,
        kind: 'image',
        objectUrl,
        dataUrl,
        file,
      });
      continue;
    }

    if (VIDEO_TYPES.has(mimeType)) {
      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({
        id,
        name: file.name,
        mimeType,
        kind: 'video',
        objectUrl,
        dataUrl,
        file,
      });
      continue;
    }

    if (AUDIO_TYPES.has(mimeType)) {
      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({
        id,
        name: file.name,
        mimeType,
        kind: 'audio',
        objectUrl,
        dataUrl,
        file,
      });
      continue;
    }

    if (TEXT_TYPES.has(mimeType) || file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
      const textPreview = await readFileAsText(file);
      attachments.push({
        id,
        name: file.name,
        mimeType,
        kind: 'document',
        objectUrl,
        textPreview: textPreview.slice(0, 12000),
        file,
      });
      continue;
    }

    attachments.push({
      id,
      name: file.name,
      mimeType,
      kind: 'document',
      objectUrl,
      textPreview: `[Attached file: ${file.name} (${mimeType}, ${Math.round(file.size / 1024)} KB). Content type is not directly supported by the vision model — describe what you need from this file in your message.]`,
      file,
    });
  }

  return attachments;
}

export function attachmentsToApiParts(attachments, userText) {
  const parts = [];

  if (userText?.trim()) {
    parts.push({ type: 'text', text: userText.trim() });
  }

  attachments.forEach((attachment) => {
    if (attachment.kind === 'error') return;

    if (attachment.kind === 'image' && attachment.dataUrl) {
      parts.push({
        type: 'image_url',
        image_url: { url: attachment.dataUrl },
      });
      return;
    }

    if (attachment.kind === 'video' && attachment.dataUrl) {
      parts.push({
        type: 'video_url',
        video_url: { url: attachment.dataUrl },
      });
      return;
    }

    if (attachment.kind === 'audio' && attachment.dataUrl) {
      parts.push({
        type: 'audio_url',
        audio_url: { url: attachment.dataUrl },
      });
      return;
    }

    if (attachment.kind === 'document') {
      parts.push({
        type: 'text',
        text: `Document "${attachment.name}":\n${attachment.textPreview || '(empty file)'}`,
      });
    }
  });

  if (parts.length === 0) {
    parts.push({ type: 'text', text: ' ' });
  }

  return parts;
}

export function serializeAttachmentsForStorage(attachments) {
  return attachments.map((attachment) => ({
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    dataUrl: attachment.dataUrl || null,
    textPreview: attachment.textPreview || null,
    expiresAt: attachment.expiresAt || null,
    error: attachment.error || null,
  }));
}

export function deserializeAttachmentsFromStorage(storedAttachments) {
  if (!Array.isArray(storedAttachments)) return [];

  return storedAttachments.map((attachment) => ({
    ...attachment,
    objectUrl: attachment.dataUrl && attachment.kind === 'image' ? attachment.dataUrl : null,
  }));
}
