import { describe, expect, it } from 'vitest';

import { toApiMessages } from '../../src/lib/chat/session';

describe('toApiMessages', () => {
  it('sends the full conversation history, skipping empty assistant placeholders', () => {
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
});
