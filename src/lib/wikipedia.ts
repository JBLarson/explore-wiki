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
  // Only use intro links - most curated and relevant
  const introLinks = await fetchIntroLinks(title);
  
  // Aggressively filter and score
  const rankedLinks = introLinks
    .filter(link => !isMetaPage(link) && link !== title)
    .map(linkTitle => ({
      title: linkTitle,
      score: calculateRelevanceScore(linkTitle, title),
    }))
    .filter(link => link.score > 50) // AGGRESSIVE: Only keep high-scoring links
    .sort((a, b) => b.score - a.score)
    .slice(0, 7); // LIMIT TO 7 NODES
  
  return rankedLinks;
}

async function fetchIntroLinks(title: string): Promise<string[]> {
  // Get links from just the introduction section
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'links',
    section: '0', // Introduction only
    format: 'json',
    origin: '*',
  });
  
  try {
    const response = await fetch(`${WIKI_ACTION_API}?${params}`);
    const data = await response.json();
    
    if (data.parse?.links) {
      return data.parse.links
        .filter((link: any) => link.ns === 0) // Main namespace only
        .map((link: any) => link['*'])
        .slice(0, 30); // Get first 30 from intro
    }
  } catch (error) {
    console.error('Failed to fetch intro links:', error);
  }
  
  return [];
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
    'Talk:',
    'User:',
    'Book:',
    'Draft:',
    'Module:',
    'MediaWiki:',
  ];
  
  const lowercaseTitle = title.toLowerCase();
  
  // AGGRESSIVE: Reject more types of pages
  const badPatterns = [
    'disambiguation',
    'list of',
    'index of',
    'glossary of',
    'outline of',
    'timeline',
    'chronology',
    'comparison of',
    'history of',
  ];
  
  return (
    metaPrefixes.some(prefix => title.startsWith(prefix)) ||
    badPatterns.some(pattern => lowercaseTitle.includes(pattern))
  );
}

function calculateRelevanceScore(linkTitle: string, sourceTitle: string): number {
  let score = 100; // Start high, subtract for bad signals
  const lower = linkTitle.toLowerCase();
  
  // AGGRESSIVE LENGTH PENALTIES
  if (linkTitle.length > 40) {
    score -= 60; // Very long = too specific
  } else if (linkTitle.length > 30) {
    score -= 30;
  } else if (linkTitle.length > 25) {
    score -= 15;
  } else if (linkTitle.length < 15) {
    score += 20; // Short = probably fundamental
  }
  
  // BOOST: Core academic/scientific terms
  const highValueTerms = [
    'theory',
    'principle',
    'law',
    'physics',
    'mathematics',
    'chemistry',
    'biology',
    'philosophy',
    'science',
    'mechanics',
    'field',
    'force',
    'energy',
    'matter',
    'wave',
    'particle',
    'system',
  ];
  
  let hasHighValueTerm = false;
  for (const term of highValueTerms) {
    if (lower.includes(term)) {
      score += 40;
      hasHighValueTerm = true;
      break;
    }
  }
  
  // AGGRESSIVE PENALTIES: Overly specific/irrelevant content
  const lowValueTerms = [
    'popular culture',
    'in fiction',
    'controversy',
    'criticism',
    'reception',
    'legacy',
    'influence',
    'biography',
    'career',
    'early life',
    'personal life',
    'death',
    'born',
    'died',
    'century',
    'decade',
    'year',
    'season',
    'episode',
    'volume',
    'chapter',
    'book',
    'album',
    'song',
    'film',
    'series',
  ];
  
  for (const term of lowValueTerms) {
    if (lower.includes(term)) {
      score -= 70; // Huge penalty
      break;
    }
  }
  
  // PENALTY: Years and dates (usually too specific)
  if (/\b(19|20)\d{2}\b/.test(linkTitle)) {
    score -= 50;
  }
  
  // PENALTY: Numbers in title (often specific instances)
  if (/\d/.test(linkTitle) && !hasHighValueTerm) {
    score -= 30;
  }
  
  // PENALTY: Person names (heuristic: comma, or ends with name-like pattern)
  if (linkTitle.includes(',')) {
    score -= 60; // "Last, First" format
  }
  
  // PENALTY: Parenthetical disambiguation
  if (linkTitle.includes('(') && linkTitle.includes(')')) {
    const parenthetical = linkTitle.match(/\(([^)]+)\)/)?.[1]?.toLowerCase();
    if (parenthetical) {
      // Allow some parentheticals like (physics), (mathematics)
      const allowedParens = ['physics', 'mathematics', 'chemistry', 'biology', 'philosophy'];
      if (!allowedParens.some(allowed => parenthetical.includes(allowed))) {
        score -= 40;
      }
    }
  }
  
  // PENALTY: Country/region-specific unless geography-focused
  const locationTerms = ['american', 'british', 'french', 'german', 'chinese', 'japanese', 'african', 'european', 'asian'];
  if (locationTerms.some(term => lower.includes(term)) && !lower.includes('geography')) {
    score -= 35;
  }
  
  // BOOST: Single word titles (often fundamental concepts)
  if (!linkTitle.includes(' ') && linkTitle.length > 3) {
    score += 25;
  }
  
  return score;
}