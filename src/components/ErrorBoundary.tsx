import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected error occurred',
    };
  }

  componentDidCatch(error: Error): void {
    console.error('TrustedPanel ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#d8c7f5] flex items-center justify-center p-4">
          <div className="bg-white rounded-[22px] p-6 max-w-[360px] w-full text-center shadow-xl">
            <h1 className="text-[20px] font-extrabold text-[#3a1d6d]">
              TrustedPanel Reload Required
            </h1>
            <p className="text-[13px] text-[#555] mt-2 leading-relaxed">
              Kuch temporary network/sync error aaya hai. Niche Reload button dabayein.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full bg-[#7c4dff] text-white font-extrabold py-3 rounded-[14px] text-[14px] cursor-pointer"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
