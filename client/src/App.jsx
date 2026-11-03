import React, { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiArrowUpRight, FiBookOpen, FiBookmark, FiLink, FiExternalLink, FiX, FiCornerDownLeft, FiSearch } from 'react-icons/fi';

async function searchTerms(query, signal) {
  const response = await fetch(`/api/terms?${new URLSearchParams({ q: query, suggest: true })}`, { signal });
  if (!response.ok) throw new Error('Search is temporarily unavailable. Please try again.');
  return response.json();
}

function Search({ onChoose }) {
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
    return () => { clearTimeout(timer); controller.abort(); };
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
      setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length);
    }
  }

  const expanded = open && suggestions.length > 0;
  return (
    <section className="search-page" inert={leaving}>
      <h1>Buzzword Techtionary</h1>
      <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="sr-only" htmlFor="search">Search terms and aliases</label>
        <div className="search-box">
          <FiSearch className="search-icon" aria-hidden="true" />
          <input ref={input} id="search" role="combobox" aria-autocomplete="list"
            aria-expanded={expanded} aria-controls={expanded ? 'suggestions' : undefined}
            aria-activedescendant={expanded ? `suggestion-${active}` : undefined}
            autoComplete="off" maxLength={120} placeholder="Search a term…" value={query}
            onFocus={() => setOpen(true)} onBlur={() => { if (!leaving) setOpen(false); }} onKeyDown={onKeyDown}
            onChange={(event) => changeQuery(event.target.value)} />
          <button className="icon-button" type="submit" aria-label="Open first or selected match"><FiCornerDownLeft aria-hidden="true" /></button>
          {open && (suggestions.length > 0 || message) && <div className="suggestion-panel">
            {expanded && <ul id="suggestions" role="listbox" aria-label="Matching terms">
              {suggestions.map((term, index) => <li key={term._id} id={`suggestion-${index}`} role="option" style={{ '--reveal-delay': `${index * 25}ms` }}
                aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(term)}>
                <span>{term.name}<small>{term.aliases.join(' · ')}</small></span>
                <FiArrowUpRight aria-hidden="true" />
              </li>)}
            </ul>}
            {message && <p role="status">{message}</p>}
          </div>}
        </div>
        {!query && <div className="try-terms">
          {['API', 'Machine Learning', 'JavaScript'].map((value) => <button key={value} type="button"
            onClick={() => { changeQuery(value); input.current.focus(); }}>
            {value}<FiArrowUpRight aria-hidden="true" />
          </button>)}
        </div>}
      </form>
    </section>
  );
}

const bookmarkKey = 'techtionary.bookmarks';
function readBookmarks() {
  const saved = JSON.parse(localStorage.getItem(bookmarkKey) || '[]');
  return Array.isArray(saved) ? [...new Set(saved.filter((id) => typeof id === 'string' && id))] : [];
}

function Bookmark({ id }) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    function sync() {
      try { setSaved(readBookmarks().includes(id)); setError(''); }
      catch { setError('Bookmarks are unavailable in this browser.'); }
    }
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('bookmarks-changed', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('bookmarks-changed', sync); };
  }, [id]);
  function toggle() {
    try {
      let bookmarks;
      try { bookmarks = readBookmarks(); }
      catch (error) { if (error instanceof SyntaxError) bookmarks = []; else throw error; }
      const exists = bookmarks.includes(id);
      localStorage.setItem(bookmarkKey, JSON.stringify(exists ? bookmarks.filter((value) => value !== id) : [...bookmarks, id]));
      window.dispatchEvent(new Event('bookmarks-changed'));
      setSaved(!exists);
      setError('');
    } catch { setError('Could not save bookmark. Browser storage is unavailable.'); }
  }
  return <div className="bookmark-control">
    <button className="bookmark-button" onClick={toggle} aria-pressed={saved} aria-label={saved ? 'Remove bookmark' : 'Bookmark term'}>
      <FiBookmark aria-hidden="true" /> {saved ? 'Saved' : 'Save'}
    </button>
    {error && <p role="status" className="bookmark-error">{error}</p>}
  </div>;
}

