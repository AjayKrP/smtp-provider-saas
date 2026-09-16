import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import javascript from 'highlight.js/lib/languages/javascript';
import properties from 'highlight.js/lib/languages/properties';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import typescript from 'highlight.js/lib/languages/typescript';
import { CopyButton } from './bits.js';

/**
 * Only the languages our docs actually use are registered — the full highlight.js
 * bundle is an order of magnitude larger, and a marketing site should not pay for
 * grammars nobody reads.
 */
const LANGUAGES = { bash, csharp, go, ini, javascript, properties, python, ruby, typescript };

export type CodeLang = keyof typeof LANGUAGES | 'plaintext';

let registered = false;
function register(): void {
  if (registered) return;
  for (const [name, definition] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, definition);
  registered = true;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Highlight to an HTML string. Runs identically in Node and the browser, so the
 * prerendered pages ship already-highlighted markup and there is no flash of plain text.
 *
 * The output is safe to inject: highlight.js escapes the source it wraps, and plain text
 * is escaped here. Snippets are our own content, never anything a visitor supplies.
 */
export function highlight(code: string, lang: CodeLang): string {
  if (lang === 'plaintext') return escapeHtml(code);
  register();
  return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
}

export function CodeBlock({
  label,
  lang = 'plaintext',
  children,
}: {
  label: string;
  lang?: CodeLang;
  children: string;
}) {
  return (
    <div className="code">
      <div className="code-head">
        <span>{label}</span>
        <CopyButton value={children} label={`Copy ${label}`} />
      </div>
      <pre>
        <code
          className={`hljs language-${lang}`}
          dangerouslySetInnerHTML={{ __html: highlight(children, lang) }}
        />
      </pre>
    </div>
  );
}
