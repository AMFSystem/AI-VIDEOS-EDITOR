import { useEffect } from "react";

export function useHotkeys(keyMap = {}) {
  useEffect(() => {
    function handleKeyDown(event) {
      // Don't trigger hotkeys if typing in input/textarea
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (keyMap[key]) {
        event.preventDefault();
        keyMap[key](event);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyMap]);
}
