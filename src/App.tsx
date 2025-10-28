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
    
    try {
      // Fetch article summary
      const article = await fetchArticleSummary(title);
      setSelectedArticle(article);
      
      // Add node to graph
      const nodeId = title.replace(/\s+/g, '_');
      addNode({
        id: nodeId,
        label: title,
        data: article,
      });
      
      setSelectedNode(nodeId);
      addToHistory(nodeId);
      
      // Fetch and add linked articles
      const links = await fetchArticleLinks(title);
      
      for (const link of links) {
        const linkNodeId = link.title.replace(/\s+/g, '_');
        
        // Add linked node
        addNode({
          id: linkNodeId,
          label: link.title,
          data: {
            title: link.title,
            extract: '',
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(link.title)}`,
          },
        });
        
        // Add edge
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
  }, [addNode, addEdge, setSelectedNode, addToHistory]);
  
  const handleNodeClick = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      loadArticle(node.label);
    }
  }, [nodes, loadArticle]);
  
  const handleNodeRightClick = useCallback((nodeId: string, x: number, y: number) => {
    // TODO: Show context menu
    console.log('Right click on node:', nodeId, 'at', x, y);
  }, []);
  
  const handleSearch = useCallback((query: string) => {
    // Clear existing graph on new search
    clearGraph();
    loadArticle(query);
  }, [clearGraph, loadArticle]);
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Explore Wiki
          </h1>
          <div className="flex-1 max-w-2xl">
            <SearchBar onSearch={handleSearch} />
          </div>
          <div className="text-sm text-gray-500">
            {nodes.length} nodes • {edges.length} connections
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1">
          <GraphCanvas
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
          />
        </div>
        <Sidebar selectedArticle={selectedArticle} isLoading={isLoading} />
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