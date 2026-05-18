// V1.1
// AddMovementModal.jsx
// 快速新增訓練動作 Modal

import React, { useState, useEffect, useMemo } from 'react';
import { ListPlus } from 'lucide-react';
import ModalContainer from './ModalContainer';

const DEFAULT_EQUIPMENT_SOURCE = '健身房通用';

function getEquipmentSource(movement) {
  return movement?.equipmentSource || DEFAULT_EQUIPMENT_SOURCE;
}

function AddMovementModal({
  isOpen,
  onClose,
  onAdd,
  movementDB,
}) {
  const [selectedMuscle, setSelectedMuscle] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedMove, setSelectedMove] = useState('');

  const muscleGroups = useMemo(() => {
    return Array.from(
      new Set(movementDB.map((m) => m.bodyPart || m.mainMuscle))
    )
      .filter(Boolean)
      .sort();
  }, [movementDB]);

  const sourceOptions = useMemo(() => {
    const candidates = selectedMuscle
      ? movementDB.filter((m) => (m.bodyPart || m.mainMuscle) === selectedMuscle)
      : movementDB;

    return Array.from(new Set(candidates.map((m) => getEquipmentSource(m))))
      .filter(Boolean)
      .sort((a, b) => {
        if (a === DEFAULT_EQUIPMENT_SOURCE) return -1;
        if (b === DEFAULT_EQUIPMENT_SOURCE) return 1;
        return a.localeCompare(b, 'zh-Hant');
      });
  }, [movementDB, selectedMuscle]);

  const filteredMovements = useMemo(() => {
    if (!selectedMuscle) return [];

    return movementDB
      .filter((m) => (m.bodyPart || m.mainMuscle) === selectedMuscle)
      .filter((m) => !selectedSource || getEquipmentSource(m) === selectedSource)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
  }, [movementDB, selectedMuscle, selectedSource]);

  const selectedMovementDetail = useMemo(() => {
    return movementDB.find((m) => m.name === selectedMove);
  }, [movementDB, selectedMove]);

  useEffect(() => {
    if (isOpen) {
      setSelectedMuscle('');
      setSelectedSource('');
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
                setSelectedSource('');
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
              2. 篩選器材來源
            </label>

            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setSelectedMove('');
              }}
              className="w-full p-2 border rounded-lg bg-white"
              disabled={!selectedMuscle}
            >
              <option value="">全部器材來源</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              3. 選擇動作
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
                  {m.name}｜來源：{getEquipmentSource(m)}
                </option>
              ))}
            </select>
          </div>

          {selectedMovementDetail && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg text-sm text-teal-800">
              <div className="font-bold">已選：{selectedMovementDetail.name}</div>
              <div className="text-xs mt-1">器材來源：{getEquipmentSource(selectedMovementDetail)}</div>
              {(selectedMovementDetail.mainMuscle || selectedMovementDetail.secondaryMuscle) && (
                <div className="text-xs mt-1 text-teal-700">
                  {selectedMovementDetail.mainMuscle || ''}
                  {selectedMovementDetail.secondaryMuscle ? ` / 協同：${selectedMovementDetail.secondaryMuscle}` : ''}
                </div>
              )}
            </div>
          )}

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
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:bg-gray-300"
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
