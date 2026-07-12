import React, { Component, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@/styles/globals.css';

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-[#090514] text-white p-8">
          <div className="max-w-md w-full bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
            <h1 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-sm text-red-300/80 mb-4">The dashboard encountered an unexpected error.</p>
            <div className="bg-black/40 p-4 rounded-xl text-xs font-mono text-red-300 overflow-x-auto mb-6">
              {this.state.error?.message || 'Unknown error'}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium rounded-xl transition-colors"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
