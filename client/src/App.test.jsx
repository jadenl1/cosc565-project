// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

const term = { _id: 'api', name: 'Application Programming Interface', aliases: ['API'], definition: 'A software interface.' };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mockSearch(terms = [term]) {
  return vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ terms, hasMore: false }) })));
}

test('debounces suggestions and supports keyboard selection', async () => {
  mockSearch();
  const user = userEvent.setup();
  render(<App />);
  const input = screen.getByRole('combobox', { name: 'Search terms and aliases' });
  await user.type(input, 'api');
  expect(fetch).not.toHaveBeenCalled();
  await screen.findByRole('option');
  expect(fetch).toHaveBeenCalledTimes(1);
  await user.keyboard('{ArrowDown}{Enter}');
  await screen.findByRole('heading', { name: 'Results for “Application Programming Interface”' });
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.getByText(term.definition)).toBeTruthy();
});

test('submits searches with the Search button and shows empty results', async () => {
  mockSearch([]);
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'unknown');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByRole('heading', { name: 'No terms found for “unknown”' });
});

test('supports clicking a suggestion', async () => {
  mockSearch();
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'api');
  await user.click(await screen.findByRole('option'));
  await screen.findByText(term.definition);
});

test('rejects blank searches and allows retry after a service failure', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(screen.getByText('Enter a term or alias to search.')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
  await user.type(screen.getByRole('combobox'), 'api');
  await user.keyboard('{Enter}');
  await screen.findByText('Search is temporarily unavailable. Please try again.');
  mockSearch();
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText(term.definition);
});

test('ignores stale results when the query changes', async () => {
  let resolve;
  vi.stubGlobal('fetch', vi.fn(() => new Promise((done) => { resolve = done; })));
  const user = userEvent.setup();
  render(<App />);
  await user.type(screen.getByRole('combobox'), 'api{Enter}');
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await user.clear(screen.getByRole('combobox'));
  resolve({ ok: true, json: async () => ({ terms: [term], hasMore: false }) });
  await waitFor(() => expect(screen.queryByText('Searching…')).toBeNull());
  expect(screen.queryByText(term.definition)).toBeNull();
});
