# Buzzword Techtionary Requirements

## Customer Statement of Requirements

I am building Buzzword Techtionary to help people quickly understand computer science terms and industry buzzwords. The application will serve everyone from beginners learning to code to experienced developers exploring unfamiliar specialties. Users will search for terms, read concise definitions, explore related concepts, and bookmark useful entries. My goal is to make keeping up with a fast-moving industry easier through a simple interface that gets users directly to the information they need.

## Requirements Specification

### Functional Requirements

- **Search:** Provide a centered search bar on the homepage. Search stored terms and aliases without case sensitivity, suggest matching terms as users type, and show results when they submit a query.
- **Term pages:** Open a term page when a user selects a result or suggestion. Display its definition, aliases, related terms, available reference links, and bookmark control.
- **Related terms:** Let users navigate directly to related entries.
- **Bookmarks:** Let users save, view, and remove bookmarks without creating an account. Keep bookmarks in the same browser across visits.
- **Missing terms:** When a valid computer science term is missing, request a concise definition through the OpenAI API. Check the response for relevance and required fields before saving it for future searches. Reject unrelated input and avoid duplicate entries.
- **Feedback:** Show clear loading, no-result, invalid-input, and service-error messages. Allow users to retry failed requests.

### Non-Functional Requirements

- **Usability:** Keep navigation straightforward and definitions brief, readable, and understandable without unnecessary jargon.
- **Accessibility:** Support keyboard navigation, labeled controls, readable contrast, and layouts that work on mobile and desktop screens.
- **Performance:** Target stored search results within two seconds under normal conditions. Debounce autocomplete requests and show a loading state during AI generation.
- **Reliability:** Keep stored definitions accessible if AI generation fails. Preserve saved entries across application restarts and back up the database regularly.
- **Security and privacy:** Validate inputs on the server, protect database credentials and API keys, use HTTPS, and limit requests to prevent abuse. Avoid collecting personal information for basic use.
- **Content quality:** Clearly label AI-generated definitions. Do not present generated references as verified sources; include only checked reference links.
- **Maintainability:** Use reusable React components, separate Express API logic from database access, and index searchable fields so the dictionary can grow without redesigning the application.

## Data and Storage Blueprint

### Data Input

- **User input:** Users manually enter search text and select bookmark controls. The React frontend sends search requests to the Node.js and Express backend.
- **Initial content:** I will prepare a reviewed JSON dataset of terms and import it into MongoDB to populate the initial dictionary.
- **Generated content:** The backend will fetch definitions for valid missing terms from the OpenAI API, validate their structure and relevance, and store successful responses. Structural validation alone does not establish factual accuracy.

### Database and Storage

- **MongoDB:** Store a document for each term containing its name, normalized search key, aliases, definition, related term references, optional reference links, content origin, and creation and update timestamps. A unique normalized key will prevent duplicate terms. MongoDB's flexible document structure fits entries with varying aliases and references.
- **Browser localStorage:** Store bookmarked term IDs locally. Bookmarks will persist in that browser but will not sync across devices and may be lost if browser data is cleared.

The initial dataset import and browser-based bookmarks are proposed implementation choices for this specification.
