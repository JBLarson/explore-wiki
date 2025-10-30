import { useGraphStore } from '../stores/graphStore';
import type { WikiArticle } from '../types';

interface SidebarProps {
  selectedArticle: WikiArticle | null;
  isLoading: boolean;
}

// New component for the loading state
function SkeletonLoader() {
  return (
    <div className="p-5 animate-pulse space-y-4">
      <div className="h-6 bg-gray-200 rounded-md w-3/4"></div>
      <div className="h-40 bg-gray-200 rounded-lg w-full"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded-md w-full"></div>
        <div className="h-4 bg-gray-200 rounded-md w-full"></div>
        <div className="h-4 bg-gray-200 rounded-md w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded-md w-1/2"></div>
      </div>
      <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
    </div>
  );
}

// New component for the empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-fadeIn">
      <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.055 11H5a7 7 0 0114 0h1.945"></path>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 21.944V19a7 7 0 010-14v-2.944"></path>
      </svg>
      <h3 className="text-lg font-semibold text-text mb-1">Start Exploring</h3>
      <p className="text-sm text-text-light">
        Search for a topic to begin your journey. Click any node to expand the graph.
      </p>
    </div>
  );
}

export function Sidebar({ selectedArticle, isLoading }: SidebarProps) {
  const { nodes, edges } = useGraphStore();
  
  return (
    <div className="w-80 h-full bg-bg border-l border-border flex flex-col">
      {/* Article Info Section */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <SkeletonLoader />
        ) : selectedArticle ? (
          <div className="p-5 animate-fadeIn space-y-4">
            {/* Title */}
            <h2 className="text-xl font-bold text-text">{selectedArticle.title}</h2>
            
            {/* Thumbnail */}
            {selectedArticle.thumbnail && (
              <img 
                src={selectedArticle.thumbnail} 
                alt={selectedArticle.title} 
                className="w-full h-auto rounded-lg border border-border object-cover" 
              />
            )}
            
            {/* Extract */}
            <p className="text-sm text-text-light leading-relaxed">
              {selectedArticle.extract}
            </p>
            
            {/* Action Button */}
            <a 
              href={selectedArticle.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg
                         hover:bg-primary-700 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              Read Full Article
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
      
      {/* Stats Footer Section */}
      <div className="flex-shrink-0 border-t border-border p-4 bg-bg-subtle">
        <h3 className="text-sm font-semibold text-text mb-3">Graph Stats</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-light">Nodes</dt>
            <dd className="font-medium text-text">{nodes.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-light">Edges</dt>
            <dd className="font-medium text-text">{edges.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}