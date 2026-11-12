// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

const term = {
  _id: 'api',
  name: 'Application Programming Interface',
  aliases: ['API'],
  definition: 'A software interface.',
};
const second = {
  _id: 'ai',
  name: 'Artificial Intelligence',
  aliases: ['AI'],
  definition: 'Learning and reasoning.',
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function mockSearch(terms = [term]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({
      ok: true,
      json: async () =>
        url.startsWith('/api/terms?') ? { terms } : { term: url.endsWith('/ai') ? second : term },
    })),
  );
}

test('debounces suggestions and Enter opens the top result without arrow keys', async () => {
  mockSearch([term, second]);
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'a');
  expect(fetch).not.toHaveBeenCalled();
  await screen.findAllByRole('option');
  expect(fetch).toHaveBeenCalledTimes(1);
  await user.keyboard('{Enter}');
  await screen.findByText(term.definition);
  expect(window.location.hash).toBe('#/terms/api');
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('Enter before autocomplete finishes still opens the first match', async () => {
  mockSearch();
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'api{Enter}');
  await screen.findByText(term.definition);
});

test('arrow keys select a different match', async () => {
  mockSearch([term, second]);
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'a');
  await screen.findAllByRole('option');
  await user.keyboard('{ArrowDown}{Enter}');
  await screen.findByText(second.definition);
  expect(window.location.hash).toBe('#/terms/ai');
});

test('clicking a suggestion opens its definition and the back link returns home', async () => {
  mockSearch();
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'api');
  await user.click(await screen.findByRole('option'));
  await screen.findByText(term.definition);
  await user.click(screen.getByRole('link', { name: 'Back to search' }));
  await screen.findByRole('combobox');
});

test('a direct definition URL loads without a previous search', async () => {
  window.history.replaceState(null, '', '/#/terms/api');
  mockSearch();
  render(<App />);
  await screen.findByRole('heading', { name: term.name });
  expect(fetch).toHaveBeenCalledWith('/api/terms/api', expect.anything());
});

test('empty and failed searches stay on the search page and can be retried', async () => {
  mockSearch([]);
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'unknown{Enter}');
  await screen.findByText('No matching terms.');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false })),
  );
  await user.keyboard('{Enter}');
  await screen.findByText('Search is temporarily unavailable. Please try again.');
  mockSearch();
  await user.keyboard('{Enter}');
  await screen.findByText(term.definition);
});

test('ignores stale responses after the query is cleared', async () => {
  let resolve;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    ),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'api{Enter}');
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await user.clear(screen.getByRole('combobox'));
  await act(async () => resolve({ ok: true, json: async () => ({ terms: [term] }) }));
  expect(screen.queryByRole('option')).toBeNull();
  expect(window.location.hash).toBe('');
});

test('example terms populate autocomplete', async () => {
  mockSearch();
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'API' }));
  await screen.findByRole('option');
  expect(screen.getByRole('combobox').value).toBe('API');
});

test('missing definitions show a recoverable message', async () => {
  window.history.replaceState(null, '', '/#/terms/missing');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 404 })),
  );
  render(<App />);
  await screen.findByText('Term not found.');
  expect(screen.getByRole('link', { name: 'Back to search' })).toBeTruthy();
});

test('waits for the exit animation before opening a definition', async () => {
  mockSearch();
  let finish;
  const animation = {
    finished: new Promise((resolve) => {
      finish = resolve;
    }),
    cancel: vi.fn(),
  };
  const original = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = vi.fn(() => animation);
  try {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole('combobox'), 'api');
    await user.click(await screen.findByRole('option'));
    expect(window.location.hash).toBe('');
    expect(HTMLElement.prototype.animate.mock.calls.map(([, options]) => options.delay)).toEqual([
      0, 60, 120,
    ]);
    expect(screen.queryByText(term.definition)).toBeNull();
    await act(async () => finish());
    await screen.findByText(term.definition);
    expect(window.location.hash).toBe('#/terms/api');
    expect(animation.cancel).toHaveBeenCalled();
  } finally {
    if (original) HTMLElement.prototype.animate = original;
    else delete HTMLElement.prototype.animate;
  }
});

test('related terms navigate to their definition and references open safely', async () => {
  window.history.replaceState(null, '', '/#/terms/api');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({
      ok: true,
      json: async () => ({
        term: url.endsWith('/ai')
          ? second
          : {
              ...term,
              relatedTerms: [second],
              references: [
                {
                  title: 'API documentation',
                  url: 'https://developer.mozilla.org/en-US/docs/Glossary/API',
                },
              ],
              origin: 'ai-generated',
            },
      }),
    })),
  );
  render(<App />);
  const link = await screen.findByRole('link', { name: /API documentation/ });
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(screen.queryByText('AI-generated definition')).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: second.name }));
  await screen.findByRole('heading', { name: second.name });
  expect(screen.getByText('No related terms yet.')).toBeTruthy();
  expect(screen.getByText('No references available yet.')).toBeTruthy();
});

