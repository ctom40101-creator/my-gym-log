// V1.0
// LoadingSpinner.jsx
// 共用載入中動畫元件

import React from 'react';
import { Loader2 } from 'lucide-react';

function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClass = {
    sm: 'w-3 h-3',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };

  return (
    <Loader2 className={`${sizeClass[size]} animate-spin ${className}`} />
  );
}

export default LoadingSpinner;