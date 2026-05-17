import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import React from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const URL_REGEX = /(https?:\/\/[^\s<]+|(?:www\.)[^\s<]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.(?:com|co\.uk|org|net|io|dev|app|xyz|me|info|biz|uk|us|ca|au|de|fr|in|ai)[^\s<]*)/gi;

/**
 * Converts URLs in text to clickable React anchor elements.
 * Returns an array of React nodes (strings and <a> elements).
 */
export function linkifyText(text: string): React.ReactNode[] {
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
