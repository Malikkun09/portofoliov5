import { describe, expect, it } from 'vitest';

import { toApiMessages } from '../../src/lib/chat/session';
import { sanitizeAssistantMessage } from '../../src/lib/chat/thinking';

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
});
