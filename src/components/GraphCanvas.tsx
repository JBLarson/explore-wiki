import { useEffect, useRef } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import { useGraphStore } from '../stores/graphStore';

interface GraphCanvasProps {
  onNodeClick: (nodeId: string) => void;
  onNodeRightClick: (nodeId: string, x: number, y: number) => void;
}

export function GraphCanvas({ onNodeClick, onNodeRightClick }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const { nodes, edges, selectedNode } = useGraphStore();
  
  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;
    
    cyRef.current = cytoscape({
      container: containerRef.current,
      
        style: [
        {
            selector: 'node',
            style: {
            'background-color': '#4A90E2',
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '12px',
            'font-weight': 600,  // Remove quotes - it's a number
            'width': 'label',
            'height': 'label',
            'padding': '12px',
            'shape': 'roundrectangle',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'transition-property': 'background-color, border-width',
            'transition-duration': '0.2s',
            } as any,  // Add type assertion to bypass strict typing
        },
        {
          selector: 'node:hover',
          style: {
            'background-color': '#357ABD',
            'cursor': 'pointer',
            'border-width': 3,
            'border-color': '#2C5F8D',
          },
        },
        {
          selector: 'node.selected',
          style: {
            'background-color': '#E74C3C',
            'border-width': 3,
            'border-color': '#C0392B',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#CBD5E0',
            'target-arrow-color': '#CBD5E0',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.6,
            'arrow-scale': 1,
          },
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#4A90E2',
            'target-arrow-color': '#4A90E2',
            'opacity': 1,
            'width': 3,
          },
        },
      ],
      
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        edgeElasticity: 100,
        fit: true,
        padding: 30,
      },
      
      wheelSensitivity: 0.2,
      minZoom: 0.3,
      maxZoom: 3,
    });
    
    // Event handlers
    const cy = cyRef.current;
    
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onNodeClick(node.id());
    });
    
    cy.on('cxttap', 'node', (evt) => {
      evt.preventDefault();
      const node = evt.target;
      const renderedPosition = node.renderedPosition();
      onNodeRightClick(node.id(), renderedPosition.x, renderedPosition.y);
    });
    
    // Highlight connected edges on hover
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.connectedEdges().addClass('highlighted');
    });
    
    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      node.connectedEdges().removeClass('highlighted');
    });
    
    return () => {
      cy.destroy();
    };
  }, [onNodeClick, onNodeRightClick]);
  
  // Update graph when nodes/edges change
  useEffect(() => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    // Add new nodes
    const existingNodeIds = cy.nodes().map(n => n.id());
    const newNodes = nodes.filter(n => !existingNodeIds.includes(n.id));
    
    newNodes.forEach(node => {
      cy.add({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.label,
        },
      });
    });
    
    // Add new edges
    const existingEdgeIds = cy.edges().map(e => e.id());
    const newEdges = edges.filter(e => !existingEdgeIds.includes(e.id));
    
    newEdges.forEach(edge => {
      cy.add({
        group: 'edges',
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
        },
      });
    });
    
    // Re-run layout if new elements were added
    if (newNodes.length > 0 || newEdges.length > 0) {
      cy.layout({
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        fit: true,
        padding: 30,
      }).run();
    }
  }, [nodes, edges]);
  
  // Update selected node styling
  useEffect(() => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    cy.nodes().removeClass('selected');
    
    if (selectedNode) {
      cy.getElementById(selectedNode).addClass('selected');
    }
  }, [selectedNode]);
  
  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gray-50"
      style={{ cursor: 'grab' }}
    />
  );
}