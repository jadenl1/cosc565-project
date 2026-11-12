import React, { useEffect, useRef, useState } from 'react';
import { FiBookmark } from 'react-icons/fi';
import Bookmarks from './pages/Bookmarks.jsx';
import Definition from './pages/Definition.jsx';
import Search from './pages/Search.jsx';

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const page = useRef(null);
  const exitAnimation = useRef(null);

  async function openDefinition(term) {
    if (exitAnimation.current) return;
    if (page.current.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const elements = page.current.querySelectorAll(
        '.brand-mark, .search-page h1, .search-box, .try-terms',
      );
      const animations = [...elements].map((element, index) =>
        element.animate(
          [
            { opacity: 1, transform: 'translateY(0)' },
            { opacity: 0, transform: 'translateY(-12px)' },
          ],
          { duration: 220, delay: index * 60, easing: 'ease-in', fill: 'forwards' },
        ),
      );
      exitAnimation.current = {
        cancel: () => animations.forEach((animation) => animation.cancel()),
      };
      try {
        await Promise.all(animations.map((animation) => animation.finished));
      } catch {
        return;
      }
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
        <a className="brand-mark" href="#/" aria-label="Buzzword Techtionary home">
          [b]
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a
            className="bookmarks-link"
            href="#/bookmarks"
            aria-current={route === '#/bookmarks' ? 'page' : undefined}
          >
            <FiBookmark aria-hidden="true" /> Bookmarks
          </a>
        </nav>
      </header>
      {match ? (
        <Definition key={match[1]} id={match[1]} />
      ) : route === '#/bookmarks' ? (
        <Bookmarks />
      ) : (
        <Search onChoose={openDefinition} />
      )}
    </main>
  );
}
