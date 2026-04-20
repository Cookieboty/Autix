'use client';

import { useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useArtifactStore } from '@/store/artifact.store';

export function ArtifactEditor() {
  const { editingContent, updateEditingContent, saveArtifact, setEditorInstance } =
    useArtifactStore();

  const handleEditorMount: OnMount = (editor, monaco) => {
    // 保存编辑器实例引用（用于版本恢复时重置状态）
    setEditorInstance(editor);

    // 添加快捷键：Ctrl+S 保存
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveArtifact();
    });
  };

  return (
    <div className="h-full w-full">
      <Editor
        language="markdown"
        value={editingContent}
        onChange={(value) => updateEditingContent(value || '')}
        onMount={handleEditorMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          wordWrap: 'on',
          lineNumbers: 'on',
          fontSize: 14,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
