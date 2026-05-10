// V1.0
// MovementLogCard.jsx
// 單一訓練動作紀錄卡片

import React, { useMemo } from 'react';
import { ListChecks, PlayCircle, RotateCcw, TrendingUp } from 'lucide-react';
import { calculateTotalVolume } from '../utils/calculations';

function MovementLogCard({
  move,
  index,
  weightHistory,
  movementDB,
  handleSetUpdate,
  handleNoteUpdate,
  handleRpeUpdate,
  openResetModal,
  RpeSelectorAlwaysVisible,
}) {
  const history = weightHistory[move.movementName] || {};
  const lastRecord = history.lastRecord;
  const lastNote = history.lastNote;
  const suggestion =
    history.suggestion ||
    (movementDB.find((m) => m.name === move.movementName)?.initialWeight || 20);

  const totalVolume = calculateTotalVolume(move.sets);
  const movementDetail =
    movementDB.find((m) => m.name === move.movementName) || {};

  const repsOptions = useMemo(
    () => Array.from({ length: 20 }, (_, i) => 20 - i),
    []
  );

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500 space-y-3">
      <div className="flex justify-between items-start border-b pb-2 mb-2">
        <h4 className="text-lg font-bold text-gray-800">
          {move.movementName}
        </h4>

        <div className="flex space-x-3 items-center">
          <details className="relative group">
            <summary className="text-indigo-500 cursor-pointer list-none flex items-center text-xs">
              <ListChecks className="w-4 h-4 mr-1" />
              指引
            </summary>

            <div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white border rounded-xl shadow-2xl z-20 hidden group-open:block">
              <p className="font-bold text-gray-800 text-sm">提示:</p>
              <p className="text-xs text-gray-600 mb-2">
                {movementDetail.tips || '無'}
              </p>

              {movementDetail.link && (
                <div className="mb-2">
                  <a
                    href={movementDetail.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 underline flex items-center"
                  >
                    <PlayCircle className="w-3 h-3 mr-1" />
                    觀看教學影片
                  </a>
                </div>
              )}

              <div className="text-xs text-gray-500 border-t pt-2">
                <p>部位: {movementDetail.bodyPart}</p>
                <p>肌群: {movementDetail.mainMuscle}</p>
              </div>
            </div>
          </details>

          <button
            onClick={() => openResetModal(move.movementName)}
            className="text-red-400 text-xs flex items-center"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            重置
          </button>
        </div>
      </div>

      <div className="flex justify-between text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg">
        <div className="flex items-center">
          <TrendingUp className="w-4 h-4 mr-1 text-indigo-600" />
          <span className="font-semibold">建議:</span>
          <span className="ml-1 text-lg font-extrabold text-indigo-800">
            {suggestion}kg
          </span>
        </div>

        <div className="text-right text-xs">
          上次
          <br />
          <span className="font-medium text-gray-800">
            {lastRecord ? `${lastRecord.weight}kg x ${lastRecord.reps}` : '無'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {move.sets.map((set, si) => (
          <div key={si} className="flex items-center space-x-2">
            <span className="w-8 text-xs text-gray-400 font-bold">
              S{si + 1}
            </span>

            <div className="flex-grow flex space-x-2">
              <input
                type="number"
                value={set.weight}
                onChange={(e) =>
                  handleSetUpdate(index, si, 'weight', e.target.value)
                }
                className="w-full p-2 border rounded-lg text-center font-bold"
              />

              <select
                value={set.reps}
                onChange={(e) =>
                  handleSetUpdate(index, si, 'reps', e.target.value)
                }
                className="w-full p-2 border rounded-lg text-center font-bold bg-white"
              >
                {repsOptions.map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <RpeSelectorAlwaysVisible
        value={move.rpe || 8}
        onChange={(v) => handleRpeUpdate(index, v)}
      />

      <div className="text-gray-600 mt-2 space-y-2">
        {lastNote && (
          <div className="bg-yellow-50 p-2 rounded-lg text-xs border border-yellow-100">
            上次: {history.lastNote}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            placeholder="心得..."
            value={move.note || ''}
            onChange={(e) => handleNoteUpdate(index, e.target.value)}
            rows="1"
            className="flex-grow p-2 border rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="text-right text-xs font-bold text-indigo-400">
        總量: {totalVolume} kg
      </div>
    </div>
  );
}

export default MovementLogCard;