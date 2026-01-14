'use client';

/**
 * ScatterPlot - UMAP 2D scatter plot visualization
 *
 * This component provides an interactive scatter plot view of clustered data.
 * Features:
 * - Zoom and pan with mouse
 * - Color by cluster level
 * - Hover tooltips
 * - Click to select items
 *
 * USAGE:
 * Copy this file to your visualizer/components/ directory.
 * Adjust type imports to match your lib/types.ts
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Item, ColorMode, Filters } from '@/lib/types';
import { getClusterColor, CLUSTER_COLORS } from '@/lib/utils';

interface ScatterPlotProps {
  items: Item[];
  colorMode?: ColorMode;
  filters?: Filters;
  selectedItem: Item | null;
  onItemSelect: (item: Item | null) => void;
}

export function ScatterPlot({
  items,
  colorMode = 'l1',
  filters,
  selectedItem,
  onItemSelect
}: ScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    item: Item;
  } | null>(null);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Filter items
  const filteredItems = filters ? items.filter(item => {
    if (filters.selectedCluster !== null) {
      const clusterKey = `cluster_l${filters.clusterLevel}` as keyof Item;
      if (item[clusterKey] !== filters.selectedCluster) {
        return false;
      }
    }
    return true;
  }) : items;

  // Get color for an item
  const getColor = useCallback((item: Item): string => {
    switch (colorMode) {
      case 'l1':
        return item.cluster_l1 !== null ? getClusterColor(item.cluster_l1) : '#444';
      case 'l2':
        return item.cluster_l2 !== null ? getClusterColor(item.cluster_l2) : '#444';
      case 'l3':
        return item.cluster_l3 !== null ? getClusterColor(item.cluster_l3) : '#444';
      default:
        return '#4e79a7';
    }
  }, [colorMode]);

  // Draw the visualization
  useEffect(() => {
    if (!svgRef.current || filteredItems.length === 0) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Clear previous content
    svg.selectAll('*').remove();

    // Create main group
    const g = svg.append('g');

    // Scales
    const xExtent = d3.extent(filteredItems, d => d.x) as [number, number];
    const yExtent = d3.extent(filteredItems, d => d.y) as [number, number];

    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - 0.5, xExtent[1] + 0.5])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - 0.5, yExtent[1] + 0.5])
      .range([height - margin.bottom, margin.top]);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 50])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Draw points
    g.selectAll('circle')
      .data(filteredItems)
      .join('circle')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', d => selectedItem?.id === d.id ? 8 : 4)
      .attr('fill', d => getColor(d))
      .attr('stroke', d => selectedItem?.id === d.id ? '#fff' : 'none')
      .attr('stroke-width', 2)
      .attr('opacity', d => selectedItem?.id === d.id ? 1 : 0.7)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const [x, y] = d3.pointer(event, document.body);
        setTooltip({ x, y, item: d });
        d3.select(event.currentTarget)
          .attr('r', 6)
          .attr('opacity', 1);
      })
      .on('mouseleave', (event, d) => {
        setTooltip(null);
        d3.select(event.currentTarget)
          .attr('r', selectedItem?.id === d.id ? 8 : 4)
          .attr('opacity', selectedItem?.id === d.id ? 1 : 0.7);
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        onItemSelect(d);
      });

    // Click on background to deselect
    svg.on('click', () => {
      onItemSelect(null);
    });

    // Double-click to reset zoom
    svg.on('dblclick.zoom', null);
    svg.on('dblclick', () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    });

  }, [filteredItems, dimensions, colorMode, selectedItem, getColor, onItemSelect]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-gray-900/50 rounded-lg"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed pointer-events-none z-50 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-sm"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
          }}
        >
          <div className="text-sm text-gray-200 mb-1 line-clamp-3">
            {tooltip.item.content.slice(0, 150)}
            {tooltip.item.content.length > 150 ? '...' : ''}
          </div>
          <div className="text-xs text-gray-400">
            L1: {tooltip.item.cluster_l1} / L2: {tooltip.item.cluster_l2} / L3: {tooltip.item.cluster_l3}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-400">
        {filteredItems.length.toLocaleString()} items shown
        <br />
        <span className="text-gray-500">
          Scroll to zoom, drag to pan, double-click to reset
        </span>
      </div>
    </div>
  );
}
