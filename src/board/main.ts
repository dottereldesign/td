import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Cloud,
  ExternalLink,
  Github,
  KeyRound,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  WifiOff,
  X,
  createIcons,
} from 'lucide';
import { GitHubApiError, GitHubBoardClient } from './github';
import { issueToBoardNote, isBoardIssue, titleCaseUser } from './model';
import {
  BOARD_STATUSES,
  type BoardNote,
  type BoardOwner,
  type BoardPriority,
  type BoardStatus,
  type BoardUser,
  type CreateNoteInput,
  type VoteValue,
} from './types';
import './style.css';

const REPOSITORY = { owner: 'dottereldesign', repo: 'td' } as const;
const STORAGE_KEYS = {
  user: 'build-board:user',
  token: 'build-board:github-token',
  githubLogin: 'build-board:github-login',
} as const;
const CREDENTIALS: Record<BoardUser, string> = {
  jamie: 'B&J123!',
  braxton: 'B&J123!',
};

const icons = {
  Archive,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Cloud,
  ExternalLink,
  Github,
  KeyRound,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ThumbsDown,
  ThumbsUp,
  WifiOff,
  X,
};

function refreshIcons(): void {
  createIcons({
    icons,
    attrs: { width: '16', height: '16', 'stroke-width': '2', 'aria-hidden': 'true' },
    nameAttr: 'data-lucide',
  });
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

const elements = {
  kanban: getElement<HTMLElement>('kanban'),
  syncState: getElement<HTMLElement>('sync-state'),
  refreshButton: getElement<HTMLButtonElement>('refresh-button'),
  userButton: getElement<HTMLButtonElement>('user-button'),
  userInitial: getElement<HTMLElement>('user-initial'),
  userName: getElement<HTMLElement>('user-name'),
  addNoteButton: getElement<HTMLButtonElement>('add-note-button'),
  searchInput: getElement<HTMLInputElement>('search-input'),
  openCount: getElement<HTMLElement>('open-count'),
  progressCount: getElement<HTMLElement>('progress-count'),
  doneCount: getElement<HTMLElement>('done-count'),
  loginDialog: getElement<HTMLDialogElement>('login-dialog'),
  loginForm: getElement<HTMLFormElement>('login-form'),
  loginUsername: getElement<HTMLInputElement>('login-username'),
  loginPassword: getElement<HTMLInputElement>('login-password'),
  loginError: getElement<HTMLElement>('login-error'),
  syncDialog: getElement<HTMLDialogElement>('sync-dialog'),
  syncForm: getElement<HTMLFormElement>('sync-form'),
  tokenInput: getElement<HTMLInputElement>('token-input'),
  syncError: getElement<HTMLElement>('sync-error'),
  readOnlyButton: getElement<HTMLButtonElement>('read-only-button'),
  accountDialog: getElement<HTMLDialogElement>('account-dialog'),
  accountTitle: getElement<HTMLElement>('account-title'),
  accountCopy: getElement<HTMLElement>('account-copy'),
  accountAvatar: getElement<HTMLElement>('account-avatar'),
  accountName: getElement<HTMLElement>('account-name'),
  accountSync: getElement<HTMLElement>('account-sync'),
  changeTokenButton: getElement<HTMLButtonElement>('change-token-button'),
  signOutButton: getElement<HTMLButtonElement>('sign-out-button'),
  noteDialog: getElement<HTMLDialogElement>('note-dialog'),
  noteForm: getElement<HTMLFormElement>('note-form'),
  noteTitle: getElement<HTMLInputElement>('note-title'),
  noteBody: getElement<HTMLTextAreaElement>('note-body'),
  noteStatus: getElement<HTMLSelectElement>('note-status'),
  noteOwner: getElement<HTMLSelectElement>('note-owner'),
  notePriority: getElement<HTMLSelectElement>('note-priority'),
  noteDueDate: getElement<HTMLInputElement>('note-due-date'),
  noteProject: getElement<HTMLInputElement>('note-project'),
  noteError: getElement<HTMLElement>('note-error'),
  detailDialog: getElement<HTMLDialogElement>('detail-dialog'),
  detailContent: getElement<HTMLElement>('detail-content'),
  toastRegion: getElement<HTMLElement>('toast-region'),
};

let currentUser = getStoredUser();
let notes: BoardNote[] = [];
let scope: 'all' | 'mine' = 'all';
let query = '';
let selectedNoteNumber: number | null = null;
let syncing = false;
let draggedNoteNumber: number | null = null;

function getStoredUser(): BoardUser | null {
  const value = sessionStorage.getItem(STORAGE_KEYS.user);
  return value === 'jamie' || value === 'braxton' ? value : null;
}

function getToken(): string {
  return localStorage.getItem(STORAGE_KEYS.token) ?? '';
}

function boardClient(token = getToken()): GitHubBoardClient {
  return new GitHubBoardClient(REPOSITORY.owner, REPOSITORY.repo, token);
}

function showDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) dialog.close();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  const difference = timestamp - Date.now();
  const absolute = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (absolute < 60_000) return 'just now';
  if (absolute < 3_600_000) return formatter.format(Math.round(difference / 60_000), 'minute');
  if (absolute < 86_400_000) return formatter.format(Math.round(difference / 3_600_000), 'hour');
  if (absolute < 604_800_000) return formatter.format(Math.round(difference / 86_400_000), 'day');
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(timestamp);
}

