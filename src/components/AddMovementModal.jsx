// V1.0
// AddMovementModal.jsx
// 快速新增訓練動作 Modal

import React, { useState, useEffect, useMemo } from 'react';
import { ListPlus } from 'lucide-react';
import ModalContainer from './ModalContainer';

function AddMovementModal({
  isOpen,
  onClose,
  onAdd,
  movementDB,
}) {
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedMove, setSelectedMove] = useState('');

  const muscleGroups = useMemo(() => {
    return Array.from(
      new Set(movementDB.map((m) => m.bodyPart || m.mainMuscle))
    )
      .filter(Boolean)
      .sort();
  }, [movementDB]);

  const filteredMovements = useMemo(() => {
    if (!selectedMuscle) return [];

    return movementDB
      .filter((m) => (m.bodyPart || m.mainMuscle) === selectedMuscle)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [movementDB, selectedMuscle]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMuscle('');
      setSelectedMove('');
    }
  }, [isOpen]);

  return (
    <ModalContainer isOpen={isOpen} onClose={onClose}>
      <div className="bg-white p-6">
        <h3 className="text-xl font-bold text-indigo-600 flex items-center border-b pb-2">
          <ListPlus className="w-6 h-6 mr-2" />
          快速新增動作
        </h3>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              1. 選擇部位
            </label>

            <select
              value={selectedMuscle}
              onChange={(e) => {
                setSelectedMuscle(e.target.value);
                setSelectedMove('');
              }}
              className="w-full p-2 border rounded-lg"
            >
              <option value="" disabled>
                -- 請選擇 --
              </option>

              {muscleGroups.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              2. 選擇動作
            </label>

            <select
              value={selectedMove}
              onChange={(e) => setSelectedMove(e.target.value)}
              className="w-full p-2 border rounded-lg"
              disabled={!selectedMuscle}
            >
              <option value="" disabled>
                -- 請選擇 --
              </option>

              {filteredMovements.map((m) => (
                <option key={m.id || m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-lg"
            >
              取消
            </button>

            <button
              onClick={() => onAdd(selectedMove)}
              disabled={!selectedMove}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              確認新增
            </button>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
}

export default AddMovementModal;