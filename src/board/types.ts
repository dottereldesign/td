export const BOARD_LABEL = 'studio-board';

export const BOARD_STATUSES = [
  { id: 'ideas', label: 'Ideas', description: 'Worth exploring', color: '8b949e' },
  { id: 'next', label: 'Up next', description: 'Committed and ready', color: 'd0d7de' },
  { id: 'progress', label: 'In progress', description: 'Actively being built', color: 'ffffff' },
  { id: 'complete', label: 'Complete', description: 'Shipped and done', color: '6e7781' },
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number]['id'];
export type BoardUser = 'jamie' | 'braxton';
export type BoardOwner = BoardUser | 'both';
export type BoardPriority = 'low' | 'normal' | 'high';
export type VoteValue = 'up' | 'down' | 'none';

export interface NoteMetadata {
  kind: 'note';
  author: BoardUser;
  owner: BoardOwner;
  priority: BoardPriority;
  dueDate: string;
  project: string;
}

export interface CommentMetadata {
  kind: 'comment';
  author: BoardUser;
}

export interface VoteMetadata {
  kind: 'vote';
  author: BoardUser;
  target: 'note' | `comment:${number}`;
  value: VoteValue;
}

export type EntryMetadata = NoteMetadata | CommentMetadata | VoteMetadata;

export interface GitHubLabel {
  name: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<GitHubLabel | string>;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: unknown;
}

export interface GitHubComment {
  id: number;
  body: string | null;
  created_at: string;
  updated_at: string;
}

export interface BoardComment {
  id: number;
  body: string;
  author: BoardUser;
  createdAt: string;
  updatedAt: string;
}

export interface VoteSummary {
  up: number;
  down: number;
  mine: VoteValue;
}

export interface BoardNote {
  number: number;
  title: string;
  body: string;
  status: BoardStatus;
  author: BoardUser;
  owner: BoardOwner;
  priority: BoardPriority;
  dueDate: string;
  project: string;
  state: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  comments: BoardComment[];
  commentVotes: Map<number, VoteSummary>;
  votes: VoteSummary;
}

export interface CreateNoteInput {
  title: string;
  body: string;
  status: BoardStatus;
  owner: BoardOwner;
  priority: BoardPriority;
  dueDate: string;
  project: string;
  author: BoardUser;
}
