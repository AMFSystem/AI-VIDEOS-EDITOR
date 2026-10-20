import { useState, useEffect } from "react";

// Lightweight reactive store implementation
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;
  const setState = (fnOrVal) => {
    state = typeof fnOrVal === "function" ? fnOrVal(state) : { ...state, ...fnOrVal };
    listeners.forEach((listener) => listener(state));
  };
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useStore = () => {
    const [current, setCurrent] = useState(state);
    useEffect(() => subscribe(setCurrent), []);
    return [current, setState];
  };

  return { getState, setState, subscribe, useStore };
}

export const timelineStore = createStore({
  tracks: [],
  selectedClipId: null,
  scale: 1,
});

export const useTimelineStore = timelineStore.useStore;
