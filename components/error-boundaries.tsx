"use client";

import { Component, ReactNode } from "react";
import { logger } from "@/lib/logger";

/**
 * Error Boundary Components
 *
 * Provides reusable error boundaries for catching and handling React errors.
 * Logs errors to structured logging for monitoring and debugging.
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic Error Boundary
 *
 * Catches JavaScript errors anywhere in the child component tree.
 * Logs errors and displays a fallback UI.
 *
 * @example
 * <ErrorBoundary fallback={<ErrorFallback />}>
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to structured logging
    logger.error(
      {
        err: error,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
      "React Error Boundary caught error"
    );

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <GenericErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

/**
 * Generic Error Fallback UI
 */
function GenericErrorFallback({ error }: { error: Error | null }) {
  return (
    <div
      style={{
        padding: "40px 20px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "48px",
          marginBottom: "16px",
        }}
      >
        ⚠️
      </div>
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "#1c1917",
          marginBottom: "8px",
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          fontSize: "16px",
          color: "#78716c",
          marginBottom: "24px",
        }}
      >
        We've been notified and are looking into it. Please try refreshing the page.
      </p>
      {process.env.NODE_ENV === "development" && error && (
        <details
          style={{
            marginTop: "24px",
            padding: "16px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            textAlign: "left",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            Error Details (Development Only)
          </summary>
          <pre
            style={{
              fontSize: "12px",
              overflow: "auto",
              color: "#991b1b",
            }}
          >
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
        </details>
      )}
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: "24px",
          padding: "12px 24px",
          background: "#7c3aed",
          color: "white",
          border: "none",
          borderRadius: "9999px",
          fontSize: "16px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Refresh Page
      </button>
    </div>
  );
}

/**
 * Network Error Fallback UI
 */
export function NetworkErrorFallback({ retry }: { retry?: () => void }) {
  return (
    <div
      style={{
        padding: "40px 20px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "48px",
          marginBottom: "16px",
        }}
      >
        📡
      </div>
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "#1c1917",
          marginBottom: "8px",
        }}
      >
        Connection Error
      </h2>
      <p
        style={{
          fontSize: "16px",
          color: "#78716c",
          marginBottom: "24px",
        }}
      >
        Unable to reach the server. Please check your internet connection and try again.
      </p>
      {retry && (
        <button
          onClick={retry}
          style={{
            padding: "12px 24px",
            background: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "9999px",
            fontSize: "16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Permission Denied Fallback UI
 */
export function PermissionDeniedFallback({ message }: { message?: string }) {
  return (
    <div
      style={{
        padding: "40px 20px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "48px",
          marginBottom: "16px",
        }}
      >
        🔒
      </div>
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "#1c1917",
          marginBottom: "8px",
        }}
      >
        Access Denied
      </h2>
      <p
        style={{
          fontSize: "16px",
          color: "#78716c",
          marginBottom: "24px",
        }}
      >
        {message || "You don't have permission to access this page."}
      </p>
      <a
        href="/"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "#7c3aed",
          color: "white",
          textDecoration: "none",
          borderRadius: "9999px",
          fontSize: "16px",
          fontWeight: 600,
        }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}

/**
 * Not Found Fallback UI
 */
export function NotFoundFallback({ resourceType }: { resourceType?: string }) {
  return (
    <div
      style={{
        padding: "40px 20px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "48px",
          marginBottom: "16px",
        }}
      >
        🔍
      </div>
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "#1c1917",
          marginBottom: "8px",
        }}
      >
        {resourceType ? `${resourceType} Not Found` : "Page Not Found"}
      </h2>
      <p
        style={{
          fontSize: "16px",
          color: "#78716c",
          marginBottom: "24px",
        }}
      >
        {resourceType
          ? `The ${resourceType.toLowerCase()} you're looking for doesn't exist or has been removed.`
          : "The page you're looking for doesn't exist."}
      </p>
      <a
        href="/"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "#7c3aed",
          color: "white",
          textDecoration: "none",
          borderRadius: "9999px",
          fontSize: "16px",
          fontWeight: 600,
        }}
      >
        Go to Dashboard
      </a>
    </div>
  );
}

/**
 * Loading Error Fallback (for data fetching errors)
 */
export function LoadingErrorFallback({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div
      style={{
        padding: "40px 20px",
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "48px",
          marginBottom: "16px",
        }}
      >
        ⚠️
      </div>
      <h2
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "#1c1917",
          marginBottom: "8px",
        }}
      >
        Failed to Load Data
      </h2>
      <p
        style={{
          fontSize: "16px",
          color: "#78716c",
          marginBottom: "24px",
        }}
      >
        {error.message || "An error occurred while loading the data."}
      </p>
      {retry && (
        <button
          onClick={retry}
          style={{
            padding: "12px 24px",
            background: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "9999px",
            fontSize: "16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
