import { runChatCompletions } from '@src/lib/chat/runCompletions';

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, enableThinking = true } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    await runChatCompletions({
      messages,
      enableThinking,
      onEvent: (event) => writeSseEvent(res, event),
    });
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    writeSseEvent(res, {
      type: 'error',
      message: isAbort ? 'Waktu habis. Coba lagi. / Request timed out.' : 'Terjadi kesalahan server. / Unexpected server error while streaming.',
    });
  }

  return res.end();
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
    responseLimit: false,
  },
};
