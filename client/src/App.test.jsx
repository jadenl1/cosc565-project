// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

const term = { _id: 'api', name: 'Application Programming Interface', aliases: ['API'], definition: 'A software interface.' };
const second = { _id: 'ai', name: 'Artificial Intelligence', aliases: ['AI'], definition: 'Learning and reasoning.' };
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function mockSearch(terms = [term]) {
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => url.startsWith('/api/terms?') ? { terms } : { term: url.endsWith('/ai') ? second : term },
  })));
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
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  await user.keyboard('{Enter}');
  await screen.findByText('Search is temporarily unavailable. Please try again.');
  mockSearch();
  await user.keyboard('{Enter}');
  await screen.findByText(term.definition);
});

test('ignores stale responses after the query is cleared', async () => {
  let resolve;
  vi.stubGlobal('fetch', vi.fn(() => new Promise((done) => { resolve = done; })));
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
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
  render(<App />);
  await screen.findByText('Term not found.');
  expect(screen.getByRole('link', { name: 'Back to search' })).toBeTruthy();
});

test('waits for the exit animation before opening a definition', async () => {
  mockSearch();
  let finish;
  const animation = { finished: new Promise((resolve) => { finish = resolve; }), cancel: vi.fn() };
  const original = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = vi.fn(() => animation);
  try {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByRole('combobox'), 'api');
    await user.click(await screen.findByRole('option'));
    expect(window.location.hash).toBe('');
    expect(HTMLElement.prototype.animate.mock.calls.map(([, options]) => options.delay)).toEqual([0, 60, 120]);
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
