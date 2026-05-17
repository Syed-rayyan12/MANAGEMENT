import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import React from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const URL_REGEX = /(https?:\/\/[^\s<]+|(?:www\.)[^\s<]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|co\.uk|org|net|io|dev|app|xyz|me|info|biz|uk|us|ca|au|de|fr|in|ai)[^\s<]*)/gi;

/**
 * Strip markdown-style links from text (e.g. from Trello imports).
 * [label](url "title") → label (url)
 * [email](mailto:email "title") → email
 */
function stripMarkdownLinks(text: string): string {
  // mailto links: [email](mailto:email "...") → just the email
  text = text.replace(/\[([^\]]*)\]\(mailto:[^\s)]*(?:\s+"[^"]*")?\)/g, '$1');
  // regular links: [label](url "...") → label (url)
  text = text.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g, '$1 ( $2 )');
  // any remaining markdown links without protocol: [label](url "...") → label
  text = text.replace(/\[([^\]]*)\]\([^\s)]+(?:\s+"[^"]*")?\)/g, '$1');
  return text;
}

/**
 * Converts URLs in text to clickable React anchor elements.
 * Strips markdown link syntax first, then linkifies plain URLs.
 * Returns an array of React nodes (strings and <a> elements).
 */
export function linkifyText(text: string): React.ReactNode[] {
  text = stripMarkdownLinks(text);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(URL_REGEX.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    let url = match[0];
    // Remove trailing punctuation that's likely not part of the URL
    url = url.replace(/[.,;:!?)]+$/, '');

    let href = url;
    if (!href.startsWith('http')) {
      href = 'https://' + href;
    }

    parts.push(
      React.createElement('a', {
        key: `link-${match.index}`,
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        className: 'text-accent hover:underline break-all',
        onClick: (e: React.MouseEvent) => e.stopPropagation(),
      }, url)
    );

    lastIndex = match.index + match[0].length;
    // Adjust for trailing punctuation removal
    const diff = match[0].length - url.length;
    if (diff > 0) {
      lastIndex -= diff;
    }
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
