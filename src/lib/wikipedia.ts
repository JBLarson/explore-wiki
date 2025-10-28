import type { WikiArticle, WikiLink } from '../types';

const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1';
const WIKI_ACTION_API = 'https://en.wikipedia.org/w/api.php';

export async function fetchArticleSummary(title: string): Promise<WikiArticle> {
  const url = `${WIKI_API_BASE}/page/summary/${encodeURIComponent(title)}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'WikiExplorer/1.0 (Educational project)',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    title: data.title,
    extract: data.extract,
    thumbnail: data.thumbnail?.source,
    url: data.content_urls.desktop.page,
  };
}

export async function fetchArticleLinks(title: string): Promise<WikiLink[]> {
  const params = new URLSearchParams({
    action: 'query',
    titles: title,
    prop: 'links',
    pllimit: '100',
    format: 'json',
    origin: '*',
  });
  
  const url = `${WIKI_ACTION_API}?${params}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  const pages = data.query.pages;
  const pageId = Object.keys(pages)[0];
  const links = pages[pageId]?.links || [];
  
  // Filter out meta pages and rank by simple heuristics
  const filteredLinks = links
    .filter((link: any) => !isMetaPage(link.title))
    .map((link: any) => ({
      title: link.title,
      score: calculateLinkScore(link.title),
    }))
    .sort((a: WikiLink, b: WikiLink) => b.score - a.score)
    .slice(0, 15); // Top 15 most relevant
  
  return filteredLinks;
}

function isMetaPage(title: string): boolean {
  const metaPrefixes = [
    'Wikipedia:',
    'Help:',
    'Template:',
    'Category:',
    'Portal:',
    'File:',
    'Special:',
  ];
  
  return metaPrefixes.some(prefix => title.startsWith(prefix));
}

function calculateLinkScore(title: string): number {
  // Simple scoring: shorter titles and common words score higher
  // In a real implementation, you'd use more sophisticated ranking
  let score = 100;
  
  // Penalize very long titles
  if (title.length > 30) score -= 20;
  if (title.length > 50) score -= 30;
  
  // Bonus for titles with common knowledge indicators
  if (title.includes('theory') || title.includes('law')) score += 10;
  
  // Penalize disambiguation pages
  if (title.includes('(disambiguation)')) score -= 50;
  
  return Math.max(0, score);
}