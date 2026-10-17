import { describe, expect, it } from 'vitest';
import { splitCalloutMarkers } from './Markdown';

describe('splitCalloutMarkers', () => {
  it('separates the marker from the callout body', () => {
    expect(splitCalloutMarkers('> [!TIP]\n> Save often.')).toBe('> [!TIP]\n>\n> Save often.');
  });
  it('leaves ordinary quotes and already-separated markers alone', () => {
    expect(splitCalloutMarkers('> Just a quote')).toBe('> Just a quote');
    expect(splitCalloutMarkers('> [!NOTE]\n>\n> Body')).toBe('> [!NOTE]\n>\n> Body');
  });
});
