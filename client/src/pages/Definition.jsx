import React, { useEffect, useRef, useState } from 'react';
import { FiArrowLeft, FiArrowUpRight, FiBookOpen, FiExternalLink, FiLink } from 'react-icons/fi';
import Bookmark from '../components/Bookmark.jsx';

export default function Definition({ id }) {
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
        const response = await fetch(`/api/terms/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 404 ? 'Term not found.' : 'Could not load definition.',
          );
        const data = await response.json();
        if (!controller.signal.aborted) {
          setTerm(data.term);
          setMessage('');
        }
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error.message);
      }
    }
    load();
    return () => controller.abort();
  }, [id, attempt]);

  useEffect(() => {
    if (term) heading.current?.focus();
  }, [term]);

  return (
    <article className="definition-page">
      <a className="back-link" href="#/">
        <FiArrowLeft aria-hidden="true" /> Back to search
      </a>
      {term ? (
        <>
          <div className="term-toolbar">
            <Bookmark id={id} />
          </div>
          <div className="term-heading">
            <h1 ref={heading} tabIndex={-1}>
              {term.name}
            </h1>
            {(term.aliases || []).length > 0 && (
              <ul className="alias-tags" aria-label="Aliases">
                {term.aliases.map((alias) => (
                  <li key={alias}>{alias}</li>
                ))}
              </ul>
            )}
          </div>
          <section className="definition-section" aria-labelledby="definition-heading">
            <h2 id="definition-heading">
              <FiBookOpen aria-hidden="true" /> Definition
            </h2>
            <p className="definition">{term.definition || 'No definition available yet.'}</p>
          </section>
          <section className="definition-section" aria-labelledby="related-heading">
            <h2 id="related-heading">
              <FiLink aria-hidden="true" /> Related terms
            </h2>
            {term.relatedTerms?.length ? (
              <ul className="related-terms">
                {term.relatedTerms.map((related) => (
                  <li key={related._id}>
                    <a href={`#/terms/${encodeURIComponent(related._id)}`}>
                      {related.name}
                      <FiArrowUpRight aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-detail">No related terms yet.</p>
            )}
          </section>
          <section className="definition-section" aria-labelledby="references-heading">
            <h2 id="references-heading">
              <FiExternalLink aria-hidden="true" /> References
            </h2>
            {term.references?.length ? (
              <ul className="reference-links">
                {term.references.map((reference, index) => (
                  <li key={`${reference.url}-${index}`}>
                    <a href={reference.url} target="_blank" rel="noopener noreferrer">
                      {reference.title || reference.url}
                      <FiArrowUpRight aria-hidden="true" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-detail">No references available yet.</p>
            )}
          </section>
        </>
      ) : (
        <div role="status">
          <p>{message}</p>
          {message !== 'Loading definition…' && (
            <button className="retry" onClick={() => setAttempt((value) => value + 1)}>
              Retry
            </button>
          )}
        </div>
      )}
    </article>
  );
}
