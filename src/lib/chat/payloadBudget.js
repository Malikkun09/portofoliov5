import { attachmentsToApiParts } from '@src/lib/chat/attachments';

/** Stay well under Vercel serverless ~4.5MB body limit. */
export const PAYLOAD_SOFT_LIMIT_BYTES = 3.5 * 1024 * 1024;
export const PAYLOAD_HARD_LIMIT_BYTES = 4 * 1024 * 1024;
export const MAX_CONTEXT_MESSAGES = 48;
export const MAX_ASSISTANT_CHARS = 24_000;
export const MAX_DOCUMENT_PREVIEW_CHARS = 4_000;

export const MEDIA_STUBS = {
  image: '[Gambar dilampirkan / Image attached]',
  video: '[Video dilampirkan / Video attached]',
  audio: '[Audio dilampirkan / Audio attached]',
};

function isSendableAssistant(message) {
  return Boolean(String(message.content || '').trim() || String(message.reasoning || '').trim());
}

export function filterSendableMessages(messages) {
  return (messages || []).filter((message) => {
    if (message.role === 'user') return true;
    if (message.role !== 'assistant') return false;
    return isSendableAssistant(message);
  });
}

function truncateText(text, maxChars) {
  const value = String(text || '');
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[… dipersingkat / truncated]`;
}

export function userMessageToApiParts(message, { includeMedia = false } = {}) {
  if (includeMedia) {
    return attachmentsToApiParts(message.attachments || [], message.text);
  }

  const parts = [];

  if (message.text?.trim()) {
    parts.push({ type: 'text', text: message.text.trim() });
  }

  (message.attachments || []).forEach((attachment) => {
    if (attachment.kind === 'error') return;

    if (attachment.kind === 'image') {
      parts.push({ type: 'text', text: MEDIA_STUBS.image });
      return;
    }

    if (attachment.kind === 'video') {
      parts.push({ type: 'text', text: MEDIA_STUBS.video });
      return;
    }

    if (attachment.kind === 'audio') {
      parts.push({ type: 'text', text: MEDIA_STUBS.audio });
      return;
    }

    if (attachment.kind === 'document') {
      const preview = truncateText(attachment.textPreview || '(empty file)', MAX_DOCUMENT_PREVIEW_CHARS);
      parts.push({
        type: 'text',
        text: `Document "${attachment.name}":\n${preview}`,
      });
    }
  });

  if (parts.length === 0) {
    parts.push({ type: 'text', text: ' ' });
  }

  return parts;
}

export function uiMessageToApiMessage(message, { includeMedia = false } = {}) {
  if (message.role === 'user') {
    return {
      role: 'user',
      content: userMessageToApiParts(message, { includeMedia }),
    };
  }

  return {
    role: 'assistant',
    content: truncateText(message.content || '', MAX_ASSISTANT_CHARS),
  };
}

export function estimatePayloadBytes(payload) {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function findLastUserIndex(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return index;
  }
  return -1;
}

function buildPayloadFromUiMessages(uiMessages, lastUserIndex) {
  return uiMessages.map((message, index) =>
    uiMessageToApiMessage(message, {
      includeMedia: message.role === 'user' && index === lastUserIndex,
    }),
  );
}

function summarizeDroppedTurn(message) {
  const text = String(message.text || '').trim();
  const attachmentCount = (message.attachments || []).filter((item) => item.kind !== 'error').length;
  const attachmentNote = attachmentCount > 0 ? ` (+${attachmentCount} media)` : '';
  const snippet = text ? truncateText(text, 160) : '(no text)';
  return `[Earlier message omitted / Pesan sebelumnya dihilangkan: ${snippet}${attachmentNote}]`;
}

/**
 * Build a provider-safe API payload from UI session messages.
 * UI keeps full media for display; API sends media only for the current user turn.
 */
export function buildApiPayload(uiMessages, { enableThinking = true } = {}) {
  const filtered = filterSendableMessages(uiMessages);
  if (filtered.length === 0) {
    return {
      messages: [],
      estimatedBytes: 0,
      trimmed: false,
      droppedMessages: 0,
      error: 'messages must be a non-empty array',
    };
  }

  let working = filtered.slice(-MAX_CONTEXT_MESSAGES);
  let droppedMessages = filtered.length - working.length;
  const lastUserIndex = findLastUserIndex(working);

  let messages = buildPayloadFromUiMessages(working, lastUserIndex);
  let estimatedBytes = estimatePayloadBytes({ messages, enableThinking });
  let trimmed = droppedMessages > 0;

  const shrink = () => {
    if (working.length <= 1) return false;

    const removed = working.shift();
    droppedMessages += 1;
    trimmed = true;

    if (removed?.role === 'user') {
      working.unshift({
        role: 'user',
        text: summarizeDroppedTurn(removed),
        attachments: [],
      });
    }

    const nextLastUserIndex = findLastUserIndex(working);
    messages = buildPayloadFromUiMessages(working, nextLastUserIndex);
    estimatedBytes = estimatePayloadBytes({ messages, enableThinking });
    return true;
  };

  while (estimatedBytes > PAYLOAD_SOFT_LIMIT_BYTES && working.length > 1) {
    if (!shrink()) break;
  }

  if (estimatedBytes > PAYLOAD_HARD_LIMIT_BYTES) {
    return {
      messages,
      estimatedBytes,
      trimmed: true,
      droppedMessages,
      error: 'PAYLOAD_TOO_LARGE',
    };
  }

  return {
    messages,
    estimatedBytes,
    trimmed,
    droppedMessages,
    error: null,
  };
}

/** @deprecated Use buildApiPayload for trimmed payloads. Kept for tests that need raw conversion. */
export function toApiMessagesRaw(messages) {
  return filterSendableMessages(messages).map((message) =>
    uiMessageToApiMessage(message, {
      includeMedia: true,
    }),
  );
}
