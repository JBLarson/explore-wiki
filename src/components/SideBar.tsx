import { useGraphStore } from '../stores/graphStore';
import type { WikiArticle } from '../types';

interface SidebarProps {
  selectedArticle: WikiArticle | null;
  isLoading: boolean;
}

export function Sidebar({ selectedArticle, isLoading }: SidebarProps) {
  const { history, nodes } = useGraphStore();
  
  return (
    <div className="w-80 h-full bg-white border-l border-gray-200 flex flex-col">
      <div className="border-b border-gray-200">
        <nav className="flex">
          <button className="px-4 py-3 text-sm font-medium text-blue-600 border-b-2 border-blue-600">Info</button>
          <button className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">History</button>
          <button className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">Stats</button>
        </nav>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : selectedArticle ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedArticle.title}</h2>
              {selectedArticle.thumbnail && (
                <img src={selectedArticle.thumbnail} alt={selectedArticle.title} className="w-full rounded-lg mb-3" />
              )}
              <p className="text-sm text-gray-700 leading-relaxed">{selectedArticle.extract}</p>
            </div>
            
            <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Read Full Article
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Graph Statistics</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Nodes:</dt>
                  <dd className="font-medium text-gray-900">{nodes.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Steps taken:</dt>
                  <dd className="font-medium text-gray-900">{history.length}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500">Search for an article to begin exploring</p>
          </div>
        )}
      </div>
    </div>
  );
}