import { describe, expect, it } from 'vitest';

import {
  MEDIA_STUBS,
  buildApiPayload,
  estimatePayloadBytes,
  filterSendableMessages,
  userMessageToApiParts,
} from '@src/lib/chat/payloadBudget';

const tinyImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z';

describe('filterSendableMessages', () => {
  it('skips empty assistant placeholders', () => {
    const filtered = filterSendableMessages([
      { role: 'user', text: 'Hi' },
      { role: 'assistant', content: '', isStreaming: true },
      { role: 'assistant', content: 'Hello' },
    ]);

    expect(filtered).toHaveLength(2);
  });
});

describe('userMessageToApiParts', () => {
  it('includes media only when includeMedia is true', () => {
    const message = {
      text: 'Look at this',
      attachments: [{ kind: 'image', dataUrl: tinyImage, name: 'photo.jpg' }],
    };

    expect(userMessageToApiParts(message, { includeMedia: true })).toEqual([
      { type: 'text', text: 'Look at this' },
      { type: 'image_url', image_url: { url: tinyImage } },
    ]);

    expect(userMessageToApiParts(message, { includeMedia: false })).toEqual([
      { type: 'text', text: 'Look at this' },
      { type: 'text', text: MEDIA_STUBS.image },
    ]);
  });
});

describe('buildApiPayload', () => {
  it('keeps text history but strips media from older user turns', () => {
    const largeBlob = `data:image/jpeg;base64,${'A'.repeat(5000)}`;

    const payload = buildApiPayload([
      {
        role: 'user',
        text: 'First photo',
        attachments: [{ kind: 'image', dataUrl: largeBlob, name: 'one.jpg' }],
      },
      { role: 'assistant', content: 'That is a cat.' },
      {
        role: 'user',
        text: 'Second photo',
        attachments: [{ kind: 'image', dataUrl: largeBlob, name: 'two.jpg' }],
      },
    ]);

    expect(payload.error).toBeNull();
    expect(payload.messages).toHaveLength(3);
    expect(payload.messages[0].content).toEqual([
      { type: 'text', text: 'First photo' },
      { type: 'text', text: MEDIA_STUBS.image },
    ]);
    expect(payload.messages[2].content).toEqual([
      { type: 'text', text: 'Second photo' },
      { type: 'image_url', image_url: { url: largeBlob } },
    ]);
  });

  it('returns PAYLOAD_TOO_LARGE when the current turn alone exceeds the hard limit', () => {
    const hugeBlob = `data:image/jpeg;base64,${'B'.repeat(4.2 * 1024 * 1024)}`;

    const payload = buildApiPayload([
      {
        role: 'user',
        text: 'Huge image',
        attachments: [{ kind: 'image', dataUrl: hugeBlob, name: 'big.jpg' }],
      },
    ]);

    expect(payload.error).toBe('PAYLOAD_TOO_LARGE');
    expect(payload.estimatedBytes).toBeGreaterThan(4 * 1024 * 1024);
  });

  it('caps very long sessions by dropping oldest turns', () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      text: index % 2 === 0 ? `Question ${index}` : undefined,
      content: index % 2 === 1 ? `Answer ${index}` : undefined,
      attachments: [],
    }));

    const payload = buildApiPayload(messages);

    expect(payload.error).toBeNull();
    expect(payload.trimmed).toBe(true);
    expect(payload.droppedMessages).toBeGreaterThan(0);
    expect(payload.messages.length).toBeLessThanOrEqual(48);
  });
});

describe('estimatePayloadBytes', () => {
  it('measures serialized JSON size', () => {
    const bytes = estimatePayloadBytes({ messages: [{ role: 'user', content: 'hello' }], enableThinking: true });
    expect(bytes).toBeGreaterThan(20);
  });
});
