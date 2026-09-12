import { describe, expect, it } from 'vitest';

import { createThinkingSplitter, hasThinkingMarkup, parseThinkingAndAnswer, sanitizeAssistantMessage } from '../../src/lib/chat/thinking';

describe('parseThinkingAndAnswer', () => {
  it('splits XML think blocks from the visible answer', () => {
    expect(parseThinkingAndAnswer('<think>plan the photo</think>\nThe image is a Zoom call.')).toEqual({
      reasoning: 'plan the photo',
      content: 'The image is a Zoom call.',
    });
  });

  it('strips leaked {thinking} markers from the answer without swallowing it', () => {
    const leaked = '{thinking}The image shows a close-up of a white piece of furniture.';
    expect(parseThinkingAndAnswer(leaked)).toEqual({
      reasoning: '',
      content: 'The image shows a close-up of a white piece of furniture.',
    });
  });

  it('strips {{thinking}} and leftover closing tags', () => {
    expect(parseThinkingAndAnswer('{{thinking}}Hello</think> world').content).toBe('Hello world');
  });

  it('treats an unclosed <think> prefix as reasoning during streaming', () => {
    expect(parseThinkingAndAnswer('<think>still reasoning')).toEqual({
      reasoning: 'still reasoning',
      content: '',
    });
  });

  it('hides incomplete trailing tag fragments', () => {
    expect(parseThinkingAndAnswer('Hello <thi').content).toBe('Hello ');
  });

  it('moves complete {thinking} blocks into reasoning', () => {
    expect(parseThinkingAndAnswer('{thinking}rencana{/thinking}\nIni foto Zoom.')).toEqual({
      reasoning: 'rencana',
      content: 'Ini foto Zoom.',
    });
  });

  it('never leaves thinking markup in the visible answer', () => {
    const samples = [
      '{thinking}The image shows a close-up of a white piece of furniture.',
      '<think>plan</think>Visible answer',
      '{{thinking}}Hello</think> world',
      '{thinking}secret{/thinking}Jawaban',
    ];

    samples.forEach((sample) => {
      const parsed = parseThinkingAndAnswer(sample);
      expect(hasThinkingMarkup(parsed.content)).toBe(false);
      expect(parsed.content).not.toMatch(/[{<[]\s*\/?\s*thinking/i);
      expect(parsed.content).not.toMatch(/<\s*\/?\s*think/i);
    });
  });
});

describe('sanitizeAssistantMessage', () => {
  it('moves tagged thinking into reasoning and keeps existing traces', () => {
    const sanitized = sanitizeAssistantMessage({
      role: 'assistant',
      reasoning: 'api trace\n',
      content: '<think>xml trace</think>Visible answer',
    });

    expect(sanitized.content).toBe('Visible answer');
    expect(sanitized.reasoning).toContain('api trace');
    expect(sanitized.reasoning).toContain('xml trace');
  });
});

describe('createThinkingSplitter', () => {
  it('emits cleaned content across streamed chunks', () => {
    const splitter = createThinkingSplitter();
    const events = [
      ...splitter.ingest({ content: '{thinking}' }),
      ...splitter.ingest({ content: 'Foto dari zoom.' }),
    ];

    const content = events
      .filter((event) => event.type === 'content')
      .map((event) => event.text)
      .join('');

    expect(content).toBe('Foto dari zoom.');
    expect(content).not.toContain('{thinking}');
  });

  it('reclassifies think-block tokens so the answer is only the visible text', () => {
    const splitter = createThinkingSplitter();
    const events = [...splitter.ingest({ content: '<think>abc' }), ...splitter.ingest({ content: '</think>Done' })];

    let content = '';
    let reasoning = '';
    events.forEach((event) => {
      if (event.type === 'content') {
        content = event.replace ? event.text || '' : `${content}${event.text || ''}`;
      }
      if (event.type === 'reasoning') {
        reasoning = event.replace ? event.text || '' : `${reasoning}${event.text || ''}`;
      }
    });

    expect(content).toBe('Done');
    expect(reasoning).toContain('abc');
    expect(content).not.toContain('abc');
    expect(hasThinkingMarkup(content)).toBe(false);
  });
});