function formatDueDate(value: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
}

function isOverdue(value: string, status: BoardStatus): boolean {
  if (!value || status === 'complete') return false;
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return value < localDate;
}

function ownerLabel(owner: BoardOwner): string {
  if (owner === 'both') return 'Jamie + Braxton';
  return titleCaseUser(owner);
}

function avatarMarkup(user: BoardUser): string {
  const name = titleCaseUser(user);
  return `<span class="avatar avatar--${user}" title="${name}" aria-label="${name}">${name[0]}</span>`;
}

function ownerAvatars(owner: BoardOwner): string {
  return owner === 'both' ? `${avatarMarkup('jamie')}${avatarMarkup('braxton')}` : avatarMarkup(owner);
}

function toast(message: string, tone: 'normal' | 'error' = 'normal'): void {
  const item = document.createElement('div');
  item.className = `toast${tone === 'error' ? ' is-error' : ''}`;
  item.textContent = message;
  elements.toastRegion.append(item);
  window.setTimeout(() => item.remove(), 3800);
}

function setSyncState(state: 'ready' | 'syncing' | 'offline' | 'error', text: string): void {
  const icon = state === 'syncing' ? 'loader-circle' : state === 'offline' || state === 'error' ? 'wifi-off' : 'cloud';
  elements.syncState.className = `sync-state${state === 'syncing' ? ' is-syncing' : ''}${state === 'error' ? ' is-error' : ''}`;
  elements.syncState.innerHTML = `<i data-lucide="${icon}"></i><span>${escapeHtml(text)}</span>`;
  refreshIcons();
}

function renderUser(): void {
  const displayName = currentUser ? titleCaseUser(currentUser) : 'Sign in';
  elements.userInitial.textContent = currentUser ? displayName[0] : '?';
  elements.userInitial.className = currentUser ? `avatar--${currentUser}` : '';
  elements.userName.textContent = displayName;
  elements.accountAvatar.textContent = currentUser ? displayName[0] : '?';
  elements.accountAvatar.className = currentUser ? `avatar--${currentUser}` : '';
  elements.accountName.textContent = displayName;
  elements.accountTitle.textContent = currentUser ? `Signed in as ${displayName}.` : 'Not signed in.';
  elements.accountCopy.textContent = currentUser
    ? `Notes, comments, and votes you add are labelled ${displayName}.`
    : 'Sign in to take part in the shared board.';
  elements.accountSync.textContent = getToken()
    ? `GitHub sync connected${localStorage.getItem(STORAGE_KEYS.githubLogin) ? ` via @${localStorage.getItem(STORAGE_KEYS.githubLogin)}` : ''}`
    : 'Read-only · sync token needed for changes';
}

