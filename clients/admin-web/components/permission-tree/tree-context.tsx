'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface PermissionNode {
  id: string;
  name: string;
  code: string;
  type: 'FRONTEND' | 'BACKEND';
  action: string;
  description?: string;
}

export interface MenuNode {
  id: string;
  name: string;
  code: string;
  path: string;
  icon?: string;
  sort: number;
  visible: boolean;
  parentId?: string | null;
  children: MenuNode[];
  permissions: PermissionNode[];
}

export interface SystemNode {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: string;
  sort: number;
  menus: MenuNode[];
}

interface SelectedNode {
  id: string;
  type: 'system' | 'menu' | 'permission';
  data: SystemNode | MenuNode | PermissionNode;
}

interface TreeContextType {
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
  selectNode: (id: string, type: 'system' | 'menu' | 'permission', data: any) => void;
  expandedNodes: Set<string>;
  toggleNode: (id: string) => void;
  toggleExpanded: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const TreeContext = createContext<TreeContextType | undefined>(undefined);

export function TreeProvider({ children }: { children: ReactNode }) {
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const selectNode = (id: string, type: 'system' | 'menu' | 'permission', data: any) => {
    setSelectedNode({ id, type, data });
  };

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleExpanded = toggleNode;

  const expandAll = () => {
    // This will be implemented with all node IDs
    setExpandedNodes(new Set());
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  return (
    <TreeContext.Provider
      value={{
        selectedNode,
        setSelectedNode,
        selectNode,
        expandedNodes,
        toggleNode,
        toggleExpanded,
        expandAll,
        collapseAll,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </TreeContext.Provider>
  );
}

export function useTreeContext() {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error('useTreeContext must be used within TreeProvider');
  }
  return context;
}
