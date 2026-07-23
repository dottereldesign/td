import { describe, expect, it } from 'vitest';
import { getIssueStatus, issueToBoardNote, parseEntry, serializeEntry } from '../src/board/model';
import type { GitHubComment, GitHubIssue, NoteMetadata } from '../src/board/types';

const noteMetadata: NoteMetadata = {
  kind: 'note',
  author: 'jamie',
  owner: 'both',
  priority: 'high',
  dueDate: '2026-08-01',
  project: 'Wizino TD',
};

function issue(body: string, labels = ['studio-board', 'board:progress']): GitHubIssue {
  return {
    number: 12,
    title: 'Ship the shared board',
    body,
    state: 'open',
    labels: labels.map((name) => ({ name })),
    created_at: '2026-07-20T01:00:00Z',
    updated_at: '2026-07-22T01:00:00Z',
    html_url: 'https://github.com/dottereldesign/td/issues/12',
  };
}

function comment(id: number, body: string, createdAt = '2026-07-22T02:00:00Z'): GitHubComment {
  return { id, body, created_at: createdAt, updated_at: createdAt };
}

describe('board metadata', () => {
  it('round-trips metadata without exposing it in the visible body', () => {
    const serialized = serializeEntry(noteMetadata, 'A useful shared note.');
    expect(parseEntry(serialized)).toEqual({ metadata: noteMetadata, body: 'A useful shared note.' });
  });

  it('falls back safely when a regular GitHub body has no board metadata', () => {
    expect(parseEntry('A normal issue body.')).toEqual({ metadata: null, body: 'A normal issue body.' });
  });

  it('gets a status from the board label and defaults to ideas', () => {
    expect(getIssueStatus(issue('', ['studio-board', 'board:complete']))).toBe('complete');
    expect(getIssueStatus(issue('', ['studio-board']))).toBe('ideas');
  });
});

describe('GitHub issue conversion', () => {
  it('separates visible comments from votes and keeps each user latest vote', () => {
    const comments = [
      comment(101, serializeEntry({ kind: 'comment', author: 'braxton' }, 'Looks good to me.')),
      comment(102, serializeEntry({ kind: 'vote', author: 'jamie', target: 'note', value: 'up' })),
      comment(103, serializeEntry({ kind: 'vote', author: 'braxton', target: 'note', value: 'down' })),
      comment(104, serializeEntry({ kind: 'vote', author: 'braxton', target: 'note', value: 'up' })),
      comment(105, serializeEntry({ kind: 'vote', author: 'jamie', target: 'comment:101', value: 'up' })),
    ];
    const converted = issueToBoardNote(issue(serializeEntry(noteMetadata, 'Shared context.')), comments, 'jamie');

    expect(converted?.comments).toHaveLength(1);
    expect(converted?.comments[0].author).toBe('braxton');
    expect(converted?.votes).toEqual({ up: 2, down: 0, mine: 'up' });
    expect(converted?.commentVotes.get(101)).toEqual({ up: 1, down: 0, mine: 'up' });
  });

  it('ignores issues that do not carry note metadata', () => {
    expect(issueToBoardNote(issue('Regular issue'), [], 'jamie')).toBeNull();
  });
});