function renderSummary(): void {
  const activeNotes = notes.filter((note) => note.state === 'open');
  const progress = activeNotes.filter((note) => note.status === 'progress').length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const doneThisWeek = activeNotes.filter((note) => note.status === 'complete' && new Date(note.updatedAt).getTime() >= weekAgo).length;
  elements.openCount.textContent = String(activeNotes.filter((note) => note.status !== 'complete').length);
  elements.progressCount.textContent = `${progress} / 3`;
  elements.doneCount.textContent = String(doneThisWeek);
}

function filteredNotes(): BoardNote[] {
  const normalized = query.trim().toLowerCase();
  return notes.filter((note) => {
    if (note.state !== 'open') return false;
    if (scope === 'mine' && currentUser && note.owner !== currentUser && note.owner !== 'both') return false;
    if (!normalized) return true;
    return [note.title, note.body, note.project, ownerLabel(note.owner), titleCaseUser(note.author)]
      .some((value) => value.toLowerCase().includes(normalized));
  });
}

function renderCard(note: BoardNote): string {
  const project = note.project || 'General';
  const due = note.dueDate
    ? `<span class="due-label${isOverdue(note.dueDate, note.status) ? ' is-overdue' : ''}"><i data-lucide="calendar-days"></i>${isOverdue(note.dueDate, note.status) ? 'Overdue · ' : 'Due · '}${escapeHtml(formatDueDate(note.dueDate))}</span>`
    : '';
  const body = note.body ? `<p>${escapeHtml(note.body)}</p>` : '';
  return `
    <article class="note-card" draggable="true" tabindex="0" role="button" aria-label="Open ${escapeHtml(note.title)}" data-note-number="${note.number}">
      <div class="card-topline">
        <span class="project-tag">${escapeHtml(project)}</span>
        <i class="priority-dot priority-dot--${note.priority}" title="${note.priority} priority"></i>
      </div>
      <h3>${escapeHtml(note.title)}</h3>
      ${body}
      ${due}
      <div class="card-footer">
        <div class="avatar-stack">${ownerAvatars(note.owner)}</div>
        <div class="card-activity">
          <span title="Comments"><i data-lucide="message-square"></i>${note.comments.length}</span>
          <span title="Agrees"><i data-lucide="thumbs-up"></i>${note.votes.up}</span>
          <span title="Disagrees"><i data-lucide="thumbs-down"></i>${note.votes.down}</span>
        </div>
      </div>
    </article>`;
}

function renderBoard(): void {
  const visible = filteredNotes();
  elements.kanban.innerHTML = BOARD_STATUSES.map((status) => {
    const statusNotes = visible.filter((note) => note.status === status.id);
    const limitText = status.id === 'progress' ? `${statusNotes.length} / 3` : String(statusNotes.length);
    const emptyMessage = query ? 'No matching notes here.' : status.id === 'ideas' ? 'Add a thought before it disappears.' : 'Drop a card here when it is ready.';
    return `
      <section class="kanban-column" data-status="${status.id}" aria-labelledby="column-${status.id}">
        <header class="column-header">
          <div>
            <div class="column-title"><i></i><strong id="column-${status.id}">${status.label}</strong></div>
            <p>${status.description}</p>
          </div>
          <span class="column-count${status.id === 'progress' && statusNotes.length > 3 ? ' is-over-limit' : ''}">${limitText}</span>
        </header>
        <div class="column-cards">
          ${statusNotes.length ? statusNotes.map(renderCard).join('') : `<div class="column-empty">${emptyMessage}</div>`}
        </div>
      </section>`;
  }).join('');
  renderSummary();
  refreshIcons();
}

function renderVoteButton(target: 'note' | `comment:${number}`, value: Exclude<VoteValue, 'none'>, count: number, mine: VoteValue): string {
  const icon = value === 'up' ? 'thumbs-up' : 'thumbs-down';
  const label = value === 'up' ? 'Agree' : 'Disagree';
  return `<button class="vote-button${mine === value ? ' is-active' : ''}" type="button" data-vote-target="${target}" data-vote-value="${value}" aria-pressed="${mine === value}"><i data-lucide="${icon}"></i>${label}<strong>${count}</strong></button>`;
}

