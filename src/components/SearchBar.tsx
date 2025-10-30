import { useState, useRef, useEffect } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = 'Search Wikipedia...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 pl-10 pr-16 py-2 bg-bg-subtle border border-border-dark rounded-lg text-text
                   placeholder-text-subtle transition-colors
                   focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-bg focus:border-primary-500"
      />

      {/* More elegant '/' shortcut hint */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <kbd className="px-2 py-1 text-xs font-sans font-medium text-text-subtle bg-bg-muted border border-border-dark rounded-md">
          /
        </kbd>
      </div>
    </form>
  );
}