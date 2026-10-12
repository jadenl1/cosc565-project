import React, { useEffect, useRef, useState } from 'react';

async function searchTerms(query, signal, suggest = false) {
  const response = await fetch(`/api/terms?${new URLSearchParams({ q: query, suggest })}`, { signal });
  if (!response.ok) throw new Error('Search is temporarily unavailable. Please try again.');
  return response.json();
}

export default function App() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [submitted, setSubmitted] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [suggestionError, setSuggestionError] = useState('');
  const request = useRef(null);
  const revision = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const version = revision.current;
    setSuggestions([]);
    setActive(-1);
    setSuggestionError('');
    if (!query.trim() || !open) return;
    const timer = setTimeout(async () => {
      try {
        const data = await searchTerms(query.trim(), controller.signal, true);
        if (!controller.signal.aborted && version === revision.current) setSuggestions(data.terms);
      } catch (error) {
        if (error.name !== 'AbortError' && version === revision.current) setSuggestionError(error.message);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open]);

  useEffect(() => () => request.current?.abort(), []);

  async function submit(value) {
    request.current?.abort();
    const version = ++revision.current;
    setOpen(false);
    setSuggestions([]);
    setSuggestionError('');
    setError('');
    setResults(null);
    if (!value.trim()) {
      setStatus('');
      setError('Enter a term or alias to search.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setSubmitted(value.trim());
    setStatus('Searching…');
    try {
      const data = await searchTerms(value.trim(), controller.signal);
      if (version === revision.current) { setResults(data); setStatus(''); }
    } catch (error) {
      if (error.name !== 'AbortError' && version === revision.current) { setError(error.message); setStatus(''); }
    }
  }

  function choose(term) {
    setQuery(term.name);
    submit(term.name);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') { setOpen(false); setActive(-1); }
    if (open && suggestions.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setActive((index) => event.key === 'ArrowDown'
        ? (index + 1) % suggestions.length
        : (index <= 0 ? suggestions.length - 1 : index - 1));
    }
    if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    }
  }

  const expanded = open && suggestions.length > 0;
  return (
    <main>
      <header><p className="eyebrow">YOUR COMPUTER SCIENCE COMPANION</p><h1>Buzzword Techtionary</h1><p>Find the meaning behind the buzzword.</p></header>
      <form onSubmit={(event) => { event.preventDefault(); submit(query); }}>
        <label htmlFor="search">Search terms and aliases</label>
        <div className="search-row">
          <div className="search-field">
            <input id="search" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
              aria-controls={expanded ? 'suggestions' : undefined}
              aria-activedescendant={expanded && active >= 0 ? `suggestion-${active}` : undefined}
              autoComplete="off" maxLength={120} placeholder="Try API, database, or machine learning"
              value={query} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown}
              onChange={(event) => { revision.current++; request.current?.abort(); setStatus(''); setError(''); setResults(null); setQuery(event.target.value); setOpen(true); setActive(-1); setSuggestions([]); }} />
            {expanded && <ul id="suggestions" role="listbox" aria-label="Matching terms">
              {suggestions.map((term, index) => <li key={term._id} id={`suggestion-${index}`} role="option"
                aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(term)}>
                <strong>{term.name}</strong><span>{term.aliases.join(', ')}</span>
              </li>)}
            </ul>}
          </div>
          <button type="submit">Search</button>
        </div>
        <p className="hint">Search by the beginning of a term or alias.</p>
      </form>
      <div aria-live="polite" role="status">
        {status && <p>{status}</p>}
        {suggestionError && <p>{suggestionError}</p>}
        {error && <p className="error">{error}</p>}
        {results && <section aria-label="Search results">
          <h2>{results.terms.length ? `Results for “${submitted}”` : `No terms found for “${submitted}”`}</h2>
          {!results.terms.length && <p>Try another term or alias.</p>}
          {results.hasMore && <p>Showing the first 50 matches. Refine your search to see more.</p>}
          <ul className="results">{results.terms.map((term) => <li key={term._id}>
            <h3>{term.name}</h3><p className="aliases">{term.aliases.join(' · ')}</p><p>{term.definition}</p>
          </li>)}</ul>
        </section>}
      </div>
    </main>
  );
}

