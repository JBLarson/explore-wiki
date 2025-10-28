import { create } from 'zustand';
import type { GraphState, GraphNode, GraphEdge } from '../types';

interface GraphStore extends GraphState {
  addNode: (node: GraphNode) => void;
  addEdge: (edge: GraphEdge) => void;
  setSelectedNode: (nodeId: string | null) => void;
  addToHistory: (nodeId: string) => void;
  clearGraph: () => void;
  removeNode: (nodeId: string) => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNode: null,
  history: [],
  
  addNode: (node) =>
    set((state) => {
      // Don't add duplicates
      if (state.nodes.some(n => n.id === node.id)) {
        return state;
      }
      return { nodes: [...state.nodes, node] };
    }),
  
  addEdge: (edge) =>
    set((state) => {
      // Don't add duplicate edges
      if (state.edges.some(e => e.id === edge.id)) {
        return state;
      }
      return { edges: [...state.edges, edge] };
    }),
  
  setSelectedNode: (nodeId) =>
    set({ selectedNode: nodeId }),
  
  addToHistory: (nodeId) =>
    set((state) => ({
      history: [...state.history, nodeId],
    })),
  
  clearGraph: () =>
    set({
      nodes: [],
      edges: [],
      selectedNode: null,
      history: [],
    }),
  
  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter(n => n.id !== nodeId),
      edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      selectedNode: state.selectedNode === nodeId ? null : state.selectedNode,
    })),
}));