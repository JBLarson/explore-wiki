import type { WikiArticle, WikiLink } from '../types';

const WIKI_API_BASE = 'https://en.wikipedia.org/api/rest_v1';
const LOCAL_API = 'http://localhost:5001/api';  // Your Python backend

/**
 * Fetches article summary from Wikipedia
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
 * Fetches semantically related articles using vector embeddings
 */
export async function fetchArticleLinks(
  title: string, 
  existingNodeLabels: string[]
): Promise<WikiLink[]> {
  try {
    // Normalize title: capitalize first letter, replace spaces with underscores
    const normalizedTitle = title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('_');
    
    const response = await fetch(`${LOCAL_API}/related/${encodeURIComponent(normalizedTitle)}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch related articles for ${title}`);
      return [];
    }
    
    const related: WikiLink[] = await response.json();
    
    return related.filter(link => !existingNodeLabels.includes(link.title));
    
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}