import { create } from 'zustand';

export interface DocumentItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: string;
  chunkCount: number;
  createdAt: string;
  _count: { chunks: number };
}

export interface DocumentChunk {
  id: string;
  content: string;
  chunkIndex: number;
}

export interface DocumentWithChunks extends DocumentItem {
  chunks: DocumentChunk[];
}

interface DocumentState {
  documents: DocumentItem[];
  expandedDoc: DocumentWithChunks | null;
  loading: boolean;
  uploading: boolean;
  setDocuments: (docs: DocumentItem[]) => void;
  setExpandedDoc: (doc: DocumentWithChunks | null) => void;
  setLoading: (v: boolean) => void;
  setUploading: (v: boolean) => void;
  removeDocument: (id: string) => void;
  addDocument: (doc: DocumentItem) => void;
  updateDocument: (id: string, patch: Partial<DocumentItem>) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  expandedDoc: null,
  loading: false,
  uploading: false,
  setDocuments: (documents) => set({ documents }),
  setExpandedDoc: (doc) => set({ expandedDoc: doc }),
  setLoading: (v) => set({ loading: v }),
  setUploading: (v) => set({ uploading: v }),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      expandedDoc: state.expandedDoc?.id === id ? null : state.expandedDoc,
    })),
  addDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),
  updateDocument: (id, patch) =>
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
}));
