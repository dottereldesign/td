import {
  BOARD_LABEL,
  BOARD_STATUSES,
  type BoardComment,
  type BoardNote,
  type BoardStatus,
  type BoardUser,
  type EntryMetadata,
  type GitHubComment,
  type GitHubIssue,
  type NoteMetadata,
  type VoteMetadata,
  type VoteSummary,
  type VoteValue,
} from './types';

const META_PATTERN = /^<!-- build-board:(\{.*\}) -->\s*/;

export function titleCaseUser(user: BoardUser): string {
  return user === 'jamie' ? 'Jamie' : 'Braxton';
}

export function statusLabel(status: BoardStatus): string {
  return `board:${status}`;
}

export function serializeEntry(metadata: EntryMetadata, body = ''): string {
  return `<!-- build-board:${JSON.stringify(metadata)} -->\n${body.trim()}`.trim();
}

export function parseEntry(value: string | null): { metadata: EntryMetadata | null; body: string } {
  const source = value ?? '';
  const match = source.match(META_PATTERN);
  if (!match) return { metadata: null, body: source.trim() };

  try {
    return {
      metadata: JSON.parse(match[1]) as EntryMetadata,
      body: source.replace(META_PATTERN, '').trim(),
    };
  } catch {
    return { metadata: null, body: source.trim() };
  }
}

export function getIssueStatus(issue: GitHubIssue): BoardStatus {
  const labels = issue.labels.map((label) => (typeof label === 'string' ? label : label.name));
  return BOARD_STATUSES.find((status) => labels.includes(statusLabel(status.id)))?.id ?? 'ideas';
}

function emptyVotes(): VoteSummary {
  return { up: 0, down: 0, mine: 'none' };
}

function summarizeVotes(votes: VoteMetadata[], currentUser: BoardUser): VoteSummary {
  const latestByAuthor = new Map<BoardUser, VoteValue>();
  votes.forEach((vote) => latestByAuthor.set(vote.author, vote.value));

  return {
    up: [...latestByAuthor.values()].filter((value) => value === 'up').length,
    down: [...latestByAuthor.values()].filter((value) => value === 'down').length,
    mine: latestByAuthor.get(currentUser) ?? 'none',
  };
}

export function issueToBoardNote(
  issue: GitHubIssue,
  rawComments: GitHubComment[],
  currentUser: BoardUser,
): BoardNote | null {
  const parsedIssue = parseEntry(issue.body);
  if (parsedIssue.metadata?.kind !== 'note') return null;

  const metadata = parsedIssue.metadata as NoteMetadata;
  const comments: BoardComment[] = [];
  const votes: VoteMetadata[] = [];

  rawComments.forEach((comment) => {
    const parsed = parseEntry(comment.body);
    if (parsed.metadata?.kind === 'comment') {
      comments.push({
        id: comment.id,
        body: parsed.body,
        author: parsed.metadata.author,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
      });
    } else if (parsed.metadata?.kind === 'vote') {
      votes.push(parsed.metadata);
    }
  });

  const noteVotes = votes.filter((vote) => vote.target === 'note');
  const commentVotes = new Map<number, VoteSummary>();
  comments.forEach((comment) => {
    const target = `comment:${comment.id}` as const;
    commentVotes.set(comment.id, summarizeVotes(votes.filter((vote) => vote.target === target), currentUser));
  });

  return {
    number: issue.number,
    title: issue.title,
    body: parsedIssue.body,
    status: getIssueStatus(issue),
    author: metadata.author,
    owner: metadata.owner,
    priority: metadata.priority,
    dueDate: metadata.dueDate,
    project: metadata.project,
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    htmlUrl: issue.html_url,
    comments,
    commentVotes,
    votes: noteVotes.length ? summarizeVotes(noteVotes, currentUser) : emptyVotes(),
  };
}

export function isBoardIssue(issue: GitHubIssue): boolean {
  if (issue.pull_request) return false;
  const labels = issue.labels.map((label) => (typeof label === 'string' ? label : label.name));
  return labels.includes(BOARD_LABEL);
}
