// V1.0
// ModalContainer.jsx
// 共用 Modal 容器

import React from 'react';

function ModalContainer({
  isOpen,
  onClose,
  children,
}) {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">

      <div
        className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">

        <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg w-full">

          {children}

        </div>
      </div>
    </div>
  );
}

export default ModalContainer;