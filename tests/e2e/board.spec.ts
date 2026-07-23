import { expect, test, type Page, type Route } from '@playwright/test';

const labels = [
  { name: 'studio-board' },
  { name: 'board:ideas' },
  { name: 'board:next' },
  { name: 'board:progress' },
  { name: 'board:complete' },
];

function metadata(value: object, body = ''): string {
  return `<!-- build-board:${JSON.stringify(value)} -->\n${body}`;
}

function issue(number: number, title: string, status: string, author: 'jamie' | 'braxton', owner: 'jamie' | 'braxton' | 'both', body: string) {
  return {
    number,
    title,
    body: metadata({ kind: 'note', author, owner, priority: number === 2 ? 'high' : 'normal', dueDate: '', project: number % 2 ? 'Wizino TD' : 'Client portal' }, body),
    state: 'open',
    labels: [{ name: 'studio-board' }, { name: `board:${status}` }],
    created_at: '2026-07-21T01:00:00Z',
    updated_at: '2026-07-22T01:00:00Z',
    html_url: `https://github.com/dottereldesign/td/issues/${number}`,
  };
}

const issues = [
  issue(1, 'Design the onboarding flow', 'ideas', 'jamie', 'both', 'Keep the first run short and make the value obvious.'),
  issue(2, 'Fix mobile tower placement', 'next', 'braxton', 'jamie', 'Reproduce it on a narrow Android viewport first.'),
  issue(3, 'Ship the shared build board', 'progress', 'jamie', 'both', 'Comments, votes, and timestamps should all sync.'),
  issue(4, 'Polish the home screen', 'complete', 'braxton', 'braxton', 'The final hover and spacing pass is done.'),
];

const commentsByIssue: Record<number, object[]> = {
  1: [],
  2: [],
  3: [
    { id: 301, body: metadata({ kind: 'comment', author: 'braxton' }, 'This is the right level of simple.'), created_at: '2026-07-22T03:00:00Z', updated_at: '2026-07-22T03:00:00Z' },
    { id: 302, body: metadata({ kind: 'vote', author: 'jamie', target: 'note', value: 'up' }), created_at: '2026-07-22T03:01:00Z', updated_at: '2026-07-22T03:01:00Z' },
  ],
  4: [],
};

async function mockGitHub(page: Page): Promise<void> {
  await page.route('https://api.github.com/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/user') return route.fulfill({ json: { login: 'dottereldesign' } });
    if (url.pathname.endsWith('/labels')) return route.fulfill({ json: labels });
    if (url.pathname.endsWith('/issues')) return route.fulfill({ json: issues });
    const commentsMatch = url.pathname.match(/\/issues\/(\d+)\/comments$/);
    if (commentsMatch) return route.fulfill({ json: commentsByIssue[Number(commentsMatch[1])] ?? [] });
    return route.fulfill({ status: 404, json: { message: 'Not mocked' } });
  });
}

test.describe('shared build board', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHub(page);
  });

  test('signs Jamie in and asks for one-time shared sync setup', async ({ page }) => {
    await page.goto('/board/');
    await page.getByLabel('Username').fill('jamie');
    await page.getByLabel('Password').fill('B&J123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Connect the board.' })).toBeVisible();
    await expect(page.getByText('Issues: read and write')).toBeVisible();
  });

  test('renders the shared Kanban, account identity, comments, and votes', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('build-board:user', 'jamie');
      localStorage.setItem('build-board:github-token', 'test-token');
      localStorage.setItem('build-board:github-login', 'dottereldesign');
    });
    await page.goto('/board/');

    await expect(page.getByRole('heading', { name: 'What are we building?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Ship the shared build board' })).toBeVisible();
    await expect(page.locator('.kanban-column')).toHaveCount(4);
    await expect(page.locator('#progress-count')).toHaveText('1 / 3');
    await expect(page.locator('#user-name')).toHaveText('Jamie');

    await page.getByRole('button', { name: 'Open Ship the shared build board' }).click();
    await expect(page.locator('#detail-content').getByRole('heading', { name: 'Ship the shared build board' })).toBeVisible();
    await expect(page.getByText('This is the right level of simple.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Agree/ }).first()).toHaveAttribute('aria-pressed', 'true');

    if (process.env.BOARD_SCREENSHOT) await page.screenshot({ path: process.env.BOARD_SCREENSHOT, fullPage: true });
    expect(testInfo.errors).toHaveLength(0);
  });

  test('keeps the Kanban usable on a narrow phone viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      sessionStorage.setItem('build-board:user', 'braxton');
      localStorage.setItem('build-board:github-token', 'test-token');
    });
    await page.goto('/board/');

    await expect(page.getByRole('button', { name: 'Open Design the onboarding flow' })).toBeVisible();
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const firstColumnWidth = await page.locator('.kanban-column').first().evaluate((element) => element.getBoundingClientRect().width);
    expect(firstColumnWidth).toBeLessThan(viewportWidth);
    await expect(page.locator('.kanban')).toHaveCSS('overflow-x', 'auto');
  });
});
