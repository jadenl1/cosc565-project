import React, { useEffect, useState } from 'react';
import { FiBookmark } from 'react-icons/fi';
import { bookmarkKey, readBookmarks } from '../lib/bookmarks.js';

export default function Bookmark({ id }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    function sync() {
      try {
        setSaved(readBookmarks().includes(id));
        setError('');
      } catch {
        setError('Bookmarks are unavailable in this browser.');
      }
    }
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('bookmarks-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('bookmarks-changed', sync);
    };
  }, [id]);
  function toggle() {
    try {
      let bookmarks;
      try {
        bookmarks = readBookmarks();
      } catch (error) {
        if (error instanceof SyntaxError) bookmarks = [];
        else throw error;
      }
      const exists = bookmarks.includes(id);
      localStorage.setItem(
        bookmarkKey,
        JSON.stringify(exists ? bookmarks.filter((value) => value !== id) : [...bookmarks, id]),
      );
      window.dispatchEvent(new Event('bookmarks-changed'));
      setSaved(!exists);
      setError('');
    } catch {
      setError('Could not save bookmark. Browser storage is unavailable.');
    }
  }
  return (
    <div className="bookmark-control">
      <button
        className="bookmark-button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={saved ? 'Remove bookmark' : 'Bookmark term'}
      >
        <FiBookmark aria-hidden="true" /> {saved ? 'Saved' : 'Save'}
      </button>
      {error && (
        <p role="status" className="bookmark-error">
          {error}
        </p>
      )}
    </div>
  );
}