test('bookmarks survive remount and can be removed without removing other bookmarks', async () => {
  localStorage.setItem('techtionary.bookmarks', JSON.stringify(['ai']));
  window.history.replaceState(null, '', '/#/terms/api');
  mockSearch();
  const view = render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Bookmark term' }));
  expect(JSON.parse(localStorage.getItem('techtionary.bookmarks'))).toEqual(['ai', 'api']);
  view.unmount();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Remove bookmark' }));
  expect(JSON.parse(localStorage.getItem('techtionary.bookmarks'))).toEqual(['ai']);
});

test('corrupt bookmark data can be replaced by a new save', async () => {
  localStorage.setItem('techtionary.bookmarks', '{broken');
  window.history.replaceState(null, '', '/#/terms/api');
  mockSearch();
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'Bookmark term' }));
  expect(JSON.parse(localStorage.getItem('techtionary.bookmarks'))).toEqual(['api']);
});

test('storage failure does not claim a bookmark was saved', async () => {
  window.history.replaceState(null, '', '/#/terms/api');
  mockSearch();
  const setter = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  try {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Bookmark term' }));
    expect(screen.getByRole('button', { name: 'Bookmark term' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(
      screen.getByText('Could not save bookmark. Browser storage is unavailable.'),
    ).toBeTruthy();
  } finally {
    setter.mockRestore();
  }
});

test('bookmarks navigation lists saved terms, opens them, and removes saved entries', async () => {
  localStorage.setItem('techtionary.bookmarks', JSON.stringify(['api', 'ai']));
  mockSearch();
  render(<App />);
  await userEvent.click(screen.getByRole('link', { name: 'Bookmarks', exact: true }));
  await screen.findByRole('link', { name: term.name });
  expect(screen.getByRole('link', { name: second.name })).toBeTruthy();
  await userEvent.click(screen.getByRole('link', { name: term.name }));
  await screen.findByRole('heading', { name: term.name });
  await userEvent.click(await screen.findByRole('button', { name: 'Remove bookmark' }));
  await userEvent.click(screen.getByRole('link', { name: 'Bookmarks', exact: true }));
  await screen.findByRole('link', { name: second.name });
  expect(screen.queryByRole('link', { name: term.name })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: `Remove bookmark ${second.name}` }));
  await screen.findByText('No bookmarks yet. Save a term to find it here.');
});

test('bookmarks retain unavailable entries and allow retrying a failed load', async () => {
  localStorage.setItem('techtionary.bookmarks', JSON.stringify(['api', 'missing']));
  window.history.replaceState(null, '', '/#/bookmarks');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => ({ ok: false, status: url.endsWith('/missing') ? 404 : 503 })),
  );
  render(<App />);
  await screen.findByText('Could not load this term');
  expect(screen.getByText('Term no longer available')).toBeTruthy();
  expect(JSON.parse(localStorage.getItem('techtionary.bookmarks'))).toEqual(['api', 'missing']);
  mockSearch();
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findAllByRole('link', { name: term.name });
});

test('bookmarks page reports malformed storage without crashing', async () => {
  localStorage.setItem('techtionary.bookmarks', '{invalid');
  window.history.replaceState(null, '', '/#/bookmarks');
  render(<App />);
  await screen.findByText('Bookmarks could not be read from this browser.');
});

test('autocomplete pages results and reuses a previously loaded page', async () => {
  const first = Array.from({ length: 10 }, (_, index) => ({
    ...term,
    _id: `first-${index}`,
    name: `Match ${index}`,
  }));
  const last = [{ ...second, name: 'Match last' }];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const page = new URL(url, 'http://localhost').searchParams.get('page');
      return {
        ok: true,
        json: async () => ({ terms: page === '2' ? last : first, hasMore: page !== '2' }),
      };
    }),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'match');
  await screen.findByRole('option', { name: /Match 0/ });
  expect(screen.getAllByRole('option')).toHaveLength(10);
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  await screen.findByRole('option', { name: /Match last/ });
  expect(screen.getByLabelText('Page 2').textContent).toBe('2');
  expect(document.activeElement).toBe(screen.getByRole('combobox'));
  expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Previous page' }));
  await screen.findByRole('option', { name: /Match 0/ });
  expect(fetch).toHaveBeenCalledTimes(2);
});
