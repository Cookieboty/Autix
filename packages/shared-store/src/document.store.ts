import { create } from 'zustand';
import {
  deleteDocument,
  getDocuments,
  getDocumentWithChunks,
  processDocument,
  uploadDocument,
} from '@autix/sdk';

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
  loadDocuments: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  fetchDocumentChunks: (id: string) => Promise<DocumentWithChunks>;
  deleteDocument: (id: string) => Promise<void>;
  processDocument: (id: string) => Promise<void>;
  markDocumentError: (id: string) => void;
  pollDocumentProcessing: (id: string) => Promise<DocumentItem>;
  uploadAndProcessDocument: (file: File) => Promise<DocumentItem>;
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
  loadDocuments: async () => {
    set({ loading: true });
    try {
      const { data } = await getDocuments();
      set({ documents: data as DocumentItem[] });
    } catch {
      // Preserve the previous UI behavior: failed library refreshes are silent.
    } finally {
      set({ loading: false });
    }
  },
  refreshDocuments: async () => {
    const { data } = await getDocuments();
    set({ documents: data as DocumentItem[] });
  },
  fetchDocumentChunks: async (id) => {
    const { data } = await getDocumentWithChunks(id);
    const chunks = data.chunks ?? data.document_chunks ?? [];
    return { ...data, chunks } as DocumentWithChunks;
  },
  deleteDocument: async (id) => {
    await deleteDocument(id);
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      expandedDoc: state.expandedDoc?.id === id ? null : state.expandedDoc,
    }));
  },
  processDocument: async (id) => {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, status: 'processing' } : d)),
    }));
    try {
      await processDocument(id);
    } catch {
      set((state) => ({
        documents: state.documents.map((d) => (d.id === id ? { ...d, status: 'error' } : d)),
      }));
      throw new Error('document process failed');
    }
  },
  markDocumentError: (id) => {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, status: 'error' } : d)),
    }));
  },
  pollDocumentProcessing: async (id) => {
    const { data } = await getDocumentWithChunks(id);
    if (data.status === 'done' || data.status === 'error') {
      const patch: Partial<DocumentItem> = {
        status: data.status,
        chunkCount: data.chunkCount,
      };
      set((state) => ({
        documents: state.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }));
    }
    return data as DocumentItem;
  },
  uploadAndProcessDocument: async (file) => {
    set({ uploading: true });
    try {
      const { data } = await uploadDocument(file);
      const doc = data as DocumentItem;
      set((state) => ({ documents: [doc, ...state.documents] }));
      processDocument(doc.id).catch(() => {});
      return doc;
    } finally {
      set({ uploading: false });
    }
  },
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      expandedDoc: state.expandedDoc?.id === id ? null : state.expandedDoc,
    })),
  addDocument: (doc) => set((state) => ({ documents: [doc, ...state.documents] })),
  updateDocument: (id, patch) =>
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
}));
