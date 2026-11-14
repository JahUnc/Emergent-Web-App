/**
 * @file Small helpers for reading C# source by structure rather than by line number.
 *
 * These are deliberately simple: they find methods by name and match braces, which works for the
 * project's code style (one declaration per line, braces on their own lines). They are not a C#
 * parser. Every caller that depends on a match checks the result and stops the build if it is
 * missing, so a style change can never silently produce wrong output.
 */

import { readFileSync } from 'node:fs';

/**
 * Reads a source file as lines, dropping a UTF-8 byte order mark and either line ending style.
 * @param {string} path Absolute path to the file.
 * @returns {string[]} The file's lines without line endings.
 */
export function readLines(path) {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
}

/**
 * Escapes text for use inside a regular expression.
 * @param {string} text The literal text.
 * @returns {string} The escaped text.
 */
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds a method by name and returns the 0-based line span of its declaration and body.
 * @param {string[]} lines The file's lines.
 * @param {string} name The method name.
 * @returns {{start: number, end: number}} The first and last line of the method, 0-based and inclusive.
 * @throws {Error} When the method cannot be found, so the build stops instead of showing the wrong code.
 */
export function methodSpan(lines, name) {
  const pattern = new RegExp(`^\\s*(public|private|internal|protected)[^=;]*\\b${escapeRegExp(name)}\\s*\\(`);
  for (let index = 0; index < lines.length; index++) {
    if (!pattern.test(lines[index])) continue;
    let depth = 0;
    let seenOpen = false;
    for (let end = index; end < lines.length; end++) {
      depth += count(lines[end], '{') - count(lines[end], '}');
      seenOpen ||= lines[end].includes('{');
      if (seenOpen && depth === 0) return { start: index, end };
    }
  }
  throw new Error(`Method ${name} not found`);
}

/**
 * Extends a 0-based start line upward over the XML doc comment directly above it.
 * @param {string[]} lines The file's lines.
 * @param {number} start The declaration line.
 * @returns {number} The first line of the doc comment, or start if there is none.
 */
export function includeDocComment(lines, start) {
  while (start > 0 && lines[start - 1].trim().startsWith('///')) start--;
  return start;
}

/**
 * Collects the plain text of the &lt;summary&gt; in the doc comment directly above a line.
 * Cross references become their member name and all other tags are removed.
 * @param {string[]} lines The file's lines.
 * @param {number} index The 0-based declaration line.
 * @returns {string} The summary as one line of plain text, or an empty string.
 */
export function summaryBefore(lines, index) {
  const start = includeDocComment(lines, index);
  const doc = lines.slice(start, index).map((l) => l.trim().slice(3).trim()).join(' ');
  const match = /<summary>(.*?)<\/summary>/.exec(doc);
  return (match ? match[1] : '')
    .replace(/<see cref="(?:[A-Za-z]+\.)*([A-Za-z]+)"\s*\/>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes a line comment and the contents of string literals, so prose never counts as code.
 * @param {string} line One line of C#.
 * @returns {string} The code part of the line.
 */
export function stripLine(line) {
  return line.replace(/"(?:\\.|[^"\\])*"/g, '""').split('//')[0];
}

/**
 * Counts how often a character appears in a string.
 * @param {string} text The text to search.
 * @param {string} ch The character.
 * @returns {number} The number of occurrences.
 */
function count(text, ch) {
  let n = 0;
  for (const c of text) if (c === ch) n++;
  return n;
}
