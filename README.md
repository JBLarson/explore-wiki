# wikiExplorer 

A desktop-first web application for exploring Wikipedia as a radial tree / interactive knowledge graph.

## What it does

Search for any Wikipedia article and visualize its connections as an interactive graph. Click on nodes to explore related concepts and discover how topics connect.

## Tech Stack

- React 18 + TypeScript
- Cytoscape.js for graph visualization
- Zustand for state management
- TanStack Query for API caching
- Tailwind CSS for styling
- Vite for development
- Wikipedia API (free, no key required)


## Features

- Desktop-optimized interface
- Circular node visualization with smart overlap prevention
- Aggressive relevance filtering to show only core concepts
- Smooth physics-based graph layout
- Hover effects and connection highlighting
- Sidebar with article previews and statistics

## Inspiration

Inspired by [WikiNodes](https://en.wikipedia.org/wiki/WikiNodes) a Wikipedia graph visualization app that was available on iPad in the early 2010s. That app offered a beautiful way to explore knowledge visually, but has since disappeared from the app store.

This is a modern, open-source, desktop-first recreation of that concept.

Special thanks to the original WikiNodes developers for pioneering this approach to knowledge exploration.
