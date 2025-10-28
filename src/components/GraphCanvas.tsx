import { useEffect, useRef } from 'react';
import cytoscape, { Core } from 'cytoscape';
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
            'font-size': 12,
            'font-weight': 600,
            'width': 100,
            'height': 100,
            'shape': 'ellipse',
            'text-wrap': 'wrap',
            'text-max-width': 70,
            'transition-property': 'background-color, border-width',
            'transition-duration': 0.2,
            'border-width': 2,
            'border-color': '#357ABD',
          } as any,
        },
        {
          selector: 'node:hover',
          style: {
            'background-color': '#357ABD',
            'border-width': 4,
            'border-color': '#2C5F8D',
          } as any,
        },
        {
          selector: 'node.selected',
          style: {
            'background-color': '#E74C3C',
            'border-width': 4,
            'border-color': '#C0392B',
          } as any,
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
            'arrow-scale': 1.2,
          } as any,
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#4A90E2',
            'target-arrow-color': '#4A90E2',
            'opacity': 1,
            'width': 3,
          } as any,
        },
      ],
      
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 1000,
        animationEasing: 'ease-out',
        
        // Prevent overlap
        nodeOverlap: 20,
        
        // Physics parameters
        nodeRepulsion: 400000, // Strong repulsion to spread nodes out
        idealEdgeLength: 150,
        edgeElasticity: 100,
        
        // Gravity and positioning
        gravity: 1,
        numIter: 1000,
        
        // Prevent overlapping
        avoidOverlap: true,
        
        fit: true,
        padding: 50,
      } as any,
      
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
        animationDuration: 1000,
        animationEasing: 'ease-out',
        
        // Prevent overlap
        nodeOverlap: 20,
        
        // Physics parameters
        nodeRepulsion: 400000,
        idealEdgeLength: 150,
        edgeElasticity: 100,
        
        // Gravity and positioning
        gravity: 1,
        numIter: 1000,
        
        // Prevent overlapping
        avoidOverlap: true,
        
        fit: true,
        padding: 50,
      } as any).run();
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
    />
  );
}