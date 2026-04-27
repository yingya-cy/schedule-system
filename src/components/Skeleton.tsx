import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
}

export default function Skeleton({
  className = '',
  width,
  height,
  variant = 'rectangular'
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-surface-container-low';

  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={style}
    />
  );
}

// Preset skeleton components
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl border border-surface-container-high p-5 space-y-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Skeleton width={48} height={48} variant="rectangular" className="rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} variant="text" className="w-3/4" />
          <Skeleton height={12} variant="text" className="w-1/2" />
        </div>
      </div>
      <Skeleton height={40} variant="rectangular" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high overflow-hidden">
      {/* Header */}
      <div className="grid gap-4 p-4 border-b border-surface-container-high bg-surface-container-low/50">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} height={16} variant="text" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 p-4 border-b border-surface-container-high/50 last:border-b-0">
          {Array.from({ length: cols }, (_, colIndex) => (
            <Skeleton key={colIndex} height={14} variant="text" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}