# US-02 term import

122 candidate terms allow the importer to skip existing names and aliases while adding exactly 100 entries. Definitions are AI-written; reference URLs were checked against official documentation. The application continues to read from Atlas.

Each line in `us02-terms.txt` contains `name|comma-separated aliases|MDN glossary slug or URL|comma-separated related names|definition`.

```sh
node scripts/import-us02-terms.js --check-references
node --env-file=.env scripts/import-us02-terms.js          # Preview against Atlas
node --env-file=.env scripts/import-us02-terms.js --apply  # Import 100 terms
```

The import preserves existing documents, writes the batch in one transaction, and verifies the saved count and related IDs. New documents use `relatedTerms` (ObjectId array), `references` (title, URL, check date), `origin: 'ai-generated'`, and timestamps. Repeating a completed batch makes no changes.

Fill missing related terms and references on the original 10 entries:

```sh
node --env-file=.env scripts/complete-term-details.js          # Preview
node --env-file=.env scripts/complete-term-details.js --apply  # Fill missing fields
```

This checks reference pages before writing and reports coverage and dangling links across the entire collection.
