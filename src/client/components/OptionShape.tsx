import React from 'react';

interface OptionShapeProps {
  index: number;
  className?: string;
}

export const OptionShape: React.FC<OptionShapeProps> = ({
  index,
  className = 'w-5 h-5',
}) => {
  switch (index) {
    case 0:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
          <path d="M12 3L22 20H2L12 3Z" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
          <path d="M12 2L22 12L12 22L2 12L12 2Z" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
        </svg>
      );
  }
};
