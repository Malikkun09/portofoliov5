import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { isSafeMarkdownUrl, normalizeMarkdownSource } from '@src/lib/chat/markdown';
import styles from '@src/pages/projects/chatbot/chatbot.module.scss';

function createMarkdownComponents(variant = 'answer') {
  const headingClass = variant === 'thinking' ? styles.mdHeadingThinking : styles.mdHeading;

  return {
    h1: ({ children }) => <h3 className={headingClass}>{children}</h3>,
    h2: ({ children }) => <h3 className={headingClass}>{children}</h3>,
    h3: ({ children }) => <h4 className={styles.mdSubheading}>{children}</h4>,
    h4: ({ children }) => <h4 className={styles.mdSubheading}>{children}</h4>,
    h5: ({ children }) => <h5 className={styles.mdSubheading}>{children}</h5>,
    h6: ({ children }) => <h6 className={styles.mdSubheading}>{children}</h6>,
    p: ({ children }) => <p className={styles.mdParagraph}>{children}</p>,
    ul: ({ children }) => <ul className={styles.mdList}>{children}</ul>,
    ol: ({ children }) => <ol className={styles.mdOrderedList}>{children}</ol>,
    li: ({ children }) => <li className={styles.mdListItem}>{children}</li>,
    blockquote: ({ children }) => <blockquote className={styles.mdBlockquote}>{children}</blockquote>,
    hr: () => <hr className={styles.mdHr} />,
    strong: ({ children }) => <strong className={styles.mdStrong}>{children}</strong>,
    em: ({ children }) => <em className={styles.mdEm}>{children}</em>,
    del: ({ children }) => <del className={styles.mdDel}>{children}</del>,
    code: ({ inline, className, children, ...props }) => {
      if (inline) {
        return (
          <code className={styles.mdInlineCode} {...props}>
            {children}
          </code>
        );
      }

      return (
        <pre className={styles.mdPre}>
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    a: ({ href, children, ...props }) => {
      if (!isSafeMarkdownUrl(href)) {
        return <span className={styles.mdUnsafeLink}>{children}</span>;
      }

      return (
        <a href={href} className={styles.mdLink} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className={styles.mdTableWrap}>
        <table className={styles.mdTable}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className={styles.mdTableHead}>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className={styles.mdTableRow}>{children}</tr>,
    th: ({ children }) => <th className={styles.mdTableCell}>{children}</th>,
    td: ({ children }) => <td className={styles.mdTableCell}>{children}</td>,
    input: ({ checked, disabled, type }) => {
      if (type !== 'checkbox') return null;
      return <input type="checkbox" checked={checked} disabled={disabled} readOnly className={styles.mdTaskCheckbox} />;
    },
  };
}

const ANSWER_COMPONENTS = createMarkdownComponents('answer');
const THINKING_COMPONENTS = createMarkdownComponents('thinking');

export default function ChatMarkdown({ source, variant = 'answer' }) {
  const markdown = normalizeMarkdownSource(source);
  if (!markdown.trim()) return null;

  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={variant === 'thinking' ? THINKING_COMPONENTS : ANSWER_COMPONENTS}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
