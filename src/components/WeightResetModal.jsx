// V1.0
// WeightResetModal.jsx
// 重置訓練重量 Modal

import React, { useState, useEffect } from 'react';
import { RotateCcw, Scale } from 'lucide-react';
import ModalContainer from './ModalContainer';

function WeightResetModal({
  state,
  onClose,
  onConfirm,
}) {

  const [weight, setWeight] = useState(state.initialWeight);

  useEffect(() => {
    setWeight(state.initialWeight);
  }, [state.initialWeight]);

  return (
    <ModalContainer
      isOpen={state.isOpen}
      onClose={onClose}
    >

      <div className="bg-white p-6">

        <h3 className="text-xl font-bold text-red-600 flex items-center border-b pb-2">
          <RotateCcw className="w-6 h-6 mr-2" />
          重置訓練進度
        </h3>

        <p className="text-gray-700 mt-4">
          您確定要重置 **{state.movementName}** 的重量嗎？
        </p>

        <div className="flex items-center space-x-2 mt-4">

          <Scale className="w-6 h-6 text-indigo-500" />

          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="flex-grow p-3 border-2 border-indigo-300 rounded-lg text-lg font-bold text-center"
            min="0"
            autoFocus
          />

          <span className="text-lg font-bold text-gray-700">
            KG
          </span>
        </div>

        <div className="flex justify-end space-x-3 pt-4">

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg"
          >
            取消
          </button>

          <button
            onClick={() => onConfirm(state.movementName, weight)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            確認重置
          </button>

        </div>
      </div>
    </ModalContainer>
  );
}

export default WeightResetModal;