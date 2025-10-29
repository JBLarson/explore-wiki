import type { WikiArticle, WikiLink, WikiLinkSignals } from '../types';

// --- API Endpoints ---
const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1';
const WIKI_ACTION_API = 'https://en.wikipedia.org/w/api.php';
const WIKI_PAGEVIEWS_API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article';

// --- Ranking Configuration ---
const LINKS_TO_RETURN = 7;

// NEW 4-SIGNAL WEIGHTS: Graph connection is the most important signal
const W_GRAPH_CONNS = 0.4;  // 40% (New)
const W_SIMILARITY = 0.3;   // 30%
const W_BACKLINKS = 0.2;    // 20%
const W_PAGEVIEWS = 0.1;    // 10%

// NEW: Global maximums for robust, non-batch normalization
// (Based on rough 2024 numbers for highly-linked pages like "United States" or "World War II")
const GLOBAL_MAX_BACKLINKS = 3_000_000;
const GLOBAL_MAX_PAGEVIEWS = 50_000_000; // (Monthly)

// Simple list of "stop words"
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'such', 'also', 'which', 'may', 'see', 'use',
  'many', 'can', 'often', 'used', 'known', 'more', 'other', 'some', 'these'
]);

/**
 * Fetches the summary for a single Wikipedia article.
 */
export async function fetchArticleSummary(title: string): Promise<WikiArticle> {
  const url = `${WIKI_API_BASE}/page/summary/${encodeURIComponent(title)}`;
  const response = await fetch(url, { headers: { 'User-Agent': 'WikiExplorer/1.0 (Educational project)' } });
  if (!response.ok) throw new Error(`Failed to fetch article: ${response.statusText}`);
  const data = await response.json();
  return {
    title: data.title,
    extract: data.extract,
    thumbnail: data.thumbnail?.source,
    url: data.content_urls.desktop.page,
  };
}

/**
 * Orchestrator function to fetch, filter, and rank links for a given article.
 * NOW ACCEPTS existingNodeLabels.
 */
export async function fetchArticleLinks(title: string, existingNodeLabels: string[]): Promise<WikiLink[]> {
  // 1. Get source extract and intro links in parallel
  const [sourceArticle, introLinks] = await Promise.all([
    fetchArticleSummary(title),
    fetchIntroLinks(title)
  ]);
  const sourceExtract = sourceArticle.extract;
  
  // 2. Apply aggressive pre-filters
  const filteredLinks = introLinks
    .filter(linkTitle => !isMetaPage(linkTitle) && linkTitle !== title)
    .filter((value, index, self) => self.indexOf(value) === index);
  
  if (filteredLinks.length === 0) return [];
  
  // 3. Fetch all signals, now including graph connections
  const linksWithSignals = await fetchLinkSignals(
    filteredLinks,
    existingNodeLabels.filter(label => label !== title) // Don't count self
  );
  
  // 4. Apply the weighted ranking algorithm
  const rankedLinks = rankLinks(linksWithSignals, sourceExtract, existingNodeLabels.length);
  
  // 5. Return the top N links
  return rankedLinks.slice(0, LINKS_TO_RETURN);
}

/**
 * Fetches all links from the introduction (section 0) of a page.
 */
async function fetchIntroLinks(title: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'parse', page: title, prop: 'links', section: '0',
    format: 'json', origin: '*',
  });
  try {
    const response = await fetch(`${WIKI_ACTION_API}?${params}`);
    const data = await response.json();
    if (data.parse?.links) {
      return data.parse.links
        .filter((link: any) => link.ns === 0)
        .map((link: any) => link['*']);
    }
  } catch (error) { console.error('Failed to fetch intro links:', error); }
  return [];
}

/**
 * Takes a list of article titles and fetches all signals for them.
 */
async function fetchLinkSignals(titles: string[], existingNodeLabels: string[]): Promise<WikiLinkSignals[]> {
  try {
    // Fetch all signals concurrently
    const [pageviewsMap, backlinksMap, extractsMap, graphConnectionsMap] = await Promise.all([
      fetchPageviews(titles),
      fetchBacklinks(titles),
      fetchExtracts(titles),
      fetchGraphConnections(titles, existingNodeLabels),
    ]);
    
    // Combine signals into one object per title
    return titles.map(title => ({
      title: title,
      pageviews: pageviewsMap.get(title) || 0,
      backlinks: backlinksMap.get(title) || 0,
      extract: extractsMap.get(title) || "",
      graphConnections: graphConnectionsMap.get(title) || 0,
    })).filter(link => link.extract); // Ensure we have an extract to compare
  
  } catch (error) {
    console.error("Error fetching link signals:", error);
    return [];
  }
}

/**
 * NEW: Checks which candidate links are also linked to by existing graph nodes.
 * Returns a Map<candidateTitle, connection_count>.
 */
