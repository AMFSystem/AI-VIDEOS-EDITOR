import { useState, useEffect } from "react";

function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  const getState = () => state;
  const setState = (fnOrVal) => {
    state = typeof fnOrVal === "function" ? fnOrVal(state) : { ...state, ...fnOrVal };
    listeners.forEach((l) => l(state));
  };
  const subscribe = (l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const useStore = () => {
    const [current, setCurrent] = useState(state);
    useEffect(() => subscribe(setCurrent), []);
    return [current, setState];
  };
  return { getState, setState, subscribe, useStore };
}

export const aiJobStore = createStore({
  jobs: {},
  activeJobsCount: 0,
});

export const useAIJobStore = aiJobStore.useStore;
