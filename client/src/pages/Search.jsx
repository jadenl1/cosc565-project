import React, { useEffect, useRef, useState } from 'react';
import { FiArrowUpRight, FiCornerDownLeft, FiSearch } from 'react-icons/fi';

async function searchTerms(query, signal) {
  const response = await fetch(`/api/terms?${new URLSearchParams({ q: query, suggest: true })}`, {
    signal,
  });
  if (!response.ok) throw new Error('Search is temporarily unavailable. Please try again.');
  return response.json();
}

export default function Search({ onChoose }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [leaving, setLeaving] = useState(false);
  const request = useRef(null);
  const revision = useRef(0);
  const input = useRef(null);

  useEffect(() => {
    if (!query.trim() || !open || leaving) return;
    const controller = new AbortController();
    const version = revision.current;
    const timer = setTimeout(async () => {
      setMessage('Searching…');
      try {
        const data = await searchTerms(query.trim(), controller.signal);
        if (!controller.signal.aborted && version === revision.current) {
          setSuggestions(data.terms);
          setMessage(data.terms.length ? '' : 'No matching terms.');
        }
      } catch (error) {
        if (!controller.signal.aborted && version === revision.current) setMessage(error.message);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, leaving]);

  useEffect(() => () => request.current?.abort(), []);

  function choose(term) {
    if (leaving) return;
    revision.current++;
    request.current?.abort();
    setLeaving(true);
    onChoose(term);
  }

  function changeQuery(value) {
    revision.current++;
    request.current?.abort();
    setQuery(value);
    setSuggestions([]);
    setActive(0);
    setMessage('');
    setOpen(true);
  }

  async function submit() {
    if (!query.trim()) return;
    if (suggestions.length) return choose(suggestions[active] || suggestions[0]);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const version = ++revision.current;
    setOpen(true);
    setMessage('Searching…');
    try {
      const data = await searchTerms(query.trim(), controller.signal);
      if (controller.signal.aborted || version !== revision.current) return;
      if (data.terms.length) choose(data.terms[0]);
      else setMessage('No matching terms.');
    } catch (error) {
      if (!controller.signal.aborted && version === revision.current) setMessage(error.message);
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      revision.current++;
      request.current?.abort();
      setOpen(false);
      setActive(0);
    }
    if (suggestions.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setActive(
        (index) =>
          (index + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length,
      );
    }
  }

  const expanded = open && suggestions.length > 0;
  return (
    <section className="search-page" inert={leaving}>
      <h1>Buzzword Techtionary</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="search">
          Search terms and aliases
        </label>
        <div className="search-box">
          <FiSearch className="search-icon" aria-hidden="true" />
          <input
            ref={input}
            id="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={expanded ? 'suggestions' : undefined}
            aria-activedescendant={expanded ? `suggestion-${active}` : undefined}
            autoComplete="off"
            maxLength={120}
            placeholder="Search a term…"
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              if (!leaving) setOpen(false);
            }}
            onKeyDown={onKeyDown}
            onChange={(event) => changeQuery(event.target.value)}
          />
          <button className="icon-button" type="submit" aria-label="Open first or selected match">
            <FiCornerDownLeft aria-hidden="true" />
          </button>
          {open && (suggestions.length > 0 || message) && (
            <div className="suggestion-panel">
              {expanded && (
                <ul id="suggestions" role="listbox" aria-label="Matching terms">
                  {suggestions.map((term, index) => (
                    <li
                      key={term._id}
                      id={`suggestion-${index}`}
                      role="option"
                      style={{ '--reveal-delay': `${index * 25}ms` }}
                      aria-selected={index === active}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(term)}
                    >
                      <span>
                        {term.name}
                        <small>{term.aliases.join(' · ')}</small>
                      </span>
                      <FiArrowUpRight aria-hidden="true" />
                    </li>
                  ))}
                </ul>
              )}
              {message && <p role="status">{message}</p>}
            </div>
          )}
        </div>
        {!query && (
          <div className="try-terms">
            {['API', 'Machine Learning', 'JavaScript'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  changeQuery(value);
                  input.current.focus();
                }}
              >
                {value}
                <FiArrowUpRight aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </form>
    </section>
  );
}
