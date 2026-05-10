// V1.0
// StrengthScreen.jsx
// 肌力分析頁面

import React from 'react';

function StrengthScreen({
  selectedMovement,
  setSelectedMovement,
  movementDB,
  strengthData,
  renderLineChart,
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          選擇動作分析 1RM
        </label>

        <select
          value={selectedMovement}
          onChange={(e) => setSelectedMovement(e.target.value)}
          className="w-full p-3 border rounded-lg bg-gray-50"
        >
          <option value="" disabled>
            -- 請選擇 --
          </option>

          {movementDB.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {selectedMovement && (
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <h3 className="font-bold text-gray-800 mb-4 text-center">
            {selectedMovement} 估算 1RM 趨勢
          </h3>

          <div className="h-48 w-full">
            {renderLineChart(
              strengthData,
              'e1rm',
              'date',
              '#4f46e5'
            )}
          </div>
        </div>
      )}

      {!selectedMovement && (
        <div className="text-center text-gray-400 mt-10">
          請選擇一個動作以查看分析圖表
        </div>
      )}
    </div>
  );
}

export default StrengthScreen;