import { buildApiPayload } from '@src/lib/chat/payloadBudget';
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

export function toApiMessages(messages, options = {}) {
  return buildApiPayload(messages, options).messages;
}
