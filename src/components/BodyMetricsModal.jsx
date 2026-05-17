// V1.0
// BodyMetricsModal.jsx
// 快速紀錄體重與體脂 Modal

import React, { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';

function BodyMetricsModal({ isOpen, onClose, onSave, ModalContainer }) {
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));

  useEffect(() => {
    if (isOpen) {
      setWeight('');
      setBodyFat('');
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave(date, weight, bodyFat);
    onClose();
  };

  return (
    <ModalContainer isOpen={isOpen} onClose={onClose}>
      <div className="bg-white p-6">
        <h3 className="text-xl font-bold text-indigo-600 flex items-center border-b pb-2">
          <Activity className="w-6 h-6 mr-2" />
          快速紀錄 (Log頁面)
        </h3>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-1">體重 (KG)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full p-2 border rounded-lg"
                step="0.1"
              />
            </div>

            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-1">體脂 (%)</label>
              <input
                type="number"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-full p-2 border rounded-lg"
                step="0.1"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">
              取消
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
              儲存
            </button>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
}

export default BodyMetricsModal;