function Bookmarks() {
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
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(exitTimer.current); }, []);
  function dismissToast() {
    clearTimeout(timer.current);
    setToastClosing(true);
    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => { setRemoved(null); setToastClosing(false); }, 200);
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
    } catch { setRemoveError('Could not remove bookmark.'); }
  }
  function undo() {
    try {
      const ids = readBookmarks();
      if (!ids.includes(removed.id)) ids.splice(Math.min(removed.index, ids.length), 0, removed.id);
      localStorage.setItem(bookmarkKey, JSON.stringify(ids));
      dismissToast();
      setRemoveError('');
      window.dispatchEvent(new Event('bookmarks-changed'));
    } catch { setRemoveError('Could not restore bookmark.'); }
  }
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('storage', refresh);
    window.addEventListener('bookmarks-changed', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('bookmarks-changed', refresh); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const ids = readBookmarks();
        setMessage(ids.length ? 'Loading bookmarks…' : 'No bookmarks yet. Save a term to find it here.');
        const results = [];
        // Bound concurrent requests while reusing the term endpoint.
        for (let start = 0; start < ids.length; start += 8) {
          if (controller.signal.aborted) return;
          results.push(...await Promise.all(ids.slice(start, start + 8).map(async (id) => {
            try {
              const response = await fetch(`/api/terms/${encodeURIComponent(id)}`, { signal: controller.signal });
              if (response.status === 404) return { _id: id, name: 'Term no longer available', unavailable: true };
              if (!response.ok) throw new Error('Request failed');
              return (await response.json()).term;
            } catch { return { _id: id, name: 'Could not load this term', unavailable: true, retryable: true }; }
          })));
        }
        if (!controller.signal.aborted) { setEntries(results); if (ids.length) setMessage(''); }
      } catch {
        if (!controller.signal.aborted) { setEntries([]); setMessage('Bookmarks could not be read from this browser.'); }
      }
    }
    load();
    return () => controller.abort();
  }, [revision]);
  const filtered = entries.filter((term) => `${term.name} ${term.definition || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pageCount = Math.ceil(filtered.length / 10);
  const visible = filtered.slice((page - 1) * 10, page * 10);
  return <section className="definition-page bookmarks-page">
    <a className="back-link" href="#/"><FiArrowLeft aria-hidden="true" /> Back to search</a>
    <h1 ref={heading} tabIndex={-1}>Bookmarks</h1>
    {!message && entries.length > 0 && <form className="bookmark-search" onSubmit={(event) => event.preventDefault()}>
      <label className="sr-only" htmlFor="bookmark-search">Search bookmarks</label>
      <FiSearch aria-hidden="true" />
      <input id="bookmark-search" type="search" placeholder="Search bookmarks…" value={query}
        onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
    </form>}
    {message && <p role="status">{message}</p>}
    {!message && entries.length > 0 && filtered.length === 0 && <p role="status">No bookmarks match “{query}”.</p>}
    {!message && <ul className="bookmark-list">{visible.map((term) => <li key={term._id}>
      <div>{term.unavailable ? <p>{term.name}</p> : <>
        <a href={`#/terms/${encodeURIComponent(term._id)}`}>{term.name}<FiArrowUpRight aria-hidden="true" /></a>
        <p>{term.definition}</p>
      </>}{term.retryable && <button className="retry" onClick={() => setRevision((value) => value + 1)}>Retry</button>}</div>
      <button className="bookmark-remove" aria-label={`Remove bookmark ${term.name}`} onClick={() => remove(term)}><FiX aria-hidden="true" /> Remove</button>
    </li>)}</ul>}
    {removeError && <p role="alert">{removeError}</p>}
    {removed && <div className={`bookmark-toast${toastClosing ? ' is-closing' : ''}`} role="status" key={removed.token}><span>Bookmark removed</span><button onClick={undo} disabled={toastClosing}>Undo</button><button className="toast-dismiss" onClick={dismissToast} aria-label="Dismiss notification"><FiX aria-hidden="true" /></button><div className="bookmark-timer" aria-hidden="true" /></div>}
    {pageCount > 1 && <nav className="bookmark-pagination" aria-label="Bookmark pages">
      <button className="retry" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
      <span aria-live="polite">Page {page} of {pageCount}</span>
      <button className="retry" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
    </nav>}
  </section>;
}

