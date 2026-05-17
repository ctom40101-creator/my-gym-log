// V1.0
// HistoryScreen.jsx
// 詳細歷史紀錄頁面

import React from 'react';
import { Trash2, RotateCcw, ChevronDown } from 'lucide-react';

function HistoryScreen({
  logDB,
  handleClearAllLogs,
  handleDeleteLog,
  calculateTotalVolume,
}) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-700">詳細歷史紀錄</h3>
        <button
          onClick={handleClearAllLogs}
          className="text-xs text-red-400 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
        >
          清空所有紀錄(測試用)
        </button>
      </div>

      {logDB.length === 0 ? (
        <p className="text-center text-gray-400 py-10">尚無紀錄</p>
      ) : (
        logDB.map((log) => (
          <div
            key={log.id}
            className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 ${
              log.isReset ? 'border-l-4 border-yellow-400 bg-yellow-50' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-bold text-gray-800 text-lg">
                  {new Date(log.date).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(log.date).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              <button
                onClick={() => handleDeleteLog(log.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {log.photo && (
              <div className="mb-3">
                <img
                  src={log.photo}
                  alt="Session Record"
                  className="w-full h-40 object-cover rounded-lg border border-gray-200"
                />
              </div>
            )}

            {log.isReset ? (
              <div className="text-sm text-yellow-800 font-bold flex items-center">
                <RotateCcw className="w-4 h-4 mr-1" />
                重置動作：{log.movementName} {'->'} {log.resetWeight}kg
              </div>
            ) : (
              <div className="space-y-2">
                {log.movements?.map((m, i) => (
                  <details key={i} className="text-sm group">
                    <summary className="cursor-pointer list-none flex justify-between items-center py-1 border-b border-gray-50 hover:bg-gray-50 px-1 rounded">
                      <span className="font-medium text-gray-700">
                        {m.movementName}
                      </span>

                      <span className="text-gray-500 text-xs">
                        {calculateTotalVolume(m.sets)}kg
                        <ChevronDown className="w-3 h-3 inline group-open:rotate-180 transition-transform" />
                      </span>
                    </summary>

                    <div className="pl-2 py-2 bg-gray-50 mt-1 rounded text-xs text-gray-600 grid grid-cols-2 gap-1">
                      {m.sets.map((s, si) => (
                        <div key={si}>
                          S{si + 1}: {s.weight}kg x {s.reps}
                        </div>
                      ))}

                      {m.note && (
                        <div className="col-span-2 text-indigo-600 mt-1">
                          📝 {m.note}
                        </div>
                      )}
                    </div>
                  </details>
                ))}

                <div className="text-right text-xs font-bold text-indigo-400 mt-2">
                  總容量: {log.overallVolume} kg
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default HistoryScreen;