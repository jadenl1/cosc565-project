import express from 'express';

export function createApp(repository) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/terms', async (req, res) => {
    const { q, suggest, page: pageInput } = req.query;
    if (
      typeof q !== 'string' ||
      !q.trim() ||
      q.trim().length > 120 ||
      /[\u0000-\u001f\u007f]/u.test(q)
    ) {
      return res.status(400).json({ error: 'Enter a search term between 1 and 120 characters.' });
    }
    const page = pageInput === undefined ? 1 : Number(pageInput);
    if (
      typeof pageInput === 'object' ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 10000 ||
      (pageInput !== undefined && !/^[1-9]\d*$/.test(pageInput))
    ) {
      return res.status(400).json({ error: 'Enter a valid page number.' });
    }
    try {
      const limit = suggest === 'true' ? 10 : 50;
      const terms = await repository.search(q.trim(), limit + 1, (page - 1) * limit);
      res.json({ terms: terms.slice(0, limit), hasMore: terms.length > limit, page });
    } catch {
      res.status(503).json({ error: 'Search is temporarily unavailable. Please try again.' });
    }
  });

  app.get('/api/terms/:id', async (req, res) => {
    try {
      const term = await repository.findById(req.params.id);
      if (!term) return res.status(404).json({ error: 'Term not found.' });
      res.json({ term });
    } catch {
      res.status(503).json({ error: 'Definition is temporarily unavailable. Please try again.' });
    }
  });

  return app;
}
