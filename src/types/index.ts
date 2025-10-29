export interface WikiArticle {
  title: string;
  extract: string;
  thumbnail?: string;
  url: string;
}

export interface WikiLink {
  title: string;
  score: number;
}

// UPDATED: Now includes the graph connection count
export interface WikiLinkSignals {
  title: string;
  pageviews: number;
  backlinks: number;
  extract: string;
  graphConnections: number; // <-- ADDED
}

export interface GraphNode {
  id: string;
  label: string;
  data: WikiArticle;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: string | null;
  history: string[];
}