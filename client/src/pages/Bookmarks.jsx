import React, { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiArrowUpRight, FiSearch, FiX } from 'react-icons/fi';
import { bookmarkKey, readBookmarks } from '../lib/bookmarks.js';

export default function Bookmarks() {
  const [entries, setEntries] = useState([]);
  const [message, setMessage] = useState('Loading bookmarks…');
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [removed, setRemoved] = useState(null);
  const [removeError, setRemoveError] = useState('');
  const [toastClosing, setToastClosing] = useState(false);
  const timer = useRef(null);
  const exitTimer = useRef(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(exitTimer.current);
    },
    [],
  );
  function dismissToast() {
    clearTimeout(timer.current);
    setToastClosing(true);
    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => {
      setRemoved(null);
      setToastClosing(false);
    }, 200);
  }
  function remove(term) {
    try {
      const ids = readBookmarks();
      const index = ids.indexOf(term._id);
      if (index < 0) return;
      localStorage.setItem(bookmarkKey, JSON.stringify(ids.filter((id) => id !== term._id)));
      clearTimeout(timer.current);
      clearTimeout(exitTimer.current);
      setToastClosing(false);
      setRemoved({ id: term._id, index, token: Date.now() });
      setRemoveError('');
      timer.current = setTimeout(dismissToast, 8000);
      setPage((value) => Math.min(value, Math.max(1, Math.ceil((filtered.length - 1) / 10))));
      window.dispatchEvent(new Event('bookmarks-changed'));
    } catch {
      setRemoveError('Could not remove bookmark.');
    }
  }
  function undo() {
    try {
      const ids = readBookmarks();
      if (!ids.includes(removed.id)) ids.splice(Math.min(removed.index, ids.length), 0, removed.id);
      localStorage.setItem(bookmarkKey, JSON.stringify(ids));
      dismissToast();
      setRemoveError('');
      window.dispatchEvent(new Event('bookmarks-changed'));
    } catch {
      setRemoveError('Could not restore bookmark.');
    }
  }
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('storage', refresh);
    window.addEventListener('bookmarks-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('bookmarks-changed', refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const ids = readBookmarks();
        setMessage(
          ids.length ? 'Loading bookmarks…' : 'No bookmarks yet. Save a term to find it here.',
        );
        const results = [];
        // Bound concurrent requests while reusing the term endpoint.
        for (let start = 0; start < ids.length; start += 8) {
          if (controller.signal.aborted) return;
          results.push(
            ...(await Promise.all(
              ids.slice(start, start + 8).map(async (id) => {
                try {
                  const response = await fetch(`/api/terms/${encodeURIComponent(id)}`, {
                    signal: controller.signal,
                  });
                  if (response.status === 404)
                    return { _id: id, name: 'Term no longer available', unavailable: true };
                  if (!response.ok) throw new Error('Request failed');
                  return (await response.json()).term;
                } catch {
                  return {
                    _id: id,
                    name: 'Could not load this term',
                    unavailable: true,
                    retryable: true,
                  };
                }
              }),
            )),
          );
        }
        if (!controller.signal.aborted) {
          setEntries(results);
          if (ids.length) setMessage('');
        }
      } catch {
        if (!controller.signal.aborted) {
          setEntries([]);
          setMessage('Bookmarks could not be read from this browser.');
        }
      }
    }
    load();
    return () => controller.abort();
  }, [revision]);
  const filtered = entries.filter((term) =>
    `${term.name} ${term.definition || ''}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pageCount = Math.ceil(filtered.length / 10);
  const visible = filtered.slice((page - 1) * 10, page * 10);
  return (
    <section className="definition-page bookmarks-page">
      <a className="back-link" href="#/">
        <FiArrowLeft aria-hidden="true" /> Back to search
      </a>
      <h1 ref={heading} tabIndex={-1}>
        Bookmarks
      </h1>
      {!message && entries.length > 0 && (
        <form className="bookmark-search" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="bookmark-search">
            Search bookmarks
          </label>
          <FiSearch aria-hidden="true" />
          <input
            id="bookmark-search"
            type="search"
            placeholder="Search bookmarks…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {!message && entries.length > 0 && filtered.length === 0 && (
        <p role="status">No bookmarks match “{query}”.</p>
      )}
      {!message && (
        <ul className="bookmark-list">
          {visible.map((term) => (
            <li key={term._id}>
              <div>
                {term.unavailable ? (
                  <p>{term.name}</p>
                ) : (
                  <>
                    <a href={`#/terms/${encodeURIComponent(term._id)}`}>
                      {term.name}
                      <FiArrowUpRight aria-hidden="true" />
                    </a>
                    <p>{term.definition}</p>
                  </>
                )}
                {term.retryable && (
                  <button className="retry" onClick={() => setRevision((value) => value + 1)}>
                    Retry
                  </button>
                )}
              </div>
              <button
                className="bookmark-remove"
                aria-label={`Remove bookmark ${term.name}`}
                onClick={() => remove(term)}
              >
                <FiX aria-hidden="true" /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {removeError && <p role="alert">{removeError}</p>}
      {removed && (
        <div
          className={`bookmark-toast${toastClosing ? ' is-closing' : ''}`}
          role="status"
          key={removed.token}
        >
          <span>Bookmark removed</span>
          <button onClick={undo} disabled={toastClosing}>
            Undo
          </button>
          <button
            className="toast-dismiss"
            onClick={dismissToast}
            aria-label="Dismiss notification"
          >
            <FiX aria-hidden="true" />
          </button>
          <div className="bookmark-timer" aria-hidden="true" />
        </div>
      )}
      {pageCount > 1 && (
        <nav className="bookmark-pagination" aria-label="Bookmark pages">
          <button
            className="retry"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span aria-live="polite">
            Page {page} of {pageCount}
          </span>
          <button
            className="retry"
            disabled={page === pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
