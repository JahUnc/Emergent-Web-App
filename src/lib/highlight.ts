/**
 * A small C# syntax highlighter for the code drawers. It colors keywords, types, strings, numbers and
 * comments, which is all the explainer needs, in a few hundred bytes instead of a full highlighting library.
 * Results are cached per line because the same lines are shown again whenever a case is re-selected.
 */

const KEYWORDS = new Set(
  ('public private internal protected static readonly sealed class void bool int float double long return if else ' +
    'for foreach in new null true false out var continue break yield using namespace this get set throw while ' +
    'string object is as ref default switch case').split(' '),
);

const cache = new Map<string, string>();

/**
 * Escapes text for safe use as HTML.
 * @param text Raw text.
 * @returns The escaped text.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Highlights one line of C#.
 * @param line The source line.
 * @returns HTML with span classes tk-k (keyword), tk-t (type), tk-s (string), tk-n (number) and tk-c (comment).
 */
export function highlightLine(line: string): string {
  const cached = cache.get(line);
  if (cached !== undefined) return cached;

  const commentAt = line.indexOf('//');
  const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
  const comment = commentAt >= 0 ? line.slice(commentAt) : '';
  const body = escapeHtml(code).replace(
    /("[^"]*")|\b(\d+(?:\.\d+)?f?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b/g,
    (_match, str: string | undefined, num: string | undefined, word: string | undefined) => {
      if (str) return `<span class="tk-s">${str}</span>`;
      if (num) return `<span class="tk-n">${num}</span>`;
      if (word && KEYWORDS.has(word)) return `<span class="tk-k">${word}</span>`;
      if (word && /^[A-Z]/.test(word)) return `<span class="tk-t">${word}</span>`;
      return word ?? '';
    },
  );
  const html = body + (comment ? `<span class="tk-c">${escapeHtml(comment)}</span>` : '');
  cache.set(line, html);
  return html;
}