function renderDetail(): void {
  if (selectedNoteNumber === null) return;
  const note = notes.find((item) => item.number === selectedNoteNumber);
  if (!note) {
    closeDialog(elements.detailDialog);
    selectedNoteNumber = null;
    return;
  }

  const statusOptions = BOARD_STATUSES.map((status) => `<option value="${status.id}"${status.id === note.status ? ' selected' : ''}>${status.label}</option>`).join('');
  const commentMarkup = note.comments.length
    ? note.comments.map((comment) => {
      const votes = note.commentVotes.get(comment.id) ?? { up: 0, down: 0, mine: 'none' as const };
      return `
        <article class="comment">
          <div class="comment-meta">
            <span class="comment-author">${avatarMarkup(comment.author)}${titleCaseUser(comment.author)}</span>
            <time datetime="${comment.createdAt}">${formatRelativeTime(comment.createdAt)}</time>
          </div>
          <p>${escapeHtml(comment.body)}</p>
          <div class="vote-group">
            ${renderVoteButton(`comment:${comment.id}`, 'up', votes.up, votes.mine)}
            ${renderVoteButton(`comment:${comment.id}`, 'down', votes.down, votes.mine)}
          </div>
        </article>`;
    }).join('')
    : '<div class="comment-empty">No comments yet. Add the context the other person needs.</div>';

  const project = note.project ? `<span>${escapeHtml(note.project)}</span>` : '';
  const due = note.dueDate ? `<span><i data-lucide="calendar-days"></i>Due ${escapeHtml(formatDueDate(note.dueDate))}</span>` : '';
  elements.detailContent.innerHTML = `
    <button class="dialog-close" data-detail-action="close" type="button" aria-label="Close"><i data-lucide="x"></i></button>
    <div class="detail-heading">
      <p class="eyebrow">Note #${note.number}</p>
      <h2>${escapeHtml(note.title)}</h2>
      <div class="detail-meta">
        <span>Added by ${titleCaseUser(note.author)} ${formatRelativeTime(note.createdAt)}</span>
        <span>Owned by ${ownerLabel(note.owner)}</span>
        <span>${note.priority} priority</span>
        ${project}${due}
      </div>
    </div>
    ${note.body ? `<p class="detail-body">${escapeHtml(note.body)}</p>` : ''}
    <div class="detail-controls">
      <div class="vote-group">
        ${renderVoteButton('note', 'up', note.votes.up, note.votes.mine)}
        ${renderVoteButton('note', 'down', note.votes.down, note.votes.mine)}
      </div>
      <label class="sr-only" for="detail-status">Move note</label>
      <select class="move-select" id="detail-status" data-detail-action="move">${statusOptions}</select>
    </div>
    <section class="comments-section">
      <div class="comments-header"><h3>Conversation</h3><span>${note.comments.length} comment${note.comments.length === 1 ? '' : 's'}</span></div>
      <div class="comment-list">${commentMarkup}</div>
      <form class="comment-form" id="comment-form">
        <label class="sr-only" for="comment-body">Add a comment</label>
        <textarea id="comment-body" maxlength="2000" placeholder="Add a comment as ${currentUser ? titleCaseUser(currentUser) : 'yourself'}…" required></textarea>
        <button class="primary-button" type="submit">Comment<i data-lucide="send"></i></button>
      </form>
    </section>
    <div class="detail-footer">
      <button class="danger-link" data-detail-action="archive" type="button"><i data-lucide="archive"></i> Archive note</button>
      <a class="github-link" href="${note.htmlUrl}" target="_blank" rel="noreferrer">Open on GitHub<i data-lucide="external-link"></i></a>
    </div>`;
  refreshIcons();
}

