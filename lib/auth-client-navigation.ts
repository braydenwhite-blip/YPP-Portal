"use client";

export function navigateToAuthDestination(path: string) {
  const nextPath = path.startsWith("/") ? path : "/";
  window.location.assign(new URL(nextPath, window.location.origin).toString());
}
