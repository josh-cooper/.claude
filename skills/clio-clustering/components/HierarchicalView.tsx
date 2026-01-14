'use client';

/**
 * HierarchicalView - Circle-packing visualization with drill-down navigation
 *
 * This component provides an interactive hierarchical view of clustered data.
 * Features:
 * - Circle-packing layout showing cluster hierarchy
 * - Click to drill down into sub-clusters
 * - Breadcrumb navigation
 * - Search functionality
 * - Leaf-level view showing individual items
 *
 * USAGE:
 * Copy this file to your visualizer/components/ directory.
 * Adjust type imports to match your lib/types.ts
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Search, ZoomIn, ZoomOut, Home, X, ArrowLeft, FileText } from 'lucide-react';
import { HierarchicalNode, Item } from '@/lib/types';
import { getCategoryColor, truncate } from '@/lib/utils';

interface HierarchicalViewProps {
  hierarchy: HierarchicalNode;
  items: Item[];
  onClusterSelect?: (clusterId: string, level: number) => void;
}

interface PackedNode extends d3.HierarchyCircularNode<HierarchicalNode> {
  data: HierarchicalNode;
}

export function HierarchicalView({ hierarchy, items, onClusterSelect }: HierarchicalViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [focusedNode, setFocusedNode] = useState<PackedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<PackedNode | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<PackedNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PackedNode[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showLeafDetail, setShowLeafDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [hoveredItem, setHoveredItem] = useState<Item | null>(null);

  // Calculate pack layout
  const packedHierarchy = useMemo(() => {
    const root = d3.hierarchy(hierarchy)
      .sum(d => d.children && d.children.length > 0 ? 0 : d.size)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack<HierarchicalNode>()
      .size([dimensions.width - 40, dimensions.height - 40])
      .padding(4);

    return pack(root) as PackedNode;
  }, [hierarchy, dimensions]);

  // Collect all nodes for search
  const allNodes = useMemo(() => {
    const nodes: PackedNode[] = [];
    packedHierarchy.each(node => nodes.push(node as PackedNode));
    return nodes;
  }, [packedHierarchy]);

  // Get items for the focused leaf cluster
  const leafItems = useMemo(() => {
    if (!focusedNode || !showLeafDetail) return [];

    const level = focusedNode.data.level;
    const label = focusedNode.data.originalLabel;

    if (label === undefined) return [];

    return items.filter(item => {
      if (level === 1) return item.cluster_l1 === label;
      if (level === 2) return item.cluster_l2 === label;
      if (level === 3) return item.cluster_l3 === label;
      return false;
    });
  }, [focusedNode, showLeafDetail, items]);

  // Compute bounds for the leaf scatter plot
  const leafBounds = useMemo(() => {
    if (leafItems.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };

    const xs = leafItems.map(c => c.x);
    const ys = leafItems.map(c => c.y);
    const padding = 0.1;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    return {
      minX: minX - rangeX * padding,
      maxX: maxX + rangeX * padding,
      minY: minY - rangeY * padding,
      maxY: maxY + rangeY * padding
    };
  }, [leafItems]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 800, height: height || 600 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Search functionality
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = allNodes.filter(node =>
      node.data.name.toLowerCase().includes(query) ||
      node.data.summary.toLowerCase().includes(query) ||
      node.data.category?.toLowerCase().includes(query)
    );
    setSearchResults(results.slice(0, 10));
  }, [searchQuery, allNodes]);

  // Navigate to a node
  const navigateToNode = useCallback((node: PackedNode) => {
    setFocusedNode(node);
    setShowLeafDetail(false);
    setSelectedItem(null);

    const trail: PackedNode[] = [];
    let current: PackedNode | null = node;
    while (current) {
      trail.unshift(current);
      current = current.parent as PackedNode | null;
    }
    setBreadcrumbs(trail);

    if (onClusterSelect && node.data.id !== 'root') {
      onClusterSelect(node.data.id, node.data.level);
    }

    setShowSearch(false);
    setSearchQuery('');
  }, [onClusterSelect]);

  // Show leaf detail view
  const showLeafItems = useCallback((node: PackedNode) => {
    setFocusedNode(node);
    setShowLeafDetail(true);
    setSelectedItem(null);

    const trail: PackedNode[] = [];
    let current: PackedNode | null = node;
    while (current) {
      trail.unshift(current);
      current = current.parent as PackedNode | null;
    }
    setBreadcrumbs(trail);
  }, []);

  const exitLeafDetail = useCallback(() => {
    setShowLeafDetail(false);
    setSelectedItem(null);
  }, []);

  const resetView = useCallback(() => {
    setFocusedNode(null);
    setBreadcrumbs([]);
    setZoom(1);
    setShowLeafDetail(false);
    setSelectedItem(null);
  }, []);

  // Calculate view transform
  const viewBox = useMemo(() => {
    if (!focusedNode) {
      return `0 0 ${dimensions.width} ${dimensions.height}`;
    }

    const x = focusedNode.x - focusedNode.r - 20;
    const y = focusedNode.y - focusedNode.r - 20;
    const w = focusedNode.r * 2 + 40;
    const h = focusedNode.r * 2 + 40;

    return `${x} ${y} ${w} ${h}`;
  }, [focusedNode, dimensions]);

  // Get visible nodes based on current focus
  const visibleNodes = useMemo(() => {
    if (!focusedNode) {
      return allNodes.filter(node => node.depth <= 2);
    }

    const nodes: PackedNode[] = [];
    const collectDescendants = (node: PackedNode, depth: number) => {
      nodes.push(node);
      if (depth < 2 && node.children) {
        node.children.forEach(child => collectDescendants(child as PackedNode, depth + 1));
      }
    };
    collectDescendants(focusedNode, 0);
    return nodes;
  }, [focusedNode, allNodes]);

  const getNodeColor = (node: PackedNode): string => {
    if (node.data.id === 'root') return '#374151';
    return getCategoryColor(node.data.category);
  };

  const getNodeOpacity = (node: PackedNode): number => {
    if (hoveredNode && node === hoveredNode) return 1;
    if (focusedNode) {
      let current: PackedNode | null = node;
      while (current) {
        if (current === focusedNode) return node.depth - focusedNode.depth < 2 ? 0.9 : 0.3;
        current = current.parent as PackedNode | null;
      }
      return 0.2;
    }
    return node.depth === 0 ? 0.3 : node.depth === 1 ? 0.8 : 0.6;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button
          onClick={resetView}
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
          title="Reset view"
        >
          <Home className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`p-2 rounded-lg transition-colors ${
            showSearch ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
          }`}
          title="Search clusters"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z / 1.2, 0.5))}
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Search panel */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 left-4 z-20 w-80 bg-gray-800 rounded-lg shadow-xl border border-gray-700"
          >
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clusters..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-200" />
                  </button>
                )}
              </div>
            </div>
            {searchResults.length > 0 && (
              <div className="border-t border-gray-700 max-h-64 overflow-y-auto">
                {searchResults.map((node) => (
                  <button
                    key={node.data.id}
                    onClick={() => navigateToNode(node)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getNodeColor(node) }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{node.data.name}</div>
                        <div className="text-xs text-gray-400">
                          Level {node.data.level} - {node.data.size.toLocaleString()} items
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1.5 bg-gray-800/90 backdrop-blur-sm rounded-full">
          <button onClick={resetView} className="text-sm text-gray-400 hover:text-white transition-colors">
            Root
          </button>
          {breadcrumbs.slice(1).map((node, i) => (
            <React.Fragment key={node.data.id}>
              <ChevronRight className="w-4 h-4 text-gray-500" />
              <button
                onClick={() => navigateToNode(node)}
                className={`text-sm transition-colors ${
                  i === breadcrumbs.length - 2 ? 'text-white font-medium' : 'text-gray-400 hover:text-white'
                }`}
              >
                {truncate(node.data.name, 20)}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Current cluster title */}
      {focusedNode && !showLeafDetail && focusedNode.data.id !== 'root' && (
        <div className="absolute bottom-4 right-4 z-10 text-right max-w-md p-3 bg-gray-800/90 backdrop-blur-sm rounded-lg">
          <h2 className="text-lg font-semibold text-white">{focusedNode.data.name}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {focusedNode.data.size.toLocaleString()} items
            {focusedNode.children && focusedNode.children.length > 0 && (
              <span> - {focusedNode.children.length} sub-clusters</span>
            )}
          </p>
        </div>
      )}

      {/* Leaf Detail View */}
      {showLeafDetail && focusedNode && (
        <div className="absolute inset-0 bg-gray-900">
          <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
            <button
              onClick={exitLeafDetail}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
            <div className="px-3 py-1.5 bg-gray-800 rounded-lg">
              <span className="text-sm font-medium">{focusedNode.data.name}</span>
              <span className="text-xs text-gray-400 ml-2">{leafItems.length.toLocaleString()} items</span>
            </div>
          </div>

          <svg className="w-full h-full">
            <g transform="translate(20, 60)">
              {leafItems.map((item) => {
                const cx = ((item.x - leafBounds.minX) / (leafBounds.maxX - leafBounds.minX)) * (dimensions.width - 40);
                const cy = ((item.y - leafBounds.minY) / (leafBounds.maxY - leafBounds.minY)) * (dimensions.height - 100);
                const isSelected = selectedItem?.id === item.id;
                const isHovered = hoveredItem?.id === item.id;

                return (
                  <circle
                    key={item.id}
                    cx={cx}
                    cy={cy}
                    r={isSelected || isHovered ? 6 : 4}
                    fill={getCategoryColor(focusedNode.data.category)}
                    fillOpacity={isSelected ? 1 : isHovered ? 0.9 : 0.6}
                    stroke={isSelected || isHovered ? '#fff' : 'transparent'}
                    strokeWidth={isSelected ? 2 : 1}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                    onClick={() => setSelectedItem(item)}
                  />
                );
              })}
            </g>
          </svg>

          {/* Hovered item tooltip */}
          <AnimatePresence>
            {hoveredItem && !selectedItem && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-4 left-4 right-4 z-20 p-3 bg-gray-800/95 backdrop-blur-sm rounded-lg border border-gray-700 max-w-xl"
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-200 line-clamp-3">{hoveredItem.content}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected item panel */}
          <AnimatePresence>
            {selectedItem && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-16 right-4 bottom-4 w-96 z-20 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                  <h3 className="font-medium">Item Details</h3>
                  <button onClick={() => setSelectedItem(null)} className="p-1 hover:bg-gray-700 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Content</div>
                    <div className="text-sm text-gray-200 whitespace-pre-wrap">{selectedItem.content}</div>
                  </div>
                  {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Metadata</div>
                      <pre className="text-xs bg-gray-900 p-2 rounded overflow-x-auto">
                        {JSON.stringify(selectedItem.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SVG Circle Packing */}
      {!showLeafDetail && (
        <>
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="w-full h-full"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          >
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g transform="translate(20, 20)">
              <AnimatePresence mode="sync">
                {visibleNodes.map((node) => {
                  const hasChildren = node.children && node.children.length > 0;
                  const isHovered = hoveredNode === node;
                  const color = getNodeColor(node);

                  return (
                    <motion.g
                      key={node.data.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{
                        opacity: getNodeOpacity(node),
                        scale: 1,
                        x: node.x,
                        y: node.y
                      }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => {
                        if (hasChildren) {
                          navigateToNode(node);
                        } else if (node.data.id !== 'root') {
                          showLeafItems(node);
                        }
                      }}
                      style={{ cursor: node.data.id !== 'root' ? 'pointer' : 'default' }}
                    >
                      <circle
                        r={node.r}
                        fill={color}
                        fillOpacity={node.depth === 0 ? 0.1 : 0.15}
                        stroke={color}
                        strokeWidth={isHovered ? 3 : 1.5}
                        filter={isHovered ? 'url(#glow)' : undefined}
                      />

                      {(node.r > 30 || isHovered) && node.data.id !== 'root' &&
                       (focusedNode ? node.depth === focusedNode.depth + 1 : node.depth === 1) && (
                        <text
                          textAnchor="middle"
                          dy=".3em"
                          className="fill-white text-xs font-medium pointer-events-none"
                          style={{ fontSize: Math.min(node.r / 4, 14) }}
                        >
                          {truncate(node.data.name, Math.floor(node.r / 4))}
                        </text>
                      )}

                      {node.r > 40 && !hasChildren &&
                       (focusedNode ? node.depth === focusedNode.depth + 1 : node.depth === 1) && (
                        <text
                          textAnchor="middle"
                          dy="1.5em"
                          className="fill-gray-400 text-xs pointer-events-none"
                          style={{ fontSize: Math.min(node.r / 5, 10) }}
                        >
                          {node.data.size.toLocaleString()}
                        </text>
                      )}
                    </motion.g>
                  );
                })}
              </AnimatePresence>
            </g>
          </svg>

          {/* Hover tooltip */}
          <AnimatePresence>
            {hoveredNode && hoveredNode.data.id !== 'root' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 left-4 right-4 z-20 p-4 bg-gray-800/95 backdrop-blur-sm rounded-lg border border-gray-700 max-w-lg"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: getNodeColor(hoveredNode) }}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg">{hoveredNode.data.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                      <span>Level {hoveredNode.data.level}</span>
                      <span>-</span>
                      <span>{hoveredNode.data.size.toLocaleString()} items</span>
                      {hoveredNode.data.category && (
                        <>
                          <span>-</span>
                          <span className="capitalize">{hoveredNode.data.category}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-3">{hoveredNode.data.summary}</p>
                    {hoveredNode.children && hoveredNode.children.length > 0 ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Click to explore {hoveredNode.children.length} sub-clusters
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">Click to view individual items</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <div className="absolute top-4 right-4 z-10 p-3 bg-gray-800/90 backdrop-blur-sm rounded-lg text-xs">
            <div className="font-medium mb-2">Categories</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries({
                bug: 'Bug',
                feature_request: 'Feature',
                question: 'Question',
                feedback: 'Feedback',
                discussion: 'Discussion',
                general: 'General'
              }).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor(key) }} />
                  <span className="text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
