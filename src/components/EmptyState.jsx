// V1.0
// EmptyState.jsx
// 共用空資料提示元件

import React from 'react';

function EmptyState({ children }) {
  return (
    <p className="text-center text-gray-500">
      {children}
    </p>
  );
}

export default EmptyState;