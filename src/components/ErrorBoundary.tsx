/**
 * Top-level error boundary
 *
 * Without this, any render-time exception (or a module that fails to load in
 * an older browser) leaves the user staring at a blank black page with no
 * clue what happened. This shows a readable message, the error text so they
 * can report it, and a reload button.
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('VVTT crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#f2f2f2',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 520, width: '100%' }}>
          <h1 style={{ color: '#ff6b35', fontSize: 24, margin: '0 0 12px' }}>VVTT hit an error</h1>
          <p style={{ color: '#aaa', margin: '0 0 16px', lineHeight: 1.5 }}>
            Something went wrong while loading the app. Reloading usually fixes it. If it keeps
            happening, try a current version of Chrome, Safari, or Firefox, and send the details
            below to the developer on GitHub.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#ff6b35',
              color: '#111',
              border: 0,
              borderRadius: 8,
              padding: '10px 18px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 20,
            }}
          >
            Reload
          </button>
          <pre
            style={{
              background: '#161616',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: '#bbb',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {ua}
          </pre>
          <p style={{ marginTop: 16, fontSize: 13 }}>
            <a href="https://github.com/fortandr/dnd-vehicle-combat/issues" style={{ color: '#ff6b35' }}>
              Report on GitHub
            </a>
          </p>
        </div>
      </div>
    );
  }
}