function humanizeError(error: unknown): string {
  if (!navigator.onLine) return 'You are offline. Reconnect and try again.';
  if (error instanceof GitHubApiError) {
    if (error.status === 401) return 'That GitHub token is invalid or expired.';
    if (error.status === 403) return 'The token needs Issues: read and write access to dottereldesign/td.';
    if (error.status === 404) return 'The repository could not be reached with this token.';
    if (error.status === 422) return 'GitHub could not save that change. Check the fields and try again.';
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

async function syncBoard(options: { ensureLabels?: boolean; quiet?: boolean } = {}): Promise<void> {
  if (!currentUser || syncing) return;
  syncing = true;
  setSyncState('syncing', 'Syncing');
  elements.refreshButton.disabled = true;
  try {
    const client = boardClient();
    if (options.ensureLabels && getToken()) await client.ensureLabels();
    const issues = (await client.listIssues()).filter(isBoardIssue);
    const comments = await Promise.all(issues.map((issue) => client.listComments(issue.number)));
    notes = issues
      .map((issue, index) => issueToBoardNote(issue, comments[index], currentUser as BoardUser))
      .filter((note): note is BoardNote => Boolean(note));
    renderBoard();
    if (elements.detailDialog.open) renderDetail();
    setSyncState('ready', 'Up to date');
    if (!options.quiet) toast('Shared board is up to date.');
  } catch (error) {
    setSyncState(navigator.onLine ? 'error' : 'offline', navigator.onLine ? 'Sync failed' : 'Offline');
    if (!options.quiet || notes.length === 0) toast(humanizeError(error), 'error');
  } finally {
    syncing = false;
    elements.refreshButton.disabled = false;
  }
}

async function withWrite(successMessage: string, action: (client: GitHubBoardClient, user: BoardUser) => Promise<unknown>): Promise<void> {
  if (!currentUser) {
    showDialog(elements.loginDialog);
    return;
  }
  if (!getToken()) {
    elements.syncError.textContent = 'Connect a GitHub token before making shared changes.';
    showDialog(elements.syncDialog);
    return;
  }
  setSyncState('syncing', 'Saving');
  try {
    await action(boardClient(), currentUser);
    await syncBoard({ quiet: true });
    toast(successMessage);
  } catch (error) {
    setSyncState('error', 'Save failed');
    toast(humanizeError(error), 'error');
    throw error;
  }
}

function openNote(number: number): void {
  selectedNoteNumber = number;
  renderDetail();
  showDialog(elements.detailDialog);
}

async function moveNote(number: number, status: BoardStatus): Promise<void> {
  const note = notes.find((item) => item.number === number);
  if (!note || note.status === status) return;
  if (status === 'progress' && notes.filter((item) => item.state === 'open' && item.status === 'progress').length >= 3) {
    toast('Heads up: this puts more than three items in progress. Finish before starting more.', 'error');
  }
  await withWrite(`Moved to ${BOARD_STATUSES.find((item) => item.id === status)?.label ?? status}.`, (client) => client.updateStatus(number, status));
}

async function vote(target: 'note' | `comment:${number}`, requested: Exclude<VoteValue, 'none'>): Promise<void> {
  if (selectedNoteNumber === null) return;
  const note = notes.find((item) => item.number === selectedNoteNumber);
  if (!note) return;
  const current = target === 'note' ? note.votes.mine : note.commentVotes.get(Number(target.split(':')[1]))?.mine ?? 'none';
  const value: VoteValue = current === requested ? 'none' : requested;
  await withWrite(value === 'none' ? 'Vote removed.' : value === 'up' ? 'Agreed.' : 'Disagreed.', (client, user) => client.addVote(note.number, {
    kind: 'vote',
    author: user,
    target,
    value,
  }));
}

elements.loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const username = elements.loginUsername.value.trim().toLowerCase();
  const password = elements.loginPassword.value;
  if ((username !== 'jamie' && username !== 'braxton') || CREDENTIALS[username] !== password) {
    elements.loginError.textContent = 'That username or password is not right.';
    elements.loginPassword.select();
    return;
  }
  currentUser = username;
  sessionStorage.setItem(STORAGE_KEYS.user, currentUser);
  elements.loginError.textContent = '';
  elements.loginForm.reset();
  closeDialog(elements.loginDialog);
  renderUser();
  if (!getToken()) showDialog(elements.syncDialog);
  void syncBoard({ ensureLabels: Boolean(getToken()), quiet: true });
});