const mapCategories = [
  ['Security', /secur|crypt|auth|encrypt|decrypt|cipher|attack|forgery|script(ing)?$|credential|signature|hash|denial|cors|policy|origin|immutable|mutable/i],
  ['Web & interfaces', /html|css|dom|browser|web|element|attribute|accessib|aria|responsive|viewport|render|hydration|cookie|api|rest|http|uri|url|document/i],
  ['Networking', /network|tcp|udp|dns|domain|packet|bandwidth|latency|cdn|tls|ip address|socket/i],
  ['Data & storage', /database|sql|data|array|object|json|serializ|cache|buffer|encoding|unicode|utf|base64|byte|string/i],
  ['Programming', /algorithm|function|argument|parameter|scope|closure|class|constructor|inherit|compil|interpre|variable|constant|type|recursion|promise|async|thread|exception|flow|boolean|primitive|javascript|ecmascript|garbage|memory|method|return|property|code|git|version|minif|debounce|throttle/i],
  ['AI & learning', /artificial intelligence|machine learning|neural|model|training/i],
];
function categoryFor(term) {
  if (typeof term.category === 'string' && term.category.trim()) return term.category.trim();
  const name = [term.name, ...(term.aliases || [])].join(' ');
  return mapCategories.find(([, pattern]) => pattern.test(name))?.[0] || 'Other';
}

function TermMap() {
  const [terms, setTerms] = useState([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(null);
  const [lines, setLines] = useState([]);
  const mapRef = useRef(null);
  const [status, setStatus] = useState('Loading terms…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setStatus('Loading terms…');
    fetch('/api/term-map', { signal: controller.signal }).then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then((data) => { if (!controller.signal.aborted) { setTerms(data.terms); setStatus(''); } })
      .catch(() => { if (!controller.signal.aborted) setStatus('Could not load the map.'); });
    return () => controller.abort();
  }, [attempt]);
  const needle = query.trim().toLowerCase();
  const matches = (term) => needle && [term.name, ...(term.aliases || [])].some((value) => value.toLowerCase().includes(needle));
  const groups = new Map();
  for (const term of terms) {
    const category = categoryFor(term);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(term);
  }
  const count = terms.filter(matches).length;
  const activeTerm = terms.find((term) => term._id === active);
  const connectedIds = new Set((activeTerm?.relatedTerms || []).map(String));
  useEffect(() => {
    function updateLines() {
      const map = mapRef.current;
      if (!map || !active) { setLines([]); return; }
      const selected = terms.find((term) => term._id === active);
      const nodes = [...map.querySelectorAll('[data-term-id]')];
      const origin = nodes.find((node) => node.dataset.termId === active);
      if (!origin || !selected) { setLines([]); return; }
      const bounds = map.getBoundingClientRect();
      const center = (node) => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top }; };
      const from = center(origin);
      const related = new Set((selected.relatedTerms || []).map(String));
      setLines(nodes.filter((node) => related.has(node.dataset.termId)).map((node) => ({ id: node.dataset.termId, from, to: center(node) })));
    }
    updateLines();
    window.addEventListener('resize', updateLines);
    return () => window.removeEventListener('resize', updateLines);
  }, [active, terms, query]);
  return <section className="map-page">
    <a className="back-link" href="#/"><FiArrowLeft aria-hidden="true" /> Back to search</a>
    <h1>Explore the map</h1>
    <p className="map-caption">Hover or focus a term to see its connections.</p>
    <div className="search-box map-search"><FiSearch className="search-icon" aria-hidden="true" />
      <label className="sr-only" htmlFor="map-search">Search the map</label>
      <input id="map-search" type="search" placeholder="Find a term…" value={query} onChange={(event) => setQuery(event.target.value)} />
    </div>
    {needle && !status && <p className="map-count" role="status">{count ? `${count} matching ${count === 1 ? 'term' : 'terms'} highlighted` : 'No matching terms.'}</p>}
    {status ? <div role="status"><p>{status}</p>{status !== 'Loading terms…' && <button className="retry" onClick={() => setAttempt((value) => value + 1)}>Retry</button>}</div> :
      <div ref={mapRef} className={`term-map${needle ? ' is-searching' : ''}${active ? ' has-active' : ''}`} onPointerLeave={() => setActive(null)}><svg className="map-connections" aria-hidden="true">{lines.map((line) => <line key={line.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />)}</svg>
        {[...groups].sort(([a], [b]) => a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)).map(([category, entries]) => <section className="map-category" key={category}>
          <h2>{category}<span>{entries.length}</span></h2>
          <ul>{entries.map((term) => <li key={term._id}><a data-term-id={term._id} className={[matches(term) && 'is-match', active && (term._id === active || connectedIds.has(String(term._id))) && 'is-connected'].filter(Boolean).join(' ')} onPointerEnter={() => setActive(term._id)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(term._id)} onBlur={() => setActive(null)} href={`#/terms/${encodeURIComponent(term._id)}`}>
            {term.name}<FiArrowUpRight aria-hidden="true" />
          </a></li>)}</ul>
        </section>)}
        {!terms.length && <p>No terms available yet.</p>}
      </div>}
  </section>;
}

