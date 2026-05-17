// V1.0
// RpeSelectorAlwaysVisible.jsx
// RPE 評級選擇器

import React, { useMemo } from 'react';

function RpeSelectorAlwaysVisible({ value, onChange }) {

  const rpeValues = useMemo(() => {
    const v = [];

    for (let i = 50; i <= 100; i += 5) {
      v.push(i / 10);
    }

    return v;
  }, []);

  const feeling = [
    { r: 10, t: '極限' },
    { r: 9, t: '非常難' },
    { r: 8, t: '困難' },
    { r: 7, t: '中等' },
    { r: 6, t: '輕鬆' },
    { r: 5, t: '熱身' },
  ].find((d) => d.r === Math.floor(parseFloat(value)))?.t || '';

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">

      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-bold text-gray-700">
          RPE 感受評級

          <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
            {feeling}
          </span>
        </span>

        <span className="text-lg font-extrabold text-indigo-600">
          {value}
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1 overflow-x-auto pb-1">
        {rpeValues.map((r) => (
          <button
            key={r}
            onClick={() => onChange(r.toFixed(1))}
            className={`flex-shrink-0 px-1 py-2 rounded-lg text-xs font-bold border ${
              parseFloat(value) === r
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500'
            }`}
          >
            {r.toFixed(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default RpeSelectorAlwaysVisible;