elements.syncForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = elements.tokenInput.value.trim();
  const submit = elements.syncForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  elements.syncError.textContent = '';
  if (submit) submit.disabled = true;
  try {
    const client = boardClient(token);
    const user = await client.validateToken();
    await client.ensureLabels();
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.githubLogin, user.login);
    elements.tokenInput.value = '';
    closeDialog(elements.syncDialog);
    renderUser();
    await syncBoard({ quiet: true });
    toast(`Shared sync connected via @${user.login}.`);
  } catch (error) {
    elements.syncError.textContent = humanizeError(error);
  } finally {
    if (submit) submit.disabled = false;
  }
});

elements.readOnlyButton.addEventListener('click', () => {
  closeDialog(elements.syncDialog);
  void syncBoard({ quiet: true });
  toast('Viewing the shared board in read-only mode.');
});

elements.noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input: CreateNoteInput = {
    title: elements.noteTitle.value.trim(),
    body: elements.noteBody.value.trim(),
    status: elements.noteStatus.value as BoardStatus,
    owner: elements.noteOwner.value as BoardOwner,
    priority: elements.notePriority.value as BoardPriority,
    dueDate: elements.noteDueDate.value,
    project: elements.noteProject.value.trim(),
    author: currentUser ?? 'jamie',
  };
  if (!input.title) {
    elements.noteError.textContent = 'Give the note a short, clear title.';
    return;
  }
  const submit = elements.noteForm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    await withWrite('Note added to the shared board.', (client, user) => client.createNote({ ...input, author: user }));
    elements.noteForm.reset();
    elements.noteStatus.value = 'ideas';
    elements.noteOwner.value = 'both';
    elements.notePriority.value = 'normal';
    elements.noteError.textContent = '';
    closeDialog(elements.noteDialog);
  } catch {
    elements.noteError.textContent = 'The note was not saved. Check sync and try again.';
  } finally {
    if (submit) submit.disabled = false;
  }
});

elements.detailContent.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const action = target.closest<HTMLElement>('[data-detail-action]')?.dataset.detailAction;
  if (action === 'close') closeDialog(elements.detailDialog);
  if (action === 'archive' && selectedNoteNumber !== null && window.confirm('Archive this note? It will stay recoverable in GitHub Issues.')) {
    const number = selectedNoteNumber;
    void withWrite('Note archived.', (client) => client.archiveNote(number)).then(() => closeDialog(elements.detailDialog));
  }
  const voteButton = target.closest<HTMLButtonElement>('[data-vote-target]');
  if (voteButton) {
    const voteTarget = voteButton.dataset.voteTarget as 'note' | `comment:${number}`;
    const voteValue = voteButton.dataset.voteValue as 'up' | 'down';
    void vote(voteTarget, voteValue);
  }
});

elements.detailContent.addEventListener('change', (event) => {
  const target = event.target as HTMLSelectElement;
  if (target.dataset.detailAction === 'move' && selectedNoteNumber !== null) void moveNote(selectedNoteNumber, target.value as BoardStatus);
});

elements.detailContent.addEventListener('submit', (event) => {
  if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'comment-form') return;
  event.preventDefault();
  const textarea = event.target.querySelector<HTMLTextAreaElement>('textarea');
  const body = textarea?.value.trim() ?? '';
  if (!body || selectedNoteNumber === null) return;
  const number = selectedNoteNumber;
  if (textarea) textarea.disabled = true;
  void withWrite('Comment added.', (client, user) => client.addComment(number, { kind: 'comment', author: user }, body))
    .catch(() => undefined)
    .finally(() => { if (textarea) textarea.disabled = false; });
});

elements.kanban.addEventListener('click', (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>('[data-note-number]');
  if (card) openNote(Number(card.dataset.noteNumber));
});

elements.kanban.addEventListener('keydown', (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>('[data-note-number]');
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openNote(Number(card.dataset.noteNumber));
  }
});

