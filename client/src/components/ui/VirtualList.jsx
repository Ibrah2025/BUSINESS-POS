import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Lightweight virtual scrolling list for long lists on low-end devices.
 * Only renders visible items plus a buffer to keep DOM small.
 */
export default function VirtualList({
  items,
  renderItem,
  itemHeight = 60,
  containerHeight = 480,
  buffer = 10,
  className = '',
}) {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const endIndex = Math.min(items.length, startIndex + visibleCount + buffer * 2);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Reset scroll when items change drastically
  useEffect(() => {
    if (containerRef.current && scrollTop > totalHeight) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={className}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {items.slice(startIndex, endIndex).map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
