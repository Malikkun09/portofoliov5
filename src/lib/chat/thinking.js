const COMPLETE_BLOCK_PATTERNS = [
  /<\s*think(?:ing)?\s*>([\s\S]*?)<\/\s*think(?:ing)?\s*>/gi,
  /\{\{\s*thinking\s*\}\}([\s\S]*?)\{\{\s*\/\s*thinking\s*\}\}/gi,
  /\{\s*thinking\s*\}([\s\S]*?)\{\s*\/\s*thinking\s*\}/gi,
  /\[\s*thinking\s*\]([\s\S]*?)\[\s*\/\s*thinking\s*\]/gi,
];

export const THINKING_MARKUP_PATTERN =
  /<\s*\/?\s*think(?:ing)?\s*>|\{\{\s*\/?\s*thinking\s*\}\}|\{\s*\/?\s*thinking\s*\}|\[\s*\/?\s*thinking\s*\]/gi;

const UNCLOSED_XML_THINK = /^\s*<\s*think(?:ing)?\s*>([\s\S]*)$/i;

const INCOMPLETE_TRAILING_MARKER = /(?:<\s*\/?\s*t[a-z]*|\{+\s*\/?\s*t[a-z]*|\[\s*\/?\s*t[a-z]*)$/i;

function extractCompleteBlocks(text) {
  let reasoning = '';
  let remaining = text;

  COMPLETE_BLOCK_PATTERNS.forEach((pattern) => {
    remaining = remaining.replace(pattern, (_, inner) => {
      reasoning += inner;
      return '\n';
    });
  });

  return { reasoning, remaining };
}

function hideIncompleteTrailingMarker(text) {
  return text.replace(INCOMPLETE_TRAILING_MARKER, '');
}

export function parseThinkingAndAnswer(text) {
  const source = String(text || '');
  const extracted = extractCompleteBlocks(source);
  let reasoning = extracted.reasoning;
  let remaining = extracted.remaining;

  const unclosed = remaining.match(UNCLOSED_XML_THINK);
  if (unclosed) {
    reasoning += unclosed[1];
    remaining = '';
  }

  remaining = remaining.replace(THINKING_MARKUP_PATTERN, '');
  remaining = hideIncompleteTrailingMarker(remaining);

  return {
    reasoning,
    content: remaining.replace(/^\n+/, ''),
  };
}

export function hasThinkingMarkup(text) {
  THINKING_MARKUP_PATTERN.lastIndex = 0;
  return THINKING_MARKUP_PATTERN.test(String(text || ''));
}

export function sanitizeAssistantMessage(message = {}) {
  const parsed = parseThinkingAndAnswer(message.content || '');
  const reasoning = `${message.reasoning || ''}${parsed.reasoning}`;

  return {
    ...message,
    content: parsed.content,
    reasoning,
  };
}

export function createThinkingSplitter() {
  let rawContent = '';
  let apiReasoning = '';
  let lastContent = '';
  let lastReasoning = '';

  const snapshot = () => {
    const parsed = parseThinkingAndAnswer(rawContent);
    return {
      content: parsed.content,
      reasoning: `${apiReasoning}${parsed.reasoning}`,
    };
  };

  const diff = (field, nextValue, lastValue) => {
    if (nextValue === lastValue) return null;
    if (nextValue.startsWith(lastValue)) {
      return { type: field, text: nextValue.slice(lastValue.length) };
    }
    return { type: field, text: nextValue, replace: true };
  };

  return {
    ingest({ reasoning = '', content = '' } = {}) {
      if (reasoning) apiReasoning += reasoning;
      if (content) rawContent += content;
      if (!reasoning && !content) return [];

      const next = snapshot();
      const events = [];
      const reasoningEvent = diff('reasoning', next.reasoning, lastReasoning);
      const contentEvent = diff('content', next.content, lastContent);

      if (reasoningEvent && reasoningEvent.text) events.push(reasoningEvent);
      else if (reasoningEvent?.replace) events.push(reasoningEvent);

      if (contentEvent && (contentEvent.text || contentEvent.replace)) events.push(contentEvent);

      lastReasoning = next.reasoning;
      lastContent = next.content;
      return events;
    },
  };
}

export default parseThinkingAndAnswer;
