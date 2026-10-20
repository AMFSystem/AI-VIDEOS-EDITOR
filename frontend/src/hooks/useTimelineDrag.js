import { useState, useCallback } from "react";

export function useTimelineDrag(onDragChange) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);

  const startDrag = useCallback((e) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
  }, []);

  const onDrag = useCallback(
    (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      if (onDragChange) onDragChange(deltaX);
    },
    [isDragging, dragStartX, onDragChange]
  );

  const endDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  return { isDragging, startDrag, onDrag, endDrag };
}
