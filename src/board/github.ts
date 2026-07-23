import { serializeEntry, statusLabel } from './model';
import {
  BOARD_LABEL,
  BOARD_STATUSES,
  type BoardStatus,
  type CommentMetadata,
  type CreateNoteInput,
  type GitHubComment,
  type GitHubIssue,
  type VoteMetadata,
} from './types';

const API_VERSION = '2022-11-28';

interface GitHubUser {
  login: string;
}

interface GitHubApiErrorBody {
  message?: string;
  documentation_url?: string;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class GitHubBoardClient {
  private readonly apiRoot: string;

  constructor(
    owner: string,
    repo: string,
    private readonly token = '',
  ) {
    this.apiRoot = `https://api.github.com/repos/${owner}/${repo}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', API_VERSION);
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    if (init.body) headers.set('Content-Type', 'application/json');

    const response = await fetch(path.startsWith('https://') ? path : `${this.apiRoot}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as GitHubApiErrorBody;
      throw new GitHubApiError(body.message ?? `GitHub request failed (${response.status})`, response.status);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  validateToken(): Promise<GitHubUser> {
    return this.request<GitHubUser>('https://api.github.com/user');
  }

  async ensureLabels(): Promise<void> {
    const labels = await this.request<Array<{ name: string }>>('/labels?per_page=100');
    const existing = new Set(labels.map((label) => label.name));
    const required = [
      { name: BOARD_LABEL, color: '111111', description: 'Shared build board item' },
      ...BOARD_STATUSES.map((status) => ({
        name: statusLabel(status.id),
        color: status.color,
        description: status.description,
      })),
    ];

    await Promise.all(
      required
        .filter((label) => !existing.has(label.name))
        .map((label) => this.request('/labels', { method: 'POST', body: JSON.stringify(label) })),
    );
  }

  listIssues(): Promise<GitHubIssue[]> {
    return this.request<GitHubIssue[]>(
      `/issues?state=all&labels=${encodeURIComponent(BOARD_LABEL)}&per_page=100&sort=updated&direction=desc`,
    );
  }

  listComments(issueNumber: number): Promise<GitHubComment[]> {
    return this.request<GitHubComment[]>(`/issues/${issueNumber}/comments?per_page=100`);
  }

  createNote(input: CreateNoteInput): Promise<GitHubIssue> {
    const body = serializeEntry(
      {
        kind: 'note',
        author: input.author,
        owner: input.owner,
        priority: input.priority,
        dueDate: input.dueDate,
        project: input.project,
      },
      input.body,
    );

    return this.request<GitHubIssue>('/issues', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        body,
        labels: [BOARD_LABEL, statusLabel(input.status)],
      }),
    });
  }

  updateStatus(issueNumber: number, status: BoardStatus): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/issues/${issueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ labels: [BOARD_LABEL, statusLabel(status)], state: 'open' }),
    });
  }

  addComment(issueNumber: number, metadata: CommentMetadata, body: string): Promise<GitHubComment> {
    return this.request<GitHubComment>(`/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: serializeEntry(metadata, body) }),
    });
  }

  addVote(issueNumber: number, metadata: VoteMetadata): Promise<GitHubComment> {
    return this.request<GitHubComment>(`/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: serializeEntry(metadata) }),
    });
  }

  archiveNote(issueNumber: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/issues/${issueNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }),
    });
  }
}
