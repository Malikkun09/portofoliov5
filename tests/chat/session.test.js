import { describe, expect, it } from 'vitest';

import { buildApiPayload } from '@src/lib/chat/payloadBudget';
import { toApiMessages } from '../../src/lib/chat/session';
import { sanitizeAssistantMessage } from '../../src/lib/chat/thinking';

describe('toApiMessages', () => {
  it('sends conversation history while skipping empty assistant placeholders', () => {
    const apiMessages = toApiMessages([
      { role: 'user', text: 'Halo' },
      { role: 'assistant', content: 'Hai, ada yang bisa dibantu?' },
      { role: 'user', text: 'Foto apa ini?', attachments: [] },
      { role: 'assistant', content: '', isStreaming: true },
    ]);

    expect(apiMessages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Halo' }] },
      { role: 'assistant', content: 'Hai, ada yang bisa dibantu?' },
      { role: 'user', content: [{ type: 'text', text: 'Foto apa ini?' }] },
    ]);
  });

  it('keeps assistant history after leaked thinking tags are stripped', () => {
    const cleaned = sanitizeAssistantMessage({
      role: 'assistant',
      content: '{thinking}Ini foto Zoom.',
      reasoning: '',
    });

    expect(toApiMessages([{ role: 'user', text: 'Foto?' }, cleaned])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Foto?' }] },
      { role: 'assistant', content: 'Ini foto Zoom.' },
    ]);
  });

  it('does not re-send old image blobs on later turns', () => {
    const image = 'data:image/jpeg;base64,abc';
    const payload = buildApiPayload([
      {
        role: 'user',
        text: 'First',
        attachments: [{ kind: 'image', dataUrl: image, name: 'a.jpg' }],
      },
      { role: 'assistant', content: 'Seen it.' },
      {
        role: 'user',
        text: 'Again',
        attachments: [{ kind: 'image', dataUrl: image, name: 'b.jpg' }],
      },
    ]);

    expect(payload.messages[0].content.some((part) => part.type === 'image_url')).toBe(false);
    expect(payload.messages[2].content.some((part) => part.type === 'image_url')).toBe(true);
  });
});