async function fetchGraphConnections(
  candidateTitles: string[],
  existingNodeLabels: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>(candidateTitles.map(t => [t, 0]));
  
  // If there are no other nodes on the graph, skip this
  if (existingNodeLabels.length === 0) {
    return results;
  }
  
  // We check what the *existing nodes* link to.
  // We can batch query all existing nodes at once (up to 50)
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'links',
    titles: existingNodeLabels.slice(0, 50).join('|'),
    pllimit: 'max', // Get all links from these pages
    plnamespace: '0', // Main namespace only
    origin: '*',
  });

  try {
    const response = await fetch(`${WIKI_ACTION_API}?${params}`);
    const data = await response.json();
    
    if (data.query?.pages) {
      // Check each page's links individually for a more accurate count
      for (const page of Object.values(data.query.pages) as any[]) {
        if (page.links) {
          const pageLinks = new Set(page.links.map((l: any) => l.title));
          for (const candidate of candidateTitles) {
            if (pageLinks.has(candidate)) {
              results.set(candidate, (results.get(candidate) || 0) + 1);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch graph connections:', error);
  }
  return results;
}


/**
 * Fetches pageviews for a list of articles for the last 30 days.
 * Returns a Map<title, view_count>.
 */
async function fetchPageviews(titles: string[]): Promise<Map<string, number>> {
  // Get YYYYMMDD for 30 days ago and yesterday
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // Yesterday
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 31); // 30 days ago
  
  const YYYYMMDD = (date: Date) => date.toISOString().split('T')[0].replace(/-/g, '');
  
  const results = new Map<string, number>();
  
  // Run requests in parallel
  const promises = titles.map(async (title) => {
    const encodedTitle = encodeURIComponent(title.replace(/ /g, '_')); // Wiki titles use underscores
    
    // --- THIS IS THE FIX ---
    // Changed 'monthly' to 'daily' to match the 30-day date range
    const url = `${WIKI_PAGEVIEWS_API}/en.wikipedia/all-access/all-agents/${encodedTitle}/daily/${YYYYMMDD(startDate)}/${YYYYMMDD(endDate)}`;
    // --- END OF FIX ---

    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'WikiExplorer/1.0' }});
      if (!res.ok) {
        // Log the error but don't stop the other requests
        console.warn(`Failed to fetch pageviews for ${title}: ${res.statusText}`);
        return;
      }
      const data = await res.json();
      if (data.items) {
        // Sum up the views for each day
        const totalViews = data.items.reduce((sum: number, item: any) => sum + item.views, 0);
        results.set(title, totalViews);
      }
    } catch (e) {
      console.warn(`Failed to fetch pageviews for ${title}:`, e);
    }
  });
  
  await Promise.all(promises);
  return results;
}

/**
 * Fetches backlink counts (linkshere) for a list of articles.
 * Returns a Map<title, backlink_count>.
 */
async function fetchBacklinks(titles: string[]): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const titlesBatch = titles.slice(0, 50); 
  const params = new URLSearchParams({
    action: 'query', format: 'json', prop: 'linkshere',
    titles: titlesBatch.join('|'),
    lhprop: 'total', lhnamespace: '0', lhlimit: '1', origin: '*',
  });
  try {
    const response = await fetch(`${WIKI_ACTION_API}?${params}`);
    const data = await response.json();
    if (data.query?.pages) {
      for (const page of Object.values(data.query.pages) as any[]) {
        if (page.title && page.linkshere) results.set(page.title, page.linkshere.total);
        else if (page.title) results.set(page.title, 0);
      }
    }
  } catch (error) { console.error('Failed to fetch backlinks:', error); }
  return results;
}

/**
 * Batch-fetches short text extracts (summaries) for a list of articles.
 * Returns a Map<title, extract_text>.
 */