function Definition({ id }) {
  const [term, setTerm] = useState(null);
  const [message, setMessage] = useState('Loading definition…');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setTerm(null);
    setMessage('Loading definition…');
    async function load() {
      try {
        const response = await fetch(`/api/terms/${encodeURIComponent(id)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 404 ? 'Term not found.' : 'Could not load definition.');
        const data = await response.json();
        if (!controller.signal.aborted) { setTerm(data.term); setMessage(''); }
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error.message);
      }
    }
    load();
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => { if (term) heading.current?.focus(); }, [term]);

  return (
    <article className="definition-page">
      <a className="back-link" href="#/"><FiArrowLeft aria-hidden="true" /> Back to search</a>
      {term ? <>
        <div className="term-toolbar"><Bookmark id={id} /></div>
        <div className="term-heading">
          <h1 ref={heading} tabIndex={-1}>{term.name}</h1>
          {(term.aliases || []).length > 0 && <ul className="alias-tags" aria-label="Aliases">
            {term.aliases.map((alias) => <li key={alias}>{alias}</li>)}
          </ul>}
        </div>
        <section className="definition-section" aria-labelledby="definition-heading">
          <h2 id="definition-heading"><FiBookOpen aria-hidden="true" /> Definition</h2>
          <p className="definition">{term.definition || 'No definition available yet.'}</p>
        </section>
        <section className="definition-section" aria-labelledby="related-heading">
          <h2 id="related-heading"><FiLink aria-hidden="true" /> Related terms</h2>
          {term.relatedTerms?.length ? <ul className="related-terms">
            {term.relatedTerms.map((related) => <li key={related._id}><a href={`#/terms/${encodeURIComponent(related._id)}`}>
              {related.name}<FiArrowUpRight aria-hidden="true" />
            </a></li>)}
          </ul> : <p className="empty-detail">No related terms yet.</p>}
        </section>
        <section className="definition-section" aria-labelledby="references-heading">
          <h2 id="references-heading"><FiExternalLink aria-hidden="true" /> References</h2>
          {term.references?.length ? <ul className="reference-links">
            {term.references.map((reference, index) => <li key={`${reference.url}-${index}`}><a href={reference.url} target="_blank" rel="noopener noreferrer">
              {reference.title || reference.url}<FiArrowUpRight aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
            </a></li>)}
          </ul> : <p className="empty-detail">No references available yet.</p>}
        </section>
      </> : <div role="status"><p>{message}</p>{message !== 'Loading definition…' && <button className="retry" onClick={() => setAttempt((value) => value + 1)}>Retry</button>}</div>}
    </article>
  );
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const page = useRef(null);
  const exitAnimation = useRef(null);

  async function openDefinition(term) {
    if (exitAnimation.current) return;
    if (page.current.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const elements = page.current.querySelectorAll('.brand-mark, .search-page h1, .search-box, .try-terms');
      const animations = [...elements].map((element, index) => element.animate([
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-12px)' },
      ], { duration: 220, delay: index * 60, easing: 'ease-in', fill: 'forwards' }));
      exitAnimation.current = { cancel: () => animations.forEach((animation) => animation.cancel()) };
      try { await Promise.all(animations.map((animation) => animation.finished)); } catch { return; }
    }
    window.location.hash = `/terms/${term._id}`;
  }

  useEffect(() => {
    exitAnimation.current?.cancel();
    exitAnimation.current = null;
  }, [route]);

  useEffect(() => () => exitAnimation.current?.cancel(), []);
  useEffect(() => {
    const onRouteChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onRouteChange);
    return () => window.removeEventListener('hashchange', onRouteChange);
  }, []);
  const match = route.match(/^#\/terms\/([^/]+)$/);
  return (
    <main ref={page}>
      <header className="site-header">
        <a className="brand-mark" href="#/" aria-label="Buzzword Techtionary home">[b]</a>
        <nav className="main-nav" aria-label="Main navigation"><a className="bookmarks-link" href="#/map" aria-current={route === '#/map' ? 'page' : undefined}>Explore</a><a className="bookmarks-link" href="#/bookmarks" aria-current={route === '#/bookmarks' ? 'page' : undefined}><FiBookmark aria-hidden="true" /> Bookmarks</a></nav>
      </header>
      {match ? <Definition key={match[1]} id={match[1]} /> : route === '#/bookmarks' ? <Bookmarks /> : route === '#/map' ? <TermMap /> : <Search onChoose={openDefinition} />}
    </main>
  );
}
