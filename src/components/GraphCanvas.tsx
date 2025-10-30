import { useEffect, useRef } from 'react';
// Correct import: 'Core' is a named export, 'cytoscape' is the default.
import cytoscape, { Core } from 'cytoscape';
import { useGraphStore } from '../stores/graphStore';

interface GraphCanvasProps {
  onNodeClick: (nodeId: string) => void;
  onNodeRightClick: (nodeId: string, x: number, y: number) => void;
}

// --- FAANG-Style Cytoscape Stylesheet ---
// The correct type is 'cytoscape.StylesheetCSS[]'
const cyStyle: cytoscape.Stylesheet[] = [
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center',
      'font-family': 'Inter, sans-serif',
      'font-size': 11,
      'font-weight': 600,
      'color': '#1f2937', // text-DEFAULT
      'text-wrap': 'wrap',
      'text-max-width': 80,
      'background-color': '#ffffff', // bg-DEFAULT
      'border-width': 2,
      'border-color': '#e5e7eb', // border-DEFAULT
      'width': 90,
      'height': 90,
      'shape': 'ellipse',
      'transition-property': 'background-color, border-color, border-width',
      'transition-duration': '0.15s',
    },
  },
  {
    selector: 'node:hover',
    style: {
      'border-color': '#3b82f6', // primary-500
      'border-width': 3,
    },
  },
  {
    selector: 'node.selected',
    style: {
      'background-color': '#eff6ff', // primary-50
      'border-color': '#2563eb', // primary-600
      'border-width': 4,
    },
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#e5e7eb', // border-DEFAULT
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#e5e7eb',
      'arrow-scale': 1,
      'curve-style': 'bezier',
      'opacity': 0.7,
      'transition-property': 'line-color, target-arrow-color, opacity, width',
      'transition-duration': '0.15s',
    },
  },
  {
    selector: 'edge.highlighted',
    style: {
      'width': 3,
      'line-color': '#3b82f6', // primary-500
      'target-arrow-color': '#3b82f6',
      'opacity': 1,
    },
  },
];

// --- Gentler, Smoother Layout Physics ---
const cyLayout = {
  name: 'cose',
  animate: true,
  animationDuration: 400,
  animationEasing: 'ease-out',
  idealEdgeLength: 120,
  nodeOverlap: 20,
  nodeRepulsion: () => 80000,
  edgeElasticity: () => 100,
  nestingFactor: 5,
  gravity: 1.2,
  numIter: 1000,
  initialTemp: 200,
  coolingFactor: 0.95,
  minTemp: 1.0,
  fit: true,
  padding: 40,
};

export function GraphCanvas({ onNodeClick, onNodeRightClick }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const { nodes, edges, selectedNode } = useGraphStore();
  
  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;
    
    cyRef.current = cytoscape({
      container: containerRef.current,
      style: cyStyle,
      layout: cyLayout as any, // 'as any' is needed for complex layout configs
      wheelSensitivity: 0.2,
      minZoom: 0.3,
      maxZoom: 3,
    });
    
    const cy = cyRef.current;
    
    // --- Event Handlers ---
    cy.on('tap', 'node', (evt) => {
      onNodeClick(evt.target.id());
    });
    
    cy.on('cxttap', 'node', (evt) => {
      evt.preventDefault();
      const node = evt.target;
      const renderedPosition = node.renderedPosition();
      onNodeRightClick(node.id(), renderedPosition.x, renderedPosition.y);
    });
    
    cy.on('mouseover', 'node', (evt) => {
      evt.target.connectedEdges().addClass('highlighted');
      evt.target.addClass('hover'); // Optional: for future hover styles
    });
    
    cy.on('mouseout', 'node', (evt) => {
      evt.target.connectedEdges().removeClass('highlighted');
      evt.target.removeClass('hover');
    });
    
    // Cleanup on unmount
    return () => {
      cy.destroy();
    };
    // These props are stable functions, this effect runs once on mount
  }, [onNodeClick, onNodeRightClick]);
  
  // Effect to update graph when nodes/edges change
  useEffect(() => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    // Diffing: Find new nodes and edges
    const existingNodeIds = cy.nodes().map(n => n.id());
    const newNodes = nodes
      .filter(n => !existingNodeIds.includes(n.id))
      .map(node => ({
        group: 'nodes' as const,
        data: { id: node.id, label: node.label },
      }));

    const existingEdgeIds = cy.edges().map(e => e.id());
    const newEdges = edges
      .filter(e => !existingEdgeIds.includes(e.id))
      .map(edge => ({
        group: 'edges' as const,
        data: { id: edge.id, source: edge.source, target: edge.target },
      }));

    const newElements = [...newNodes, ...newEdges];

    if (newElements.length > 0) {
      cy.add(newElements);
      
      // Re-run the layout smoothly
      cy.layout(cyLayout as any).run();
    }
  }, [nodes, edges]);
  
  // Effect to update selected node styling
  useEffect(() => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    // Deselect all nodes first
    cy.nodes().removeClass('selected');
    
    if (selectedNode) {
      const nodeElement = cy.getElementById(selectedNode);
      // Robustness: Only add class if the node exists
      if (nodeElement.length > 0) {
        nodeElement.addClass('selected');
      }
    }
  }, [selectedNode]);
  
  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-bg-subtle" // Use our new theme color
    />
  );
}