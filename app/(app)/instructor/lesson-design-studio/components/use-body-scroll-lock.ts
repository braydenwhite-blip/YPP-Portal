"use client";

import { useEffect } from "react";

const BODY_LOCK_COUNT_KEY = "ldsScrollLockCount";
const BODY_LOCK_OVERFLOW_KEY = "ldsScrollLockOverflow";
const BODY_LOCK_PADDING_KEY = "ldsScrollLockPaddingRight";

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === "undefined") {
      return;
    }

    const { body, documentElement } = document;
    const currentCount = Number(body.dataset[BODY_LOCK_COUNT_KEY] ?? "0");

    if (currentCount === 0) {
      body.dataset[BODY_LOCK_OVERFLOW_KEY] = body.style.overflow;
      body.dataset[BODY_LOCK_PADDING_KEY] = body.style.paddingRight;

      const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    body.dataset[BODY_LOCK_COUNT_KEY] = String(currentCount + 1);

    return () => {
      const nextCount = Math.max(
        0,
        Number(body.dataset[BODY_LOCK_COUNT_KEY] ?? "1") - 1
      );

      if (nextCount > 0) {
        body.dataset[BODY_LOCK_COUNT_KEY] = String(nextCount);
        return;
      }

      body.style.overflow = body.dataset[BODY_LOCK_OVERFLOW_KEY] ?? "";
      body.style.paddingRight = body.dataset[BODY_LOCK_PADDING_KEY] ?? "";
      delete body.dataset[BODY_LOCK_COUNT_KEY];
      delete body.dataset[BODY_LOCK_OVERFLOW_KEY];
      delete body.dataset[BODY_LOCK_PADDING_KEY];
    };
  }, [locked]);
}
