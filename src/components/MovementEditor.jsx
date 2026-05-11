// V1.0
// MovementEditor.jsx
// 動作新增 / 編輯 Modal

import React from 'react';
import { Sparkles, Copy, Loader2 } from 'lucide-react';
import ModalContainer from './ModalContainer';

function MovementEditor({
  isOpen,
  onClose,
  onSave,
  data,
  onChange,
  isProcessing,
}) {
  const types = ['推', '拉', '腿', '核心'];
  const bodyParts = ['胸', '背', '腿', '肩', '手臂', '核心', '全身'];

  const aiPrompt = data.name
    ? `${data.name}條列式告訴我：1.確認英文名稱為何或是否正確、2.如果動作類型有推、拉、腿、核心，這個動作會是哪一種、3.如果訓練部位有胸、背、腿、肩、核心、手臂、全身，這個動作會是哪種、4.主要肌群以不加英文單純敘述的方式告訴我是哪裡、5.協同肌群也是、6.最後我想知道這個動作的提示與要點，但這部分就以不分段不條列的方式敘述即可`
    : '';

  const handleCopyPrompt = () => {
    if (!aiPrompt) return;

    const textArea = document.createElement('textarea');
    textArea.value = aiPrompt;
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      alert('已複製提示詞！請貼上至 ChatGPT。');
    } catch (err) {
      console.error('複製失敗', err);
    }

    document.body.removeChild(textArea);
  };

  return (
    <ModalContainer isOpen={isOpen} onClose={onClose}>
      <div className="bg-white p-6 relative">
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-80 z-50 flex flex-col items-center justify-center rounded-xl">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
            <span className="font-bold text-indigo-600">
              更新所有歷史紀錄中...
            </span>
            <span className="text-xs text-gray-500 mt-1">
              請勿關閉視窗
            </span>
          </div>
        )}

        <h3 className="text-2xl font-bold text-indigo-600 border-b pb-2">
          {data.id ? '編輯動作' : '新增動作'}
        </h3>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              動作名稱 <span className="text-red-500">*</span>
            </label>

            <input
              type="text"
              value={data.name}
              onChange={(e) => onChange('name', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-500 font-medium"
              placeholder="例如：寬握槓片划船"
            />

            {data.id && data.id !== data.name && (
              <p className="text-xs text-orange-500 mt-1 font-bold">
                ⚠️ 修改名稱將會同步更新所有歷史紀錄與菜單，需花費一點時間。
              </p>
            )}
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-grow">
              <label className="block text-xs font-bold text-gray-500 mb-1">
                類型 <span className="text-red-500">*</span>
              </label>

              <select
                value={data.type || ''}
                onChange={(e) => onChange('type', e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
              >
                <option value="" disabled>
                  -- 請選擇 --
                </option>

                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-grow">
              <label className="block text-xs font-bold text-gray-500 mb-1">
                訓練部位 <span className="text-red-500">*</span>
              </label>

              <select
                value={data.bodyPart || ''}
                onChange={(e) => onChange('bodyPart', e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"
              >
                <option value="" disabled>
                  -- 請選擇 --
                </option>

                {bodyParts.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              主要肌群 (細項)
            </label>

            <input
              type="text"
              value={data.mainMuscle}
              onChange={(e) => onChange('mainMuscle', e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg"
              placeholder="例如：背闊肌上部"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">
              協同肌群
            </label>

            <input
              type="text"
              value={data.secondaryMuscle}
              onChange={(e) => onChange('secondaryMuscle', e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg"
              placeholder="例如：斜方肌"
            />
          </div>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              初始建議重量 (KG)
            </label>

            <input
              type="number"
              value={data.initialWeight}
              onChange={(e) => onChange('initialWeight', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              動作提示/要點
            </label>

            <textarea
              value={data.tips}
              onChange={(e) => onChange('tips', e.target.value)}
              rows="3"
              className="w-full p-2 border border-gray-300 rounded-lg"
              placeholder="動作要點..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              影片連結
            </label>

            <input
              type="url"
              value={data.link}
              onChange={(e) => onChange('link', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
              placeholder="YouTube URL"
            />
          </div>

          {data.name && (
            <div className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-bold text-indigo-700 flex items-center">
                  <Sparkles className="w-4 h-4 mr-1" />
                  建議於 AI 搜尋
                </h4>

                <button
                  onClick={handleCopyPrompt}
                  className="text-xs flex items-center bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  複製
                </button>
              </div>

              <div className="bg-white p-3 rounded-lg border border-indigo-100 text-xs text-gray-600 leading-relaxed break-all">
                {aiPrompt}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300"
          >
            取消
          </button>

          <button
            onClick={onSave}
            disabled={isProcessing}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700"
          >
            儲存動作
          </button>
        </div>
      </div>
    </ModalContainer>
  );
}

export default MovementEditor;