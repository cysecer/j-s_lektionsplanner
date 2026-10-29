"use client";

import { useState } from "react";

/**
 * Local, optimistically editable copy of a server-provided value that resets
 * whenever the server sends a new value (React's "adjust state when a prop
 * changes" pattern, no effect needed).
 */
export function useSyncedState<T>(value: T) {
  const [state, setState] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setState(value);
  }
  return [state, setState] as const;
}
