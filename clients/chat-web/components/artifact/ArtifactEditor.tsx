'use client';

import { useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useArtifactStore } from '@/store/artifact.store';

export function ArtifactEditor() {
  const {
    editingContent,
    updateEditingContent,
    saveArtifact,
    setEditorInstance,
  } = useArtifactStore();

  const theme = useMemo(() => {
    if (typeof document === 'undefined') return 'vs';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'vs-dark' : 'vs';
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    setEditorInstance(editor);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveArtifact();
    });
  };

  return (
    <div className="flex h-full w-full flex-col p-5">
      <div
        className="min-h-0 flex-1 overflow-hidden rounded-lg"
        style={{
          backgroundColor: 'var(--panel)',
          border: '1px solid var(--border)',
        }}
      >
        <Editor
          language="markdown"
          value={editingContent}
          onChange={(value) => updateEditingContent(value || '')}
          onMount={handleEditorMount}
          theme={theme}
          options={{
            minimap: { enabled: false },
            wordWrap: 'on',
            lineNumbers: 'on',
            fontSize: 15,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            padding: { top: 20, bottom: 20 },
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 18,
          }}
        />
      </div>
    </div>
  );
}
