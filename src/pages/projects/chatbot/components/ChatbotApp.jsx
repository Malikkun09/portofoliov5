/* eslint-disable react/no-array-index-key, no-await-in-loop, no-loop-func, no-constant-condition, jsx-a11y/media-has-caption, @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';
import { deserializeAttachmentsFromStorage, processSelectedFiles, serializeAttachmentsForStorage } from '@src/lib/chat/attachments';
import {
  formatChatHttpError,
  formatChatNetworkError,
  formatChatStreamDisconnectError,
  formatPayloadTooLargeError,
  readChatHttpErrorMessage,
} from '@src/lib/chat/clientErrors';
import { formatExpiryCountdown, getMediaPurgeMinutes, purgeAllMedia, registerMedia, restoreMediaFromSession } from '@src/lib/chat/mediaCache';
import { buildApiPayload } from '@src/lib/chat/payloadBudget';
import { clearSession, loadSession, saveSession } from '@src/lib/chat/session';
import { sanitizeAssistantMessage } from '@src/lib/chat/thinking';
import ChatMarkdown from '@src/pages/projects/chatbot/components/ChatMarkdown';
import styles from '@src/pages/projects/chatbot/chatbot.module.scss';
import { gsap } from 'gsap';
import { useStore } from '@src/store';

const EMPTY_ASSISTANT = {
  role: 'assistant',
  content: '',
  reasoning: '',
  provider: null,
  isStreaming: false,
};

const NEAR_BOTTOM_PX = 120;

const SUGGESTIONS = [
  {
    id: 'photo',
    label: 'Jelaskan foto',
    prompt: 'Jelaskan gambar yang saya lampirkan.',
    attach: true,
  },
  {
    id: 'file',
    label: 'Ringkas file',
    prompt: 'Ringkas isi file yang saya lampirkan.',
    attach: true,
  },
  {
    id: 'ask',
    label: 'Tanya apa saja',
    prompt: 'Halo — bantu aku pikirin ide proyek.',
    attach: false,
  },
];

function createUserMessage(text, attachments) {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    text,
    attachments: serializeAttachmentsForStorage(attachments),
    createdAt: Date.now(),
  };
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M20 12a8 8 0 1 1-2.2-5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 5v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatbotApp() {
  const setFluidColor = useStore((state) => state.setFluidColor);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [showThinking, setShowThinking] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState(null);
  const [mediaExpiryAt, setMediaExpiryAt] = useState(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const stageRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const purgeMinutes = getMediaPurgeMinutes();
  const canSend = Boolean(draft.trim() || pendingAttachments.some((attachment) => attachment.kind !== 'error')) && !isStreaming;

  const isNearBottom = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return true;
    return stage.scrollHeight - stage.scrollTop - stage.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const scrollTranscriptToBottom = useCallback((behavior = 'auto') => {
    const stage = stageRef.current;
    if (!stage || !shouldAutoScrollRef.current) return;

    if (behavior === 'smooth') {
      stage.scrollTo({ top: stage.scrollHeight, behavior: 'smooth' });
      return;
    }

    stage.scrollTop = stage.scrollHeight;
  }, []);

  useEffect(() => {
    restoreMediaFromSession();
    const session = loadSession();
    setMessages(session.messages || []);
    setShowThinking(session.showThinking ?? true);

    document.documentElement.dataset.chat = '1';

    gsap.set('html', {
      '--black': '#141416',
      '--white': '#f0f4f1',
      '--accentColor': '#f0f4f1',
      '--fillColor': '#c6ff3d',
      '--menuColor': '#ececec',
      '--menuFontColor': '#141416',
    });
    setFluidColor('#d7d7d4');

    return () => {
      delete document.documentElement.dataset.chat;
      purgeAllMedia();
      gsap.set('html', {
        '--black': '#28282b',
        '--white': '#f0f4f1',
        '--accentColor': '#f9f9f9',
        '--fillColor': '#f2ffbd',
        '--menuColor': '#28282b',
        '--menuFontColor': '#f0f4f1',
      });
      setFluidColor('#d7d7d4');
    };
  }, [setFluidColor]);

  useEffect(() => {
    saveSession({ messages, showThinking });
  }, [messages, showThinking]);

  useEffect(() => {
    const handleBeforeUnload = () => purgeAllMedia();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const handleScroll = () => {
      shouldAutoScrollRef.current = isNearBottom();
    };

    stage.addEventListener('scroll', handleScroll, { passive: true });
    return () => stage.removeEventListener('scroll', handleScroll);
  }, [isNearBottom]);

  useEffect(() => {
    scrollTranscriptToBottom(isStreaming ? 'auto' : 'smooth');
  }, [messages, isStreaming, scrollTranscriptToBottom]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const expiryCountdown = useMemo(() => {
    if (!mediaExpiryAt) return purgeMinutes;
    return formatExpiryCountdown(mediaExpiryAt);
  }, [mediaExpiryAt, purgeMinutes]);

  const finalizeAssistant = useCallback((hadError) => {
    setMessages((prev) => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];
      if (!last || last.role !== 'assistant') return prev;

      const empty = !String(last.content || '').trim() && !String(last.reasoning || '').trim();
      if (hadError && empty) {
        next.pop();
        return next;
      }

      next[lastIndex] = sanitizeAssistantMessage({
        ...last,
        isStreaming: false,
      });
      return next;
    });
  }, []);

  const streamChat = useCallback(
    async ({ apiMessages, replaceLastAssistant = false }) => {
      setIsStreaming(true);
      setError('');
      setStatus('');
      setProvider(null);

      setMessages((prev) => {
        const assistantMessage = {
          ...EMPTY_ASSISTANT,
          id: `assistant-${Date.now()}`,
          isStreaming: true,
        };

        if (replaceLastAssistant && prev[prev.length - 1]?.role === 'assistant') {
          const next = [...prev];
          next[next.length - 1] = assistantMessage;
          return next;
        }

        return [...prev, assistantMessage];
      });

      let sawError = false;
      let receivedStreamData = false;

      try {
        const response = await fetch('/api/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            enableThinking: showThinking,
          }),
        });

        if (!response.ok) {
          sawError = true;
          const serverMessage = await readChatHttpErrorMessage(response);
          setError(formatChatHttpError(response.status, serverMessage));
          return;
        }

        if (!response.body) {
          sawError = true;
          setError(formatChatHttpError(response.status, 'No response body'));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          receivedStreamData = true;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          chunks.forEach((chunk) => {
            const line = chunk
              .split('\n')
              .find((entry) => entry.startsWith('data:'))
              ?.slice(5)
              ?.trim();

            if (!line) return;

            try {
              const event = JSON.parse(line);

              if (event.type === 'meta') {
                receivedStreamData = true;
                setProvider(event.provider);
                setStatus('');
              }

              if (event.type === 'fallback') {
                receivedStreamData = true;
                setStatus(event.message);
              }

              if (event.type === 'error') {
                sawError = true;
                setError(formatChatHttpError(502, event.message));
                setStatus('');
              }

              if (event.type === 'reasoning' || event.type === 'content') {
                receivedStreamData = true;
                setMessages((prev) => {
                  const next = [...prev];
                  const lastIndex = next.length - 1;
                  const current = next[lastIndex];
                  if (!current || current.role !== 'assistant') return prev;

                  const field = event.type === 'reasoning' ? 'reasoning' : 'content';
                  const nextValue = event.replace ? event.text || '' : `${current[field] || ''}${event.text || ''}`;
                  const sanitized = sanitizeAssistantMessage({
                    ...current,
                    [field]: nextValue,
                  });

                  next[lastIndex] = {
                    ...sanitized,
                    isStreaming: true,
                  };
                  return next;
                });
              }
            } catch {
              // Ignore malformed events.
            }
          });
        }
      } catch (streamError) {
        sawError = true;
        setError((current) => {
          if (current) return current;
          if (receivedStreamData) return formatChatStreamDisconnectError();
          return formatChatNetworkError(streamError);
        });
      } finally {
        setIsStreaming(false);
        finalizeAssistant(sawError);
      }
    },
    [finalizeAssistant, showThinking],
  );

  const sendApiPayload = useCallback(
    async (uiMessages, options = {}) => {
      const payload = buildApiPayload(uiMessages, { enableThinking: showThinking });

      if (payload.error === 'PAYLOAD_TOO_LARGE') {
        setError(formatPayloadTooLargeError());
        return false;
      }

      if (payload.error || payload.messages.length === 0) {
        setError(formatChatHttpError(400, payload.error || 'Invalid request'));
        return false;
      }

      await streamChat({ apiMessages: payload.messages, ...options });
      return true;
    },
    [showThinking, streamChat],
  );

  const handleSend = async () => {
    if (isStreaming) return;

    const trimmed = draft.trim();
    const validAttachments = pendingAttachments.filter((attachment) => attachment.kind !== 'error');

    if (!trimmed && validAttachments.length === 0) return;

    const registeredAttachments = validAttachments.map((attachment) => {
      const registered = registerMedia({
        id: attachment.id,
        file: attachment.file,
        objectUrl: attachment.objectUrl,
        dataUrl: attachment.dataUrl,
      });
      setMediaExpiryAt(registered.expiresAt);
      return {
        ...attachment,
        expiresAt: registered.expiresAt,
      };
    });

    const userMessage = createUserMessage(trimmed, registeredAttachments);
    const nextMessages = [...messages, userMessage];

    shouldAutoScrollRef.current = true;
    setMessages(nextMessages);
    setDraft('');
    setPendingAttachments([]);

    await sendApiPayload(nextMessages);
  };

  const handleRegenerate = async () => {
    if (isStreaming || messages.length === 0) return;

    const withoutLastAssistant = messages[messages.length - 1]?.role === 'assistant' ? messages.slice(0, -1) : messages;
    if (withoutLastAssistant.length === 0) return;

    shouldAutoScrollRef.current = true;
    await sendApiPayload(withoutLastAssistant, { replaceLastAssistant: true });
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const processed = await processSelectedFiles(files);
    setPendingAttachments((prev) => [...prev, ...processed]);
    event.target.value = '';
  };

  const removePendingAttachment = (id) => {
    setPendingAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  };

  const handleClearSession = () => {
    if (isStreaming) return;
    purgeAllMedia();
    clearSession();
    setMessages([]);
    setDraft('');
    setPendingAttachments([]);
    setError('');
    setStatus('');
    setProvider(null);
    setMediaExpiryAt(null);
    textareaRef.current?.focus();
  };

  const handleSuggestion = (suggestion) => {
    setDraft(suggestion.prompt);
    textareaRef.current?.focus();
    if (suggestion.attach) {
      fileInputRef.current?.click();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className={styles.root}>
      <header className={styles.topBar}>
        <div className={styles.topIdentity}>
          <h1 className={styles.title}>Chat</h1>
          <p className={styles.modelHint}>{provider ? `via ${provider}` : 'NVIDIA / OpenRouter'}</p>
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setShowThinking((value) => !value)}
            aria-pressed={showThinking}
            title="Show or hide model thinking"
          >
            {showThinking ? 'Thinking on' : 'Thinking off'}
          </button>
          <button type="button" className={styles.roundButton} onClick={handleClearSession} disabled={isStreaming} aria-label="New chat">
            <RefreshIcon />
          </button>
        </div>
      </header>

      <div ref={stageRef} className={clsx(styles.stage, isEmpty && styles.stageEmpty)} aria-live="polite" data-lenis-prevent>
        {isEmpty ? (
          <div className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Ada yang bisa dibantu?</h2>
            <p className={styles.emptyHint}>Ask anything — text, images, video, or files. No login.</p>
          </div>
        ) : (
          <div className={styles.thread}>
            {messages.map((message, index) => {
              if (message.role === 'user') {
                const storedAttachments = deserializeAttachmentsFromStorage(message.attachments);
                return (
                  <div key={message.id || index} className={styles.rowUser}>
                    <article className={styles.userBubble}>
                      {message.text ? <p className={styles.messageText}>{message.text}</p> : null}
                      {storedAttachments.length > 0 ? (
                        <div className={styles.attachmentGrid}>
                          {storedAttachments.map((attachment) => (
                            <div key={attachment.id} className={styles.attachmentCard}>
                              {attachment.kind === 'image' && attachment.dataUrl ? <img src={attachment.dataUrl} alt={attachment.name} className={styles.attachmentPreview} /> : null}
                              {attachment.kind === 'video' && attachment.dataUrl ? <video src={attachment.dataUrl} controls className={styles.attachmentPreview} /> : null}
                              <span>{attachment.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  </div>
                );
              }

              const display = sanitizeAssistantMessage(message);
              const visibleContent = String(display.content || '');
              const reasoning = String(display.reasoning || '');
              const hasAnswer = Boolean(visibleContent.trim());

              return (
                <div key={message.id || index} className={styles.rowAssistant}>
                  <article className={styles.assistantBubble}>
                    {showThinking && reasoning ? (
                      <details className={styles.thinkingBlock}>
                        <summary>{message.isStreaming && !hasAnswer ? 'Thinking…' : 'Show model thinking'}</summary>
                        <ChatMarkdown source={reasoning} variant="thinking" />
                      </details>
                    ) : null}

                    <div className={styles.messageText}>
                      {hasAnswer ? <ChatMarkdown source={visibleContent} /> : message.isStreaming ? '…' : null}
                    </div>
                  </article>

                  {index === messages.length - 1 && !message.isStreaming && hasAnswer ? (
                    <button type="button" className={styles.regenerateButton} onClick={handleRegenerate} disabled={isStreaming}>
                      Regenerate
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.dock}>
        <div className={styles.dockInner}>
          {error ? (
            <p className={styles.errorBanner} role="alert">
              {error}
            </p>
          ) : null}
          {status && !error ? <p className={styles.statusNote}>{status}</p> : null}

          {isEmpty ? (
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion.id} type="button" className={styles.suggestion} onClick={() => handleSuggestion(suggestion)} disabled={isStreaming}>
                  {suggestion.label}
                </button>
              ))}
            </div>
          ) : null}

          {pendingAttachments.length > 0 ? (
            <div className={styles.pendingAttachments}>
              {pendingAttachments.map((attachment) => (
                <div key={attachment.id} className={styles.pendingChip}>
                  <span>{attachment.name}</span>
                  {attachment.error ? <em>{attachment.error}</em> : null}
                  <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => removePendingAttachment(attachment.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <button type="button" className={styles.plusButton} onClick={() => fileInputRef.current?.click()} disabled={isStreaming} aria-label="Attach file">
              <PlusIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/mp4,audio/*,.txt,.md,.json,.csv"
              className={styles.hiddenInput}
              onChange={handleFileSelect}
              aria-label="Attach image, video, or file"
            />
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Tanya apa saja..."
              rows={1}
              disabled={isStreaming}
              aria-label="Message"
            />
            <button type="submit" className={clsx(styles.sendButton, canSend && styles.sendReady)} disabled={!canSend} aria-label={isStreaming ? 'Streaming' : 'Send'}>
              {isStreaming ? <span className={styles.pulse} /> : <SendIcon />}
            </button>
          </form>

          <p className={styles.caption}>
            Media auto-hapus {purgeMinutes} menit
            {mediaExpiryAt ? ` · ~${expiryCountdown} min left` : ''} · session only
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatbotApp;
