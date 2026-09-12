import { sanitizeAssistantMessage } from '@src/lib/chat/thinking';

const SESSION_KEY = 'chatbot-session-v1';

const defaultSession = () => ({
  messages: [],
  showThinking: true,
  updatedAt: Date.now(),
});

export function loadSession() {
  if (typeof window === 'undefined') return defaultSession();

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return defaultSession();
    const parsed = JSON.parse(raw);
    return {
      ...defaultSession(),
      ...parsed,
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.map((message) => (message?.role === 'assistant' ? sanitizeAssistantMessage(message) : message))
        : [],
    };
  } catch {
    return defaultSession();
  }
}

export function saveSession(session) {
  if (typeof window === 'undefined') return;

  window.sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      ...session,
      updatedAt: Date.now(),
    }),
  );
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function toApiMessages(messages) {
  return messages
    .filter((message) => {
      if (message.role === 'user') return true;
      if (message.role !== 'assistant') return false;
      return Boolean(String(message.content || '').trim() || String(message.reasoning || '').trim());
    })
    .map((message) => {
      if (message.role === 'user') {
        const parts = [];

        if (message.text?.trim()) {
          parts.push({ type: 'text', text: message.text.trim() });
        }

        (message.attachments || []).forEach((attachment) => {
          if (attachment.kind === 'image' && attachment.dataUrl) {
            parts.push({ type: 'image_url', image_url: { url: attachment.dataUrl } });
            return;
          }
          if (attachment.kind === 'video' && attachment.dataUrl) {
            parts.push({ type: 'video_url', video_url: { url: attachment.dataUrl } });
            return;
          }
          if (attachment.kind === 'audio' && attachment.dataUrl) {
            parts.push({ type: 'audio_url', audio_url: { url: attachment.dataUrl } });
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

        return { role: 'user', content: parts };
      }

      return {
        role: 'assistant',
        content: message.content || '',
      };
    });
}
