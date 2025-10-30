import type { WikiArticle, WikiLink } from '../types';

// API Endpoints
const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1';
const WIKI_ACTION_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_PAGEVIEWS_API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article';

// Configuration
const LINKS_TO_RETURN = 7;
const MAX_CANDIDATES = 30;

// Scoring weights
const WEIGHTS = {
  graphConnection: 0.40,
  textRelevance: 0.30,
  popularity: 0.20,
  linkPosition: 0.10
};

/**
 * Fetches article summary
 */
export async function fetchArticleSummary(title: string): Promise<WikiArticle> {
  const url = `${WIKI_API_BASE}/page/summary/${encodeURIComponent(title)}`;
  const response = await fetch(url, { 
    headers: { 'User-Agent': 'WikiExplorer/1.0' } 
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

/**
 * Main function - fetches and ranks related articles
 */
export async function fetchArticleLinks(
  title: string, 
  existingNodeLabels: string[]
): Promise<WikiLink[]> {
  try {
    // Get source content and links
    const [sourceExtract, candidates] = await Promise.all([
      getArticleExtract(title),
      getArticleLinks(title)
    ]);

    // Filter candidates
    const filtered = candidates
      .filter((link: any) => !isMetaPage(link.title))
      .filter((link: any) => link.title !== title)
      .filter((link: any) => !existingNodeLabels.includes(link.title))
      .slice(0, MAX_CANDIDATES);

    if (filtered.length === 0) return [];

    // Score each candidate
    const scored = await scoreLinks(filtered, sourceExtract, existingNodeLabels);
    
    // Return top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, LINKS_TO_RETURN);
    
  } catch (error) {
    console.error('Error fetching links:', error);
    return [];
  }
}

/**
 * Get article extract for comparison
 */
async function getArticleExtract(title: string): Promise<string> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    titles: title,
    exintro: 'true',
    explaintext: 'true',
    format: 'json',
    origin: '*'
  });

  const res = await fetch(`${WIKI_ACTION_API}?${params}`);
  const data = await res.json();
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0] as any;
  return page?.extract || '';
}

/**
 * Get links from article with position info
 */
async function getArticleLinks(title: string): Promise<any[]> {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'links',
    section: '0',
    format: 'json',
    origin: '*'
  });

  const res = await fetch(`${WIKI_ACTION_API}?${params}`);
  const data = await res.json();
  
  if (!data.parse?.links) return [];

  return data.parse.links
    .filter((link: any) => link.ns === 0)
    .map((link: any, index: number) => ({
      title: link['*'],
      position: index
    }));
}

/**
 * Score links based on multiple factors
 */
async function scoreLinks(
  candidates: any[],
  sourceExtract: string,
  existingNodes: string[]
): Promise<WikiLink[]> {
  const titles = candidates.map(c => c.title);
  
  // Batch fetch data
  const [extracts, pageviews, connections] = await Promise.all([
    batchFetchExtracts(titles),
    batchFetchPageviews(titles),
    batchCheckConnections(titles, existingNodes)
  ]);

  return candidates.map(candidate => {
    const title = candidate.title;
    
    // Calculate individual scores
    const scores = {
      graphConnection: connections.get(title) || 0,
      textRelevance: calculateSimilarity(
        sourceExtract,
        extracts.get(title) || ''
      ),
      popularity: normalizePageviews(pageviews.get(title) || 0),
      linkPosition: 1 - (candidate.position / candidates.length)
    };

    // Calculate weighted total
    const total = Object.entries(scores).reduce(
      (sum, [key, value]) => sum + (value * WEIGHTS[key as keyof typeof WEIGHTS]),
      0
    );

    return {
      title,
      score: Math.round(total * 100)
    };
  });
}

/**
 * Batch fetch article extracts
 */
async function batchFetchExtracts(titles: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const batches = [];
  
  for (let i = 0; i < titles.length; i += 20) {
    batches.push(titles.slice(i, i + 20));
  }

  await Promise.all(
    batches.map(async batch => {
      const params = new URLSearchParams({
        action: 'query',
        prop: 'extracts',
        titles: batch.join('|'),
        exintro: 'true',
        explaintext: 'true',
        exsentences: '3',
        format: 'json',
        origin: '*'
      });

      try {
        const res = await fetch(`${WIKI_ACTION_API}?${params}`);
        const data = await res.json();
        
        if (data.query?.pages) {
          Object.values(data.query.pages).forEach((page: any) => {
            results.set(page.title, page.extract || '');
          });
        }
      } catch (e) {
        console.error('Extract fetch error:', e);
      }
    })
  );

  return results;
}

/**
 * Batch fetch pageviews
 */
async function batchFetchPageviews(titles: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 31);
  
  const format = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
  
  await Promise.all(
    titles.map(async title => {
      const encoded = encodeURIComponent(title.replace(/ /g, '_'));
      const url = `${WIKI_PAGEVIEWS_API}/en.wikipedia/all-access/all-agents/${encoded}/daily/${format(startDate)}/${format(endDate)}`;
      
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const total = data.items?.reduce((sum: number, item: any) => sum + item.views, 0) || 0;
          results.set(title, total);
        }
      } catch (e) {
        results.set(title, 0);
      }
    })
  );

  return results;
}

/**
 * Check connections to existing graph
 */
async function batchCheckConnections(
  candidates: string[],
  existingNodes: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  if (existingNodes.length === 0) {
    candidates.forEach(c => results.set(c, 0));
    return results;
  }

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'links',
    titles: existingNodes.slice(0, 50).join('|'),
    pllimit: 'max',
    plnamespace: '0',
    origin: '*'
  });

  try {
    const res = await fetch(`${WIKI_ACTION_API}?${params}`);
    const data = await res.json();
    
    // Count connections for each candidate
    const connectionCounts = new Map<string, number>();
    
    if (data.query?.pages) {
      Object.values(data.query.pages).forEach((page: any) => {
        if (page.links) {
          page.links.forEach((link: any) => {
            const title = link.title;
            if (candidates.includes(title)) {
              connectionCounts.set(title, (connectionCounts.get(title) || 0) + 1);
            }
          });
        }
      });
    }

    // Normalize scores
    candidates.forEach(candidate => {
      const count = connectionCounts.get(candidate) || 0;
      results.set(candidate, Math.min(1, count / Math.max(1, existingNodes.length * 0.3)));
    });
    
  } catch (e) {
    console.error('Connection check error:', e);
    candidates.forEach(c => results.set(c, 0));
  }

  return results;
}

/**
 * Calculate text similarity (simplified)
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = new Set(text1.toLowerCase().match(/\b\w{4,}\b/g) || []);
  const words2 = new Set(text2.toLowerCase().match(/\b\w{4,}\b/g) || []);
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Normalize pageviews
 */
function normalizePageviews(views: number): number {
  const MAX_VIEWS = 100000;
  return Math.min(1, Math.log10(views + 1) / Math.log10(MAX_VIEWS));
}

/**
 * Filter meta pages
 */
function isMetaPage(title: string): boolean {
  const lower = title.toLowerCase();
  
  const metaPrefixes = [
    'wikipedia:', 'template:', 'category:', 'portal:',
    'help:', 'user:', 'talk:', 'file:'
  ];
  
  if (metaPrefixes.some(p => lower.startsWith(p))) return true;
  
  const patterns = [
    'list of', 'timeline of', 'outline of', 'index of',
    'comparison of', 'history of', 'bibliography'
  ];
  
  if (patterns.some(p => lower.includes(p))) return true;
  if (title.includes('(disambiguation)')) return true;
  if (/^\d{3,4}s?$/.test(title)) return true;
  
  return false;
}