// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function renderMarkdown(source) {
  const container = document.createElement('div');
  const root = createRoot(container);

  act(() => {
    root.render(<ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>);
  });

  return container.innerHTML;
}

describe('react-markdown GFM rendering', () => {
  it('renders headings, bold text, and tables', () => {
    const html = renderMarkdown(`## Section\n\n**Bold idea**\n\n| Ide | Deskripsi |\n| --- | --- |\n| One | Two |`);

    expect(html).toContain('<h2');
    expect(html).toContain('<strong>Bold idea</strong>');
    expect(html).toContain('<table>');
    expect(html).toContain('Deskripsi');
  });

  it('renders ordered and unordered lists', () => {
    const html = renderMarkdown('- first\n- second\n\n1. one\n2. two');

    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(html).toContain('first');
    expect(html).toContain('two');
  });
});
