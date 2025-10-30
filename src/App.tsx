import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GraphCanvas } from './components/GraphCanvas';
import { SearchBar } from './components/SearchBar';
import { Sidebar } from './components/SideBar';
import { useGraphStore } from './stores/graphStore';
import { fetchArticleSummary, fetchArticleLinks } from './lib/wikipedia';
import type { WikiArticle } from './types';

const queryClient = new QueryClient();

function AppContent() {
  const { nodes, edges, addNode, addEdge, setSelectedNode, addToHistory, clearGraph } = useGraphStore();
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadArticle = useCallback(async (title: string) => {
    setIsLoading(true);
    setSelectedArticle(null); // Clear previous article to show loading
    
    const existingNodeLabels = nodes.map(n => n.label);
    
    try {
      const article = await fetchArticleSummary(title);
      setSelectedArticle(article);
      
      const nodeId = title.replace(/\s+/g, '_');
      addNode({
        id: nodeId,
        label: title,
        data: article,
      });
      
      setSelectedNode(nodeId);
      addToHistory(nodeId);
      
      const links = await fetchArticleLinks(title, existingNodeLabels);
      
      for (const link of links) {
        const linkNodeId = link.title.replace(/\s+/g, '_');
        
        addNode({
          id: linkNodeId,
          label: link.title,
          data: {
            title: link.title,
            extract: '',
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title)}`,
          },
        });
        
        addEdge({
          id: `${nodeId}-${linkNodeId}`,
          source: nodeId,
          target: linkNodeId,
        });
      }
    } catch (error) {
      console.error('Error loading article:', error);
      alert('Failed to load article. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [nodes, addNode, addEdge, setSelectedNode, addToHistory]);
  
  const handleNodeClick = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const hasChildren = edges.some(e => e.source === nodeId);
      
      // Always show info on click
      setIsLoading(true);
      setSelectedArticle(null);
      fetchArticleSummary(node.label)
        .then(setSelectedArticle)
        .finally(() => setIsLoading(false));
      setSelectedNode(nodeId);

      // Only load new nodes if they don't exist
      if (!hasChildren) {
        loadArticle(node.label);
      }
    }
  }, [nodes, edges, loadArticle, setSelectedNode]);
  
  const handleNodeRightClick = useCallback((nodeId: string, x: number, y: number) => {
    console.log('Right click on node:', nodeId, 'at', x, y);
    // Future: Context Menu
  }, []);
  
  const handleSearch = useCallback((query: string) => {
    clearGraph();
    setSelectedArticle(null);
    loadArticle(query);
  }, [clearGraph, loadArticle]);
  
  return (
    <div className="flex flex-col h-screen bg-bg-muted font-sans">
      {/* --- Redesigned Header --- */}
      <header className="flex-shrink-0 bg-bg z-10">
        <div className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border">
          {/* Logo/Title (subtle) */}
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <h1 className="text-lg font-semibold text-text hidden md:block">
              Explore Wiki
            </h1>
          </div>
          
          {/* Centered Search Bar */}
          <div className="flex-1 flex justify-center px-4">
            <div className="w-full max-w-lg">
              <SearchBar onSearch={handleSearch} />
            </div>
          </div>

          {/* Graph Stats (subtle) */}
          <div className="text-sm text-text-light text-right min-w-[100px] hidden sm:block">
            <span className="font-medium text-text">{nodes.length}</span> nodes
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <GraphCanvas
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
          />
        </div>
        {/* Sidebar now has a subtle shadow for depth */}
        <div className="shadow-lg z-10">
          <Sidebar selectedArticle={selectedArticle} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}