async function fetchExtracts(titles: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const titlesBatch = titles.slice(0, 50); // Action API limit
  
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    prop: 'extracts',
    exintro: 'true', // Only the intro
    explaintext: 'true', // Plain text, no HTML
    exsentences: '2', // Keep it short and high-signal
    titles: titlesBatch.join('|'),
    origin: '*',
  });

  try {
    const response = await fetch(`${WIKI_ACTION_API}?${params}`);
    const data = await response.json();
    
    if (data.query?.pages) {
      for (const page of Object.values(data.query.pages) as any[]) {
        if (page.title && page.extract) {
          results.set(page.title, page.extract);
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch extracts:', error);
  }
  return results;
}


// --- Similarity Calculation Logic ---

/**
 * Simple text pre-processing: lowercase, remove punctuation, split, remove stop words.
 */
function preprocess(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Calculates Term Frequency (TF) for a single document.
 * Returns a Map<token, frequency>.
 */
function calculateTf(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const tokenCount = tokens.length;
  if (tokenCount === 0) return tf;
  for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
  for (const [token, count] of tf.entries()) tf.set(token, count / tokenCount);
  return tf;
}

/**
 * Calculates Inverse Document Frequency (IDF) for a corpus.
 * Returns a Map<token, idf_score>.
 */
function calculateIdf(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const docCount = documents.length;
  const docFrequency = new Map<string, number>();
  for (const doc of documents) {
    const uniqueTokens = new Set(doc);
    for (const token of uniqueTokens) docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
  }
  for (const [token, count] of docFrequency.entries()) idf.set(token, Math.log(docCount / (1 + count)) + 1); // Use log smoothing
  return idf;
}

/**
 * Calculates the cosine similarity between two TF-IDF vectors (represented as Maps).
 */
function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0, magA = 0, magB = 0;
  const allTokens = new Set([...vecA.keys(), ...vecB.keys()]);
  for (const token of allTokens) {
    const valA = vecA.get(token) || 0, valB = vecB.get(token) || 0;
    dotProduct += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }
  magA = Math.sqrt(magA); magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0; // Avoid division by zero
  return dotProduct / (magA * magB);
}

/**
 * Applies normalization and weighted scoring to a list of links with signals.
 * This is the core ranking algorithm.
 */
function rankLinks(links: WikiLinkSignals[], sourceExtract: string, numExistingNodes: number): WikiLink[] {
  if (links.length === 0) return [];

  // --- 1. Calculate Similarity Scores ---
  const sourceTokens = preprocess(sourceExtract);
  const sourceTf = calculateTf(sourceTokens);
  const candidateTokensList = links.map(link => preprocess(link.extract));
  const idf = calculateIdf(candidateTokensList);
  const candidateTfIdfVectors = candidateTokensList.map(tokens => {
    const tf = calculateTf(tokens);
    const tfIdfVector = new Map<string, number>();
    for (const token of tokens) {
      if (idf.has(token)) tfIdfVector.set(token, (tf.get(token) || 0) * (idf.get(token) || 0));
    }
    return tfIdfVector;
  });
  const sourceTfIdfVector = new Map<string, number>();
  for (const token of sourceTokens) {
    if (idf.has(token)) sourceTfIdfVector.set(token, (sourceTf.get(token) || 0) * (idf.get(token) || 0));
  }
  const similarityScores = candidateTfIdfVectors.map(vec => cosineSimilarity(sourceTfIdfVector, vec));
  
  // --- 2. Normalize all signals ---
  const maxSimilarity = Math.max(0.001, ...similarityScores);
  const maxGraphConnections = Math.max(1, numExistingNodes); // Normalize against total possible connections

  const scoredLinks = links.map((link, index) => {
    // **Global Logarithmic Normalization**
    const normPageviews = Math.log1p(link.pageviews) / Math.log1p(GLOBAL_MAX_PAGEVIEWS);
    const normBacklinks = Math.log1p(link.backlinks) / Math.log1p(GLOBAL_MAX_BACKLINKS);
    
    // Linear normalization for batch-dependent signals
    const normSimilarity = similarityScores[index] / maxSimilarity;
    const normGraphConnections = link.graphConnections / maxGraphConnections;
    
    // --- 3. Calculate final weighted score ---
    const score = 
      (normGraphConnections * W_GRAPH_CONNS) +
      (normSimilarity * W_SIMILARITY) +
      (normBacklinks * W_BACKLINKS) +
      (normPageviews * W_PAGEVIEWS);
    
    return {
      title: link.title,
      score: score * 100, // Scale to 0-100
    };
  });
  
  // Sort by score, descending
  return scoredLinks.sort((a, b) => b.score - a.score);
}


/**
 * Aggressively filters out meta-pages, lists, timelines, etc.
 */
function isMetaPage(title: string): boolean {
  const metaPrefixes = [
    'Wikipedia:', 'Help:', 'Template:', 'Category:', 'Portal:', 'File:',
    'Special:', 'Talk:', 'User:', 'Book:', 'Draft:', 'Module:', 'MediaWiki:',
  ];
  const lowercaseTitle = title.toLowerCase();
  const badPatterns = [
    'disambiguation', 'list of', 'index of', 'glossary of', 'outline of',
    'timeline', 'chronology', 'comparison of', 'history of', 'bibliography',
    'career', 'early life', 'personal life',
  ];
  const parenMatch = title.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const parenText = parenMatch[1].toLowerCase();
    const allowedParens = ['physics', 'mathematics', 'chemistry', 'biology', 'philosophy', 'concept', 'theory'];
    if (!allowedParens.some(allowed => parenText.includes(allowed))) return true;
  }
  return (
    metaPrefixes.some(prefix => title.startsWith(prefix)) ||
    badPatterns.some(pattern => lowercaseTitle.includes(pattern)) ||
    /\b(19|20)\d{2}\b/.test(title)
  );
}