elements.kanban.addEventListener('dragstart', (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>('[data-note-number]');
  if (!card) return;
  draggedNoteNumber = Number(card.dataset.noteNumber);
  card.classList.add('is-dragging');
  event.dataTransfer?.setData('text/plain', String(draggedNoteNumber));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
});

elements.kanban.addEventListener('dragend', (event) => {
  (event.target as HTMLElement).closest('.note-card')?.classList.remove('is-dragging');
  elements.kanban.querySelectorAll('.is-drag-over').forEach((column) => column.classList.remove('is-drag-over'));
  draggedNoteNumber = null;
});

elements.kanban.addEventListener('dragover', (event) => {
  const column = (event.target as HTMLElement).closest<HTMLElement>('[data-status]');
  if (!column || draggedNoteNumber === null) return;
  event.preventDefault();
  elements.kanban.querySelectorAll('.is-drag-over').forEach((item) => item.classList.remove('is-drag-over'));
  column.classList.add('is-drag-over');
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
});

elements.kanban.addEventListener('drop', (event) => {
  const column = (event.target as HTMLElement).closest<HTMLElement>('[data-status]');
  if (!column) return;
  event.preventDefault();
  column.classList.remove('is-drag-over');
  const number = draggedNoteNumber ?? Number(event.dataTransfer?.getData('text/plain'));
  if (number) void moveNote(number, column.dataset.status as BoardStatus);
});

elements.addNoteButton.addEventListener('click', () => {
  if (!currentUser) return showDialog(elements.loginDialog);
  if (!getToken()) return showDialog(elements.syncDialog);
  elements.noteOwner.value = 'both';
  showDialog(elements.noteDialog);
  window.setTimeout(() => elements.noteTitle.focus(), 50);
});

elements.refreshButton.addEventListener('click', () => void syncBoard());
elements.userButton.addEventListener('click', () => {
  if (!currentUser) showDialog(elements.loginDialog);
  else {
    renderUser();
    showDialog(elements.accountDialog);
  }
});

elements.changeTokenButton.addEventListener('click', () => {
  closeDialog(elements.accountDialog);
  elements.syncError.textContent = '';
  showDialog(elements.syncDialog);
});

elements.signOutButton.addEventListener('click', () => {
  sessionStorage.removeItem(STORAGE_KEYS.user);
  currentUser = null;
  notes = [];
  selectedNoteNumber = null;
  closeDialog(elements.accountDialog);
  renderUser();
  renderBoard();
  showDialog(elements.loginDialog);
});

elements.searchInput.addEventListener('input', () => {
  query = elements.searchInput.value;
  renderBoard();
});

document.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((button) => {
  button.addEventListener('click', () => {
    scope = button.dataset.scope as 'all' | 'mine';
    document.querySelectorAll('[data-scope]').forEach((item) => item.classList.toggle('is-active', item === button));
    renderBoard();
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => closeDialog(getElement<HTMLDialogElement>(button.dataset.closeDialog ?? '')));
});

document.querySelectorAll<HTMLDialogElement>('dialog:not(#login-dialog)').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
    event.preventDefault();
    elements.searchInput.focus();
  }
  if (event.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName) && currentUser && getToken()) {
    event.preventDefault();
    showDialog(elements.noteDialog);
    window.setTimeout(() => elements.noteTitle.focus(), 50);
  }
});

window.addEventListener('offline', () => setSyncState('offline', 'Offline'));
window.addEventListener('online', () => void syncBoard({ quiet: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentUser) void syncBoard({ quiet: true });
});
window.setInterval(() => {
  if (document.visibilityState === 'visible' && currentUser) void syncBoard({ quiet: true });
}, 60_000);

refreshIcons();
renderUser();
renderBoard();
if (currentUser) {
  if (!getToken()) showDialog(elements.syncDialog);
  void syncBoard({ ensureLabels: Boolean(getToken()), quiet: true });
} else {
  showDialog(elements.loginDialog);
  window.setTimeout(() => elements.loginUsername.focus(), 50);
}
