// V1.0
// OverviewScreen.jsx
// 健身概況頁面

import React from 'react';
import { PieChart } from 'lucide-react';

function OverviewScreen({ stats }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500">
          <div className="text-gray-500 text-xs font-bold uppercase">
            本月訓練
          </div>

          <div className="text-3xl font-extrabold text-indigo-600 mt-1">
            {stats.monthCount}
            <span className="text-sm font-normal text-gray-400"> 次</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-pink-500">
          <div className="text-gray-500 text-xs font-bold uppercase">
            近7天容量
          </div>

          <div className="text-3xl font-extrabold text-pink-600 mt-1">
            {(stats.weekVolume / 1000).toFixed(1)}k
            <span className="text-sm font-normal text-gray-400"> kg</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow-lg">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
          <PieChart className="w-5 h-5 mr-2 text-indigo-500" />
          近期部位分佈
        </h3>

        <div className="space-y-3">
          {stats.muscleSplitPercent.length === 0 ? (
            <p className="text-gray-400 text-sm">尚無足夠數據</p>
          ) : (
            stats.muscleSplitPercent.map((m, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">
                    {m.name}
                  </span>

                  <span className="font-bold text-gray-500">
                    {m.percent}%
                  </span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full"
                    style={{ width: `${m.percent}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default OverviewScreen;