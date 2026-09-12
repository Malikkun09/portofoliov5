import { describe, expect, it } from 'vitest';

import { validateChatRequestBody } from '@src/lib/chat/payloadValidation';

describe('validateChatRequestBody', () => {
  it('rejects empty message arrays', () => {
    expect(validateChatRequestBody({ messages: [] })).toEqual({
      ok: false,
      status: 400,
      error: 'messages must be a non-empty array',
    });
  });

  it('accepts small payloads', () => {
    const result = validateChatRequestBody({
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      enableThinking: true,
    });

    expect(result.ok).toBe(true);
    expect(result.estimatedBytes).toBeGreaterThan(0);
  });

  it('rejects oversized payloads with 413', () => {
    const hugeBlob = `data:image/jpeg;base64,${'Z'.repeat(4.2 * 1024 * 1024)}`;
    const result = validateChatRequestBody({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Big image' },
            { type: 'image_url', image_url: { url: hugeBlob } },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(413);
    expect(result.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
