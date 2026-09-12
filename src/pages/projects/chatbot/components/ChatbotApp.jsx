/* eslint-disable react/no-array-index-key */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';
import Link from 'next/link';
import { deserializeAttachmentsFromStorage, processSelectedFiles, serializeAttachmentsForStorage } from '@src/lib/chat/attachments';
import { formatExpiryCountdown, getMediaPurgeMinutes, purgeAllMedia, registerMedia, restoreMediaFromSession } from '@src/lib/chat/mediaCache';
import { clearSession, loadSession, saveSession, toApiMessages } from '@src/lib/chat/session';
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

function createUserMessage(text, attachments) {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    text,
    attachments: serializeAttachmentsForStorage(attachments),
    createdAt: Date.now(),
  };
}

function ChatbotApp() {
  const setFluidColor = useStore((state) => state.setFluidColor);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [showThinking, setShowThinking] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState(null);
  const [mediaExpiryAt, setMediaExpiryAt] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const purgeMinutes = getMediaPurgeMinutes();

  useEffect(() => {
    restoreMediaFromSession();
    const session = loadSession();
    setMessages(session.messages || []);
    setShowThinking(session.showThinking ?? true);

    gsap.set('html', {
      '--black': '#141416',
      '--white': '#f0f4f1',
      '--accentColor': '#f0f4f1',
      '--fillColor': '#c6ff3d',
      '--menuColor': '#c6ff3d',
      '--menuFontColor': '#141416',
    });
    setFluidColor('#c6ff3d');

    return () => {
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isStreaming]);

  const expiryCountdown = useMemo(() => {
    if (!mediaExpiryAt) return purgeMinutes;
    return formatExpiryCountdown(mediaExpiryAt);
  }, [mediaExpiryAt, purgeMinutes]);

  const streamChat = useCallback(
    async ({ apiMessages, replaceLastAssistant = false }) => {
      setIsStreaming(true);
      setError('');
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

      try {
        const response = await fetch('/api/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: apiMessages,
            enableThinking: showThinking,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

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
                setProvider(event.provider);
              }

              if (event.type === 'fallback') {
                setError(event.message);
              }

              if (event.type === 'error') {
                setError(event.message);
              }

              if (event.type === 'reasoning' || event.type === 'content') {
                setMessages((prev) => {
                  const next = [...prev];
                  const lastIndex = next.length - 1;
                  const current = next[lastIndex];
                  if (!current || current.role !== 'assistant') return prev;

                  next[lastIndex] = {
                    ...current,
                    reasoning: event.type === 'reasoning' ? `${current.reasoning || ''}${event.text || ''}` : current.reasoning,
                    content: event.type === 'content' ? `${current.content || ''}${event.text || ''}` : current.content,
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
        setError(streamError.message || 'Streaming failed. Please try again.');
      } finally {
        setIsStreaming(false);
        setMessages((prev) => {
          const next = [...prev];
          const lastIndex = next.length - 1;
          if (next[lastIndex]?.role === 'assistant') {
            next[lastIndex] = {
              ...next[lastIndex],
              isStreaming: false,
            };
          }
          return next;
        });
      }
    },
    [showThinking],
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

    setMessages(nextMessages);
    setDraft('');
    setPendingAttachments([]);

    const apiMessages = toApiMessages(nextMessages);
    await streamChat({ apiMessages });
  };

  const handleRegenerate = async () => {
    if (isStreaming || messages.length < 2) return;

    const withoutLastAssistant = messages[messages.length - 1]?.role === 'assistant' ? messages.slice(0, -1) : messages;
    if (withoutLastAssistant.length === 0) return;

    setMessages(withoutLastAssistant);
    const apiMessages = toApiMessages(withoutLastAssistant);
    await streamChat({ apiMessages });
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
    setProvider(null);
    setMediaExpiryAt(null);
  };

  const lastAssistant = messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1] : null;

  return (
    <div className={clsx(styles.root, 'layout-block-inner')}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Portfolio Project</p>
          <h1 className={clsx(styles.title, 'h2')}>Multimodal Chatbot</h1>
          <p className={styles.subtitle}>
            Text, image, video, and document chat with session memory. No login required — conversation stays in this tab until you leave.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/projects" className={styles.backLink}>← All projects</Link>
          <button type="button" className={styles.ghostButton} onClick={handleClearSession} disabled={isStreaming}>
            Clear chat
          </button>
        </div>
      </header>

      <div className={styles.notice} role="note">
        <strong>Privacy:</strong> uploads (images, videos, files) are kept only in this browser session and auto-purged after{' '}
        <strong>{purgeMinutes} minutes</strong>
        {mediaExpiryAt ? ` (next purge in ~${expiryCountdown} min)` : ''} or when you close the tab.
      </div>

      <div className={styles.toolbar}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={showThinking} onChange={(event) => setShowThinking(event.target.checked)} />
          <span>Show model thinking</span>
        </label>
        {provider ? <span className={styles.providerBadge}>via {provider}</span> : null}
      </div>

      <section className={styles.chatPanel} aria-live="polite">
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Ask anything — attach a screenshot, MP4 clip, or text file.</p>
            <p className={styles.emptyHint}>Reasoning traces can be toggled. Regenerate if the answer misses the mark.</p>
          </div>
        ) : null}

        {messages.map((message, index) => {
          if (message.role === 'user') {
            const storedAttachments = deserializeAttachmentsFromStorage(message.attachments);
            return (
              <article key={message.id || index} className={clsx(styles.message, styles.userMessage)}>
                <p className={styles.messageRole}>You</p>
                {message.text ? <p className={styles.messageText}>{message.text}</p> : null}
                {storedAttachments.length > 0 ? (
                  <div className={styles.attachmentGrid}>
                    {storedAttachments.map((attachment) => (
                      <div key={attachment.id} className={styles.attachmentCard}>
                        {attachment.kind === 'image' && attachment.dataUrl ? (
                          <img src={attachment.dataUrl} alt={attachment.name} className={styles.attachmentPreview} />
                        ) : null}
                        {attachment.kind === 'video' && attachment.dataUrl ? (
                          <video src={attachment.dataUrl} controls className={styles.attachmentPreview} />
                        ) : null}
                        <span>{attachment.name}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          }

          return (
            <article key={message.id || index} className={clsx(styles.message, styles.assistantMessage)}>
              <div className={styles.assistantHeader}>
                <p className={styles.messageRole}>Assistant</p>
                {index === messages.length - 1 && !message.isStreaming ? (
                  <button type="button" className={styles.regenerateButton} onClick={handleRegenerate} disabled={isStreaming}>
                    ↻ Regenerate
                  </button>
                ) : null}
              </div>

              {showThinking && message.reasoning ? (
                <details className={styles.thinkingBlock} open={message.isStreaming}>
                  <summary>Thinking</summary>
                  <pre>{message.reasoning}</pre>
                </details>
              ) : null}

              <div className={styles.messageText}>{message.content || (message.isStreaming ? '…' : '')}</div>
            </article>
          );
        })}
        <div ref={messagesEndRef} />
      </section>

      {error ? <p className={styles.errorBanner}>{error}</p> : null}

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

      <footer className={styles.composer}>
        <button type="button" className={styles.attachButton} onClick={() => fileInputRef.current?.click()} disabled={isStreaming}>
          Attach
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/mp4,audio/*,.txt,.md,.json,.csv"
          className={styles.hiddenInput}
          onChange={handleFileSelect}
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
          placeholder="Type a message… (Shift+Enter for newline)"
          rows={2}
          disabled={isStreaming}
        />
        <button type="button" className={styles.sendButton} onClick={handleSend} disabled={isStreaming}>
          {isStreaming ? 'Streaming…' : 'Send'}
        </button>
      </footer>

      {lastAssistant && !lastAssistant.isStreaming ? (
        <div className={styles.regenerateFooter}>
          <button type="button" onClick={handleRegenerate} disabled={isStreaming}>
            Not satisfied? Regenerate last answer
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default ChatbotApp;
