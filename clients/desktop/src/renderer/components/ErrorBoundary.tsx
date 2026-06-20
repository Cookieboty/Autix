'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function ErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const t = useTranslations('layout');

  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'system-ui',
        color: '#333',
        backgroundColor: '#fff',
        minHeight: '100vh',
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>
        {t('renderErrorTitle')}
      </h2>
      <p style={{ marginTop: 8, color: '#666' }}>
        {error.message}
      </p>
      <pre
        style={{
          marginTop: 12,
          padding: 12,
          background: '#f5f5f5',
          fontSize: 12,
          maxHeight: 240,
          overflow: 'auto',
        }}
      >
        {error.stack}
      </pre>
      <button
        onClick={onReset}
        style={{
          marginTop: 16,
          padding: '8px 16px',
          borderRadius: 4,
          background: '#0066cc',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {t('retry')}
      </button>
    </div>
  );
}
