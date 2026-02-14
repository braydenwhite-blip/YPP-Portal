"use client";

import React from "react";
import styles from "./passion-world.module.css";

// ═══════════════════════════════════════════════════════════════
// ERROR BOUNDARY — lightweight, no Three.js dependencies
// ═══════════════════════════════════════════════════════════════

interface ErrorBoundaryState {
  hasError: boolean;
}

export class WorldErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorWorld}>
          <div className={styles.errorIcon}>{"\u{1F30A}"}</div>
          <div className={styles.errorTitle}>
            Your world encountered a storm
          </div>
          <div className={styles.errorMessage}>
            Something went wrong loading the Passion World. Try refreshing.
          </div>
          <button
            className={styles.errorRetry}
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════
// LOADING SKELETON — lightweight, no Three.js dependencies
// ═══════════════════════════════════════════════════════════════

export function WorldLoadingSkeleton() {
  return (
    <div className={styles.loadingWorld}>
      <div className={styles.loadingTitle}>THE PASSION WORLD</div>
      <div className={styles.loadingIslands}>
        <div className={styles.loadingIsland} />
        <div className={styles.loadingIsland} />
        <div className={styles.loadingIsland} />
        <div className={styles.loadingIsland} />
      </div>
      <div className={styles.loadingBar}>
        <div className={styles.loadingBarFill} />
      </div>
    </div>
  );
}
