'use client';

import * as React from 'react';

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
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
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
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>应用渲染异常</h2>
          <p style={{ marginTop: 8, color: '#666' }}>
            {this.state.error.message}
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
            {this.state.error.stack}
          </pre>
          <button
            onClick={this.reset}
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
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
