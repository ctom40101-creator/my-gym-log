import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged, 
  EmailAuthProvider, 
  linkWithCredential, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  deleteUser 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, getDocs, orderBy, limit, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import {
  Dumbbell, Menu, NotebookText, BarChart3, ListChecks, ArrowLeft, RotateCcw, TrendingUp,
  Weight, Calendar, Sparkles, AlertTriangle, Armchair, Plus, Trash2, Edit, Save, X, Scale, ListPlus, ChevronDown, CheckCircle, Info, Wand2, MousePointerClick, Crown, Activity, User, PenSquare, Trophy, Timer, Copy, ShieldCheck, LogIn, LogOut, Loader2, Bug, Smartphone, Mail, Lock, KeyRound, UserX, CheckSquare, Square, FileSpreadsheet, Upload, Download, Undo2, PlayCircle, LineChart, PieChart, History, Eraser, Shield, RefreshCw, GripVertical, Camera, Image as ImageIcon, ChevronUp, Grid, ClipboardCopy
} from 'lucide-react';

// --- 您的專屬 Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyBsHIPtSV_wRioxBKYOqzgLGwZHWWfZcNc",
  authDomain: "mygymlog-604bc.firebaseapp.com",
  projectId: "mygymlog-604bc",
  storageBucket: "mygymlog-604bc.firebasestorage.app",
  messagingSenderId: "980701704046",
  appId: "1:980701704046:web:22a2b1a727fa511107db7f",
  measurementId: "G-MPXB8R0L6H"
};

// --- 初始化 Firebase ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = 'mygymlog-604bc'; 
const initialAuthToken = null; 

// --- 管理員設定 ---
const ADMIN_EMAIL = 'ctom40101@gmail.com';

// --- 預設動作資料 ---
const DEFAULT_MOVEMENTS = [
  { name: '平板槓鈴臥推', type: '推', bodyPart: '胸', mainMuscle: '胸大肌', secondaryMuscle: '前三角肌、肱三頭肌', tips: '收緊肩胛骨，手腕保持中立', initialWeight: 20 },
  { name: '槓鈴深蹲', type: '腿', bodyPart: '腿', mainMuscle: '股四頭肌', secondaryMuscle: '臀大肌、核心', tips: '膝蓋對準腳尖，核心收緊', initialWeight: 20 },
  { name: '傳統硬舉', type: '拉', bodyPart: '背', mainMuscle: '下背、臀大肌', secondaryMuscle: '腿後腱、握力', tips: '槓鈴貼近脛骨，背部打直', initialWeight: 40 },
  { name: '站姿槓鈴肩推', type: '推', bodyPart: '肩', mainMuscle: '三角肌前束', secondaryMuscle: '肱三頭肌', tips: '核心收緊避免下背過度反折', initialWeight: 20 },
  { name: '引體向上', type: '拉', bodyPart: '背', mainMuscle: '背闊肌', secondaryMuscle: '肱二頭肌', tips: '肩胛骨下沈，下巴過槓', initialWeight: 0 },
  { name: '啞鈴二頭彎舉', type: '拉', bodyPart: '手臂', mainMuscle: '肱二頭肌', secondaryMuscle: '前臂', tips: '大臂夾緊身體', initialWeight: 5 },
  { name: '滑輪三頭下壓', type: '推', bodyPart: '手臂', mainMuscle: '肱三頭肌', secondaryMuscle: '無', tips: '手肘固定身側', initialWeight: 10 },
  { name: '棒式', type: '核心', bodyPart: '核心', mainMuscle: '腹橫肌', secondaryMuscle: '多裂肌', tips: '身體呈一直線，不塌腰', initialWeight: 0 },
  { name: '啞鈴側平舉', type: '推', bodyPart: '肩', mainMuscle: '三角肌中束', secondaryMuscle: '斜方肌', tips: '手肘微彎，像倒水一樣舉起', initialWeight: 5 },
  { name: '坐姿划船', type: '拉', bodyPart: '背', mainMuscle: '背闊肌、斜方肌', secondaryMuscle: '肱二頭肌', tips: '挺胸，專注背部擠壓', initialWeight: 20 },
];

// --- RPE 漸進式負荷參數 ---
const RPE_UP_THRESHOLD = 7;      
const RPE_DOWN_THRESHOLD = 9.5; 
const WEIGHT_INCREASE_MULTIPLIER = 1.025; 
const WEIGHT_DECREASE_MULTIPLIER = 0.975; 

// ----------------------------------------------------
// 核心工具函式
// ----------------------------------------------------

const calculateTotalVolume = (log) => {
    return log.reduce((total, set) => total + (set.reps * set.weight), 0);
};

const estimate1RM = (weight, reps) => {
    if (weight === 0) return 0;
    if (reps === 1) return weight;
    if (reps >= 15) return weight; 
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
};

// 圖片壓縮工具 (轉 Base64, 限制最大寬度與品質以節省空間)
const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // 限制最大寬度
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // 轉為 JPEG, 品質 0.6
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

// ----------------------------------------------------
// 獨立元件區
// ----------------------------------------------------

// 通用模態框容器
const ModalContainer = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg w-full">
                    {children}
                </div>
            </div>
        </div>
    );
};

// 1. 身體數據模態框
const BodyMetricsModal = ({ isOpen, onClose, onSave }) => {
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10));

    useEffect(() => { if (isOpen) { setWeight(''); setBodyFat(''); } }, [isOpen]);

    const handleSave = () => { onSave(date, weight, bodyFat); onClose(); };

    return (
        <ModalContainer isOpen={isOpen} onClose={onClose}>
            <div className="bg-white p-6">
                <h3 className="text-xl font-bold text-indigo-600 flex items-center border-b pb-2"><Activity className="w-6 h-6 mr-2" />快速紀錄 (Log頁面)</h3>
                <div className="space-y-4 mt-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                    <div className="flex gap-4">
                        <div className="w-1/2"><label className="block text-sm font-medium text-gray-700 mb-1">體重 (KG)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div>
                        <div className="w-1/2"><label className="block text-sm font-medium text-gray-700 mb-1">體脂 (%)</label><input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">儲存</button></div>
                </div>
            </div>
        </ModalContainer>
    );
};

// 2. 重置重量模態框
const WeightResetModal = ({ state, onClose, onConfirm }) => {
    const [weight, setWeight] = useState(state.initialWeight);
    useEffect(() => { setWeight(state.initialWeight); }, [state.initialWeight]);

    return (
        <ModalContainer isOpen={state.isOpen} onClose={onClose}>
            <div className="bg-white p-6">
                <h3 className="text-xl font-bold text-red-600 flex items-center border-b pb-2"><RotateCcw className="w-6 h-6 mr-2" />重置訓練進度</h3>
                <p className="text-gray-700 mt-4">您確定要重置 **{state.movementName}** 的重量嗎？</p>
                <div className="flex items-center space-x-2 mt-4"><Scale className="w-6 h-6 text-indigo-500" /><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="flex-grow p-3 border-2 border-indigo-300 rounded-lg text-lg font-bold text-center" min="0" autoFocus /><span className="text-lg font-bold text-gray-700">KG</span></div>
                <div className="flex justify-end space-x-3 pt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={() => onConfirm(state.movementName, weight)} className="px-4 py-2 bg-red-600 text-white rounded-lg">確認重置</button></div>
            </div>
        </ModalContainer>
    );
};

// 3. 快速新增動作模態框
const AddMovementModal = ({ isOpen, onClose, onAdd, movementDB }) => {
    const [selectedMuscle, setSelectedMuscle] = useState('');
    const [selectedMove, setSelectedMove] = useState('');
    const muscleGroups = useMemo(() => Array.from(new Set(movementDB.map(m => m.bodyPart || m.mainMuscle))).filter(Boolean).sort(), [movementDB]);
    const filteredMovements = useMemo(() => !selectedMuscle ? [] : movementDB.filter(m => (m.bodyPart || m.mainMuscle) === selectedMuscle).sort((a, b) => a.name.localeCompare(b.name)), [movementDB, selectedMuscle]);

    useEffect(() => { if (isOpen) { setSelectedMuscle(''); setSelectedMove(''); } }, [isOpen]);

    return (
        <ModalContainer isOpen={isOpen} onClose={onClose}>
            <div className="bg-white p-6">
                <h3 className="text-xl font-bold text-indigo-600 flex items-center border-b pb-2"><ListPlus className="w-6 h-6 mr-2" />快速新增動作</h3>
                <div className="space-y-4 mt-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">1. 選擇部位</label><select value={selectedMuscle} onChange={(e) => {setSelectedMuscle(e.target.value); setSelectedMove('');}} className="w-full p-2 border rounded-lg"><option value="" disabled>-- 請選擇 --</option>{muscleGroups.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">2. 選擇動作</label><select value={selectedMove} onChange={(e) => setSelectedMove(e.target.value)} className="w-full p-2 border rounded-lg" disabled={!selectedMuscle}><option value="" disabled>-- 請選擇 --</option>{filteredMovements.map(m => <option key={m.id || m.name} value={m.name}>{m.name}</option>)}</select></div>
                    <div className="flex justify-end space-x-3 pt-4 border-t"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={() => onAdd(selectedMove)} disabled={!selectedMove} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">確認新增</button></div>
                </div>
            </div>
        </ModalContainer>
    );
};

// 4. RPE 選擇器
const RpeSelectorAlwaysVisible = ({ value, onChange }) => {
    const rpeValues = useMemo(() => { const v = []; for (let i = 50; i <= 100; i += 5) v.push(i / 10); return v; }, []);
    const feeling = [{r:10,t:'極限'},{r:9,t:'非常難'},{r:8,t:'困難'},{r:7,t:'中等'},{r:6,t:'輕鬆'},{r:5,t:'熱身'}].find(d=>d.r===Math.floor(parseFloat(value)))?.t||'';
    return (
        <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-gray-700">RPE 感受評級 <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{feeling}</span></span><span className="text-lg font-extrabold text-indigo-600">{value}</span></div>
            <div className="grid grid-cols-6 gap-1 overflow-x-auto pb-1">{rpeValues.map((r) => <button key={r} onClick={() => onChange(r.toFixed(1))} className={`flex-shrink-0 px-1 py-2 rounded-lg text-xs font-bold border ${parseFloat(value)===r ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>{r.toFixed(1)}</button>)}</div>
        </div>
    );
};

// 6. 動作編輯器
const MovementEditor = ({ isOpen, onClose, onSave, data, onChange, isProcessing }) => {
    const types = ['推', '拉', '腿', '核心'];
    const bodyParts = ['胸', '背', '腿', '肩', '手臂', '核心', '全身']; 
    
    const aiPrompt = data.name ? `${data.name}條列式告訴我：1.確認英文名稱為何或是否正確、2.如果動作類型有推、拉、腿、核心，這個動作會是哪一種、3.如果訓練部位有胸、背、腿、肩、核心、手臂、全身，這個動作會是哪種、4.主要肌群以不加英文單純敘述的方式告訴我是哪裡、5.協同肌群也是、6.最後我想知道這個動作的提示與要點，但這部分就以不分段不條列的方式敘述即可` : '';

    const handleCopyPrompt = () => {
        if (!aiPrompt) return;
        const textArea = document.createElement("textarea");
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
                        <span className="font-bold text-indigo-600">更新所有歷史紀錄中...</span>
                        <span className="text-xs text-gray-500 mt-1">請勿關閉視窗</span>
                    </div>
                )}
                <h3 className="text-2xl font-bold text-indigo-600 border-b pb-2">{data.id ? '編輯動作' : '新增動作'}</h3>
                
                <div className="space-y-4 mt-4">
                    {/* 動作名稱 - 移除 disabled 限制 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">動作名稱 <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            value={data.name} 
                            onChange={(e) => onChange('name', e.target.value)} 
                            className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-500 font-medium" 
                            placeholder="例如：寬握槓片划船" 
                        />
                        {data.id && data.id !== data.name && <p className="text-xs text-orange-500 mt-1 font-bold">⚠️ 修改名稱將會同步更新所有歷史紀錄與菜單，需花費一點時間。</p>}
                    </div>

                    {/* 1. 類型 */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-grow">
                            <label className="block text-xs font-bold text-gray-500 mb-1">類型 <span className="text-red-500">*</span></label>
                            <select value={data.type || ''} onChange={(e) => onChange('type', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white">
                                <option value="" disabled>-- 請選擇 --</option>
                                {types.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* 2. 部位 */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-grow">
                            <label className="block text-xs font-bold text-gray-500 mb-1">訓練部位 <span className="text-red-500">*</span></label>
                            <select value={data.bodyPart || ''} onChange={(e) => onChange('bodyPart', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white">
                                <option value="" disabled>-- 請選擇 --</option>
                                {bodyParts.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* 3. 主要肌群 */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">主要肌群 (細項)</label>
                        <input type="text" value={data.mainMuscle} onChange={(e) => onChange('mainMuscle', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="例如：背闊肌上部" />
                    </div>

                    {/* 4. 協同肌群 */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">協同肌群</label>
                        <input type="text" value={data.secondaryMuscle} onChange={(e) => onChange('secondaryMuscle', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="例如：斜方肌" />
                    </div>

                    <div className="border-t pt-4"><label className="block text-sm font-medium text-gray-700 mb-1">初始建議重量 (KG)</label><input type="number" value={data.initialWeight} onChange={(e) => onChange('initialWeight', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" min="0" /></div>
                    
                    {/* 提示 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">動作提示/要點</label>
                        <textarea value={data.tips} onChange={(e) => onChange('tips', e.target.value)} rows="3" className="w-full p-2 border border-gray-300 rounded-lg" placeholder="動作要點..." />
                    </div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">影片連結</label><input type="url" value={data.link} onChange={(e) => onChange('link', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="YouTube URL" /></div>
                
                    {/* AI 搜尋建議區塊 */}
                    {data.name && (
                        <div className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-bold text-indigo-700 flex items-center"><Sparkles className="w-4 h-4 mr-1"/>建議於 AI 搜尋</h4>
                                <button onClick={handleCopyPrompt} className="text-xs flex items-center bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50"><Copy className="w-3 h-3 mr-1"/>複製</button>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-indigo-100 text-xs text-gray-600 leading-relaxed break-all">
                                {aiPrompt}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t"><button onClick={onClose} disabled={isProcessing} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">取消</button><button onClick={onSave} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">儲存動作</button></div>
            </div>
        </ModalContainer>
    );
};

const MovementLogCard = ({ move, index, weightHistory, movementDB, handleSetUpdate, handleNoteUpdate, handleRpeUpdate, openResetModal }) => {
    const history = weightHistory[move.movementName] || {};
    const lastRecord = history.lastRecord;
    const lastNote = history.lastNote; 
    const suggestion = history.suggestion || (movementDB.find(m => m.name === move.movementName)?.initialWeight || 20); 
    const totalVolume = calculateTotalVolume(move.sets);
    const movementDetail = movementDB.find(m => m.name === move.movementName) || {}; 

    // 建立 20 到 1 的次數陣列
    const repsOptions = useMemo(() => Array.from({length: 20}, (_, i) => 20 - i), []);

    return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500 space-y-3">
            <div className="flex justify-between items-start border-b pb-2 mb-2">
                <h4 className="text-lg font-bold text-gray-800">{move.movementName}</h4>
                <div className="flex space-x-3 items-center">
                    <details className="relative group"><summary className="text-indigo-500 cursor-pointer list-none flex items-center text-xs"><ListChecks className="w-4 h-4 mr-1"/>指引</summary><div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white border rounded-xl shadow-2xl z-20 hidden group-open:block"><p className="font-bold text-gray-800 text-sm">提示:</p><p className="text-xs text-gray-600 mb-2">{movementDetail.tips||'無'}</p>
                            {/* Add Video Link Here */}
                            {movementDetail.link && (
                                <div className="mb-2">
                                    <a href={movementDetail.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline flex items-center">
                                        <PlayCircle className="w-3 h-3 mr-1" /> 觀看教學影片
                                    </a>
                                </div>
                            )}<div className="text-xs text-gray-500 border-t pt-2"><p>部位: {movementDetail.bodyPart}</p><p>肌群: {movementDetail.mainMuscle}</p></div></div></details>
                    <button onClick={() => openResetModal(move.movementName)} className="text-red-400 text-xs flex items-center"><RotateCcw className="w-3 h-3 mr-1"/>重置</button>
                </div>
            </div>
            <div className="flex justify-between text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg">
                <div className="flex items-center"><TrendingUp className="w-4 h-4 mr-1 text-indigo-600" /><span className="font-semibold">建議:</span><span className="ml-1 text-lg font-extrabold text-indigo-800">{suggestion}kg</span></div>
                <div className="text-right text-xs">上次<br/><span className="font-medium text-gray-800">{lastRecord ? `${lastRecord.weight}kg x ${lastRecord.reps}` : '無'}</span></div>
            </div>
            <div className="space-y-2">{move.sets.map((set, si) => (<div key={si} className="flex items-center space-x-2"><span className="w-8 text-xs text-gray-400 font-bold">S{si+1}</span><div className="flex-grow flex space-x-2"><input type="number" value={set.weight} onChange={(e)=>handleSetUpdate(index,si,'weight',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold" /><select value={set.reps} onChange={(e)=>handleSetUpdate(index,si,'reps',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold bg-white">{repsOptions.map(num => <option key={num} value={num}>{num}</option>)}</select></div></div>))}</div>
            <RpeSelectorAlwaysVisible value={move.rpe || 8} onChange={(v) => handleRpeUpdate(index, v)} />
            
            {/* Note Section */}
            <div className="text-gray-600 mt-2 space-y-2">
                {lastNote && <div className="bg-yellow-50 p-2 rounded-lg text-xs border border-yellow-100">上次: {history.lastNote}</div>}
                
                <div className="flex gap-2">
                    <textarea placeholder="心得..." value={move.note || ''} onChange={(e) => handleNoteUpdate(index, e.target.value)} rows="1" className="flex-grow p-2 border rounded-lg text-sm" />
                </div>
            </div>

            <div className="text-right text-xs font-bold text-indigo-400">總量: {totalVolume} kg</div>
        </div>
    );
};

// ----------------------------------------------------
// AdminScreen
// ----------------------------------------------------
const AdminScreen = ({ db, appId }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch all documents from the PUBLIC UserIndex collection
            const q = query(collection(db, `artifacts/${appId}/public/data/UserIndex`));
            const snapshot = await getDocs(q);
            const userList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setUsers(userList);
        } catch (error) {
            console.error("Admin fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [db, appId]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleClearUserData = async (targetUserId) => {
        if (!confirm(`確定要清空用戶 ${targetUserId} 的所有資料嗎？ (這不會刪除帳號本身，只會刪除紀錄)`)) return;
        
        try {
            const collectionsToDelete = ['LogDB', 'BodyMetricsDB', 'MovementDB', 'PlansDB'];
            for (const colName of collectionsToDelete) {
                const q = query(collection(db, `artifacts/${appId}/users/${targetUserId}/${colName}`));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
            }
            alert("該用戶資料已清空。");
            fetchUsers();
        } catch (e) {
            console.error(e);
            alert("刪除失敗");
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 mb-4">
                <h3 className="font-bold text-red-800 flex items-center"><Shield className="w-5 h-5 mr-2"/> 管理員專區</h3>
                <p className="text-xs text-red-600 mt-1">此區域僅供管理員使用。您可以清空用戶的資料庫紀錄。</p>
            </div>

            {isLoading ? <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500"/></div> : (
                <div className="space-y-3">
                    {users.length === 0 ? <p className="text-center text-gray-500">沒有找到用戶資料 (需登入過才會建立)</p> : users.map(u => (
                        <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-gray-800">{u.nickname || '未命名用戶'}</div>
                                    <div className="text-xs text-gray-500">{u.email || '匿名/無Email'}</div>
                                    <div className="text-[10px] text-gray-400 font-mono mt-1">ID: {u.id}</div>
                                </div>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '未知時間'}
                                </span>
                            </div>
                            <div className="flex justify-end pt-2 border-t mt-2">
                                <button onClick={() => handleClearUserData(u.id)} className="text-xs bg-red-50 text-red-600 px-3 py-2 rounded-lg font-bold border border-red-100 flex items-center hover:bg-red-100">
                                    <Trash2 className="w-3 h-3 mr-1" /> 清空此用戶資料
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------
// ProfileScreen
// ----------------------------------------------------
const ProfileScreen = ({ bodyMetricsDB, userId, db, appId, logDB, auth }) => {
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const today = new Date().toISOString().substring(0, 10);
    const [date, setDate] = useState(today);
    const [isLoading, setIsLoading] = useState(false); 

    const [startDate, setStartDate] = useState('');
    const [baseTrainingDays, setBaseTrainingDays] = useState(0);
    const [nickname, setNickname] = useState(''); 

    const [user, setUser] = useState(auth?.currentUser);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); 
    const [isSetPasswordMode, setIsSetPasswordMode] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(false); 

    useEffect(() => {
        if(auth) {
            const unsub = onAuthStateChanged(auth, (u) => setUser(u));
            return () => unsub();
        }
    }, [auth]);

    const isEmailLinked = useMemo(() => {
        return user?.providerData?.some(p => p.providerId === 'password');
    }, [user]);

    const handleError = (error, action) => {
        setIsLoading(false);
        console.error(`${action} error:`, error);
        if (error.code === 'auth/email-already-in-use' || error.code === 'auth/credential-already-in-use') {
             alert("此 Email 已被其他帳號使用。請改用登入。");
        } else if (error.code === 'auth/weak-password') {
             alert("密碼強度不足 (至少需6位數)。");
        } else if (error.code === 'auth/wrong-password') {
             alert("密碼錯誤。");
        } else if (error.code === 'auth/user-not-found') {
             alert("找不到此帳號。");
        } else if (error.code === 'auth/requires-recent-login') {
             alert("為了安全起見，請先登出並重新登入後，再執行刪除動作。");
        } else {
             alert(`${action} 失敗：${error.message}`);
        }
    };

    const handleSetEmailPassword = async () => {
        if(!email || !password || !confirmPassword) return alert("請輸入完整資訊");
        if(password !== confirmPassword) return alert("兩次密碼輸入不一致");
        
        setIsLoading(true);
        try {
            const credential = EmailAuthProvider.credential(email, password);
            await linkWithCredential(auth.currentUser, credential);
            setIsLoading(false);
            setIsSetPasswordMode(false);
            alert("帳號設定成功！以後請使用此信箱密碼登入。");
        } catch (error) {
            handleError(error, '設定帳密');
        }
    };

    const handleLoginEmail = async () => {
        if(!email || !password) return alert("請輸入完整資訊");
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setIsLoading(false);
            setIsLoginMode(false);
        } catch (error) {
            handleError(error, '登入');
        }
    };

    const handleResetPassword = async () => {
        if (!email) return alert("請先輸入 Email");
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            alert(`重設信已寄至 ${email}，請查收。`);
        } catch (error) {
            handleError(error, '重設密碼');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        if (confirm("確定要登出嗎？")) {
            await signOut(auth);
            await signInAnonymously(auth);
        }
    };

    const handleDeleteAccount = async () => {
        if (!confirm("警告！這將永久刪除您的帳號以及所有訓練紀錄，無法復原。\n\n您確定要繼續嗎？")) return;
        setIsLoading(true);
        try {
            const collectionsToDelete = ['LogDB', 'BodyMetricsDB', 'MovementDB', 'PlansDB'];
            for (const colName of collectionsToDelete) {
                const q = query(collection(db, `artifacts/${appId}/users/${userId}/${colName}`));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
            }
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile'));
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/UserIndex`, userId));
            await deleteUser(user);
            alert("帳號與資料已成功刪除。");
            await signInAnonymously(auth); 
        } catch (error) {
            handleError(error, '刪除帳號');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!userId || !db) return;
        const fetchSettings = async () => {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setStartDate(snap.data().startDate || '');
                setBaseTrainingDays(snap.data().baseTrainingDays || 0);
                setNickname(snap.data().nickname || '');
            }
        };
        fetchSettings();
    }, [userId, db, appId]);

    const totalTrainingDays = useMemo(() => {
        const uniqueDates = new Set(logDB.map(log => new Date(log.date).toDateString()));
        return Number(baseTrainingDays) + uniqueDates.size;
    }, [logDB, baseTrainingDays]);

    const handleSaveSettings = async () => {
        if (!userId || !db) return;
        try {
             await setDoc(doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile'), {
                startDate,
                baseTrainingDays: Number(baseTrainingDays),
                nickname
            });
            await setDoc(doc(db, `artifacts/${appId}/public/data/UserIndex`, userId), {
                email: user.email || 'anonymous',
                nickname: nickname,
                lastLogin: Date.now(),
                uid: userId
            }, { merge: true });
            alert('個人設定已更新！');
        } catch (e) {
            console.error(e);
            alert('更新失敗');
        }
    };

    const handleSave = async () => {
        if (!userId || !db) return;
        try {
            const docId = `metrics-${date}`; 
            const metricsRef = doc(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`), docId);
            await setDoc(metricsRef, {
                date: date,
                weight: parseFloat(weight) || 0,
                bodyFat: parseFloat(bodyFat) || 0,
                timestamp: Date.now()
            });
            alert('數據儲存成功！');
            setWeight(''); setBodyFat('');
        } catch (e) {
            console.error("Error saving metrics:", e);
            alert('儲存失敗');
        }
    };

    const handleDelete = async (dateKey) => {
        if (!confirm('確定要刪除這筆紀錄嗎？')) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`, `metrics-${dateKey}`));
        } catch (e) {
            console.error("Delete error:", e);
        }
    };

    const handleEdit = (metric) => {
        setDate(metric.date);
        setWeight(metric.weight);
        setBodyFat(metric.bodyFat);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const sortedMetrics = [...bodyMetricsDB].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const logsWithPhotos = useMemo(() => {
        return logDB.filter(log => log.photo && !log.isReset);
    }, [logDB]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" /> 帳號中心
                    </div>
                    {user?.isAnonymous ? <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">訪客</span> : <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">已登入</span>}
                </h3>
                <div className="flex items-center space-x-2 mb-4">
                    <div className={`w-full p-3 rounded-lg border flex items-center justify-center ${isEmailLinked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                        <Mail className="w-4 h-4 mr-2" /> {isEmailLinked ? `已登入：${user.email}` : '尚未設定帳號密碼'}
                    </div>
                </div>
                {!isEmailLinked && !isLoginMode && (
                    <div className="space-y-3">
                         {isSetPasswordMode ? (
                            <div className="animate-fade-in p-4 bg-gray-50 rounded-lg">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">建立帳號</h4>
                                <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2 mb-2 border rounded text-sm"/>
                                <input type="password" placeholder="密碼" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 mb-2 border rounded text-sm"/>
                                <input type="password" placeholder="再次確認密碼" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full p-2 mb-2 border rounded text-sm"/>
                                <div className="flex gap-2">
                                    <button onClick={handleSetEmailPassword} disabled={isLoading} className="flex-1 bg-indigo-600 text-white py-2 rounded text-sm font-bold">{isLoading ? '處理中...' : '確認建立'}</button>
                                    <button onClick={()=>{setIsSetPasswordMode(false); setConfirmPassword('');}} className="px-4 text-gray-500 text-sm">取消</button>
                                </div>
                            </div>
                         ) : (
                            <button onClick={()=>setIsSetPasswordMode(true)} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg flex items-center justify-center shadow-md">
                                <Lock className="w-4 h-4 mr-2" /> 設定信箱與密碼 (備份資料)
                            </button>
                         )}
                    </div>
                )}
                <div className="flex justify-between items-center text-xs text-gray-500 mt-6">
                    {user?.isAnonymous ? (
                        <button onClick={()=>setIsLoginMode(!isLoginMode)} className="flex items-center hover:text-indigo-600"><LogIn className="w-3 h-3 mr-1" /> 切換至現有帳號</button>
                    ) : (
                        <div className="flex w-full justify-between">
                            <button onClick={handleDeleteAccount} disabled={isLoading} className="flex items-center text-red-500 hover:text-red-700">{isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <UserX className="w-3 h-3 mr-1" />} 刪除帳號</button>
                            <button onClick={handleLogout} className="flex items-center text-gray-500 hover:text-gray-700"><LogOut className="w-3 h-3 mr-1" /> 登出</button>
                        </div>
                    )}
                </div>
                {isLoginMode && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-indigo-100">
                        <h4 className="text-sm font-bold text-gray-700 mb-3 text-center">登入帳號</h4>
                        <div className="space-y-2">
                             <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2 border rounded text-sm"/>
                             <input type="password" placeholder="密碼" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 border rounded text-sm"/>
                             <button onClick={handleLoginEmail} className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-bold">登入</button>
                             <div className="flex justify-between mt-2">
                                <button onClick={handleResetPassword} className="text-xs text-indigo-500">忘記密碼?</button>
                                <button onClick={()=>setIsLoginMode(false)} className="text-xs text-gray-400">取消</button>
                             </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500" />個人旅程</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-gray-500 mb-1">總訓練天數</div>
                        <div className="text-2xl font-extrabold text-indigo-600">{totalTrainingDays} 天</div>
                    </div>
                     <div className="bg-indigo-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-gray-500 mb-1">打卡紀錄</div>
                        <div className="text-2xl font-extrabold text-indigo-600">{totalTrainingDays - baseTrainingDays} 次</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const LibraryScreen = ({ weightHistory, movementDB, db, appId, userId, logDB, plansDB }) => {
    const [filter, setFilter] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isBatchMode, setIsBatchMode] = useState(false); 
    const [selectedItems, setSelectedItems] = useState(new Set()); 
    const [lastImportedIds, setLastImportedIds] = useState([]); 
    const [editingMove, setEditingMove] = useState(null); 
    const [nickname, setNickname] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!userId) return;
        const fetchNickname = async () => {
            const snap = await getDoc(doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile'));
            if (snap.exists()) setNickname(snap.data().nickname || '');
        };
        fetchNickname();
    }, [userId, db, appId]);

    const filteredMovements = movementDB.filter(m => (!filter || m.bodyPart === filter || m.name.includes(filter)));

    const handleSaveMovement = async () => {
        if (!db) return;
        const newName = editingMove.name?.trim();
        const oldName = editingMove.id;
        const isRenaming = oldName && oldName !== newName;
        if (isRenaming) {
            if (!confirm(`重新命名？`)) return;
            setIsProcessing(true);
            const batch = writeBatch(db);
            const newRef = doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, newName);
            const oldRef = doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, oldName);
            batch.set(newRef, { ...editingMove, name: newName, initialWeight: Number(editingMove.initialWeight||0) });
            batch.delete(oldRef);
            await batch.commit();
            setIsEditing(false);
            setIsProcessing(false);
        } else {
            const docId = oldName || newName;
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, docId), { ...editingMove, initialWeight: Number(editingMove.initialWeight||0) });
            setIsEditing(false);
        }
    };

    return (
        <>
            <MovementEditor isOpen={isEditing} onClose={() => setIsEditing(false)} onSave={handleSaveMovement} data={editingMove || {}} onChange={(f, v) => setEditingMove(p => ({ ...p, [f]: v }))} isProcessing={isProcessing} />
            <div className="flex gap-2 mb-4"><button onClick={() => {setEditingMove({ name: '', type: '', bodyPart: '', mainMuscle: '', tips: '', initialWeight: 0 }); setIsEditing(true);}} className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>新增動作</button></div>
            <div className="space-y-3">{filteredMovements.map(move => (
                <div key={move.id} className="bg-white p-4 rounded-xl shadow-lg border border-indigo-100">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-gray-800">{move.name}</h3>
                        <div className="flex space-x-2"><button onClick={() => {setEditingMove(move); setIsEditing(true);}} className="text-indigo-500"><Edit className="w-5 h-5"/></button></div>
                    </div>
                </div>
            ))}</div>
        </>
    );
};

const MenuScreen = ({ setSelectedDailyPlanId, selectedDailyPlanId, plansDB, movementDB, db, userId, appId, setScreen, currentLog, setCurrentLog }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [planName, setPlanName] = useState('');
    const [planMovements, setPlanMovements] = useState([]);
    const [tempSelectedMove, setTempSelectedMove] = useState('');
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    
    // --- 新增：AI 循環菜單評估狀態 ---
    const [cyclePlanIds, setCyclePlanIds] = useState(Array(7).fill(''));
    const [aiEvalBodyPart, setAiEvalBodyPart] = useState('');

    useEffect(() => {
        const plan = editingPlanId ? plansDB.find(p => p.id === editingPlanId) : null;
        setPlanName(plan ? plan.name : '');
        setPlanMovements(plan ? plan.movements : []);
    }, [editingPlanId, plansDB]);

    const handleSave = async () => {
        if (!db || !userId || !planName) return;
        const docId = editingPlanId || `plan-${Date.now()}`;
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/PlansDB`, docId), { name: planName, movements: planMovements, userId });
        setIsCreating(false); setEditingPlanId(null);
    };

    const handleUsePlan = (plan) => {
        if (currentLog.length > 0 && !confirm("載入新菜單將會覆蓋目前的紀錄，確定嗎？")) return;
        setSelectedDailyPlanId(plan.id);
        setCurrentLog(plan.movements.map(m => ({ 
            order: 0, 
            movementName: m.name, 
            targetSets: m.sets, 
            note: '', 
            sets: Array(Number(m.sets || 4)).fill({ reps: m.targetReps || 12, weight: 0 }), 
            rpe: 8 
        })));
        setScreen('Log');
    };

    // --- 新增：循環 AI 評估邏輯 ---
    const cyclePrompt = useMemo(() => {
        const cycleContent = cyclePlanIds.map((id, i) => {
            const plan = plansDB.find(p => p.id === id);
            if (!plan) return `Day ${i + 1}: (未選擇)`;
            const movements = plan.movements.map(m => `${m.name} ${m.sets}組${m.targetReps}下`).join('、');
            return `Day ${i + 1} (${plan.name}): ${movements}`;
        }).join('\n');

        return `我的循環菜單如下：\n${cycleContent}\n\n我要練的部位是「${aiEvalBodyPart || '______'}」，如果我組間休息時間都是1分半的話，請幫我評估：\n1.整個循環是否整體目標肌群過於重複，有建議少掉的動作嗎\n2.動作順序需要調整嗎\n3.有沒有不足建議補上的部位\n4.總訓練量之組數與下數需要調整嗎，如果有需要分別給我我的版本與你建議的版本的建議\n5.如果不照你的建議，依然使用我的菜單與對應組數與下數\n滿分100分，不及格60，可直接操課使用為80分的話，我的你認為是幾分`;
    }, [cyclePlanIds, plansDB, aiEvalBodyPart]);

    const handleCopyCyclePrompt = () => {
        const textArea = document.createElement("textarea");
        textArea.value = cyclePrompt;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert('循環評估提示詞已複製！請貼上至 ChatGPT。');
        } catch (err) {
            console.error('複製失敗', err);
        }
        document.body.removeChild(textArea);
    };

    if (isCreating || editingPlanId) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md"><input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} className="text-xl font-bold w-2/3 p-2 border-b-2 outline-none" placeholder="菜單名稱" /><div className="flex space-x-2"><button onClick={() => {setEditingPlanId(null); setIsCreating(false);}} className="p-2 bg-gray-200 rounded-full"><X className="w-5 h-5"/></button><button onClick={handleSave} className="p-2 bg-indigo-600 text-white rounded-full"><Save className="w-5 h-5"/></button></div></div>
                <div className="space-y-3">
                    {planMovements.map((m, i) => (
                        <div key={i} className="flex items-center space-x-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex-grow font-bold ml-1">{m.name}</div>
                            <input type="number" value={m.sets} onChange={(e)=>{const n=[...planMovements]; n[i].sets=Number(e.target.value); setPlanMovements(n);}} className="w-10 p-1 border rounded text-center text-sm"/>
                            <span className="text-gray-400 text-xs">組</span>
                            <input type="number" value={m.targetReps} onChange={(e)=>{const n=[...planMovements]; n[i].targetReps=Number(e.target.value); setPlanMovements(n);}} className="w-10 p-1 border rounded text-center text-sm"/>
                            <button onClick={()=>setPlanMovements(planMovements.filter((_,idx)=>idx!==i))} className="text-red-500 ml-1"><Trash2 className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md border-t">
                    <h4 className="font-bold mb-2">新增動作</h4>
                    <select value={tempSelectedMove} onChange={(e)=>{addMovementToPlan(e.target.value); setTempSelectedMove('');}} className="w-full p-2 border rounded-lg"><option value="" disabled>-- 選擇動作 --</option>{movementDB.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}</select>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <button onClick={() => setIsCreating(true)} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>創建菜單</button>
                <button onClick={() => setIsBatchMode(!isBatchMode)} className={`px-4 rounded-xl font-bold border ${isBatchMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>{isBatchMode ? '完成' : '管理'}</button>
            </div>

            <div className="space-y-4">
                {plansDB.map(p => (
                    <div key={p.id} className={`bg-white p-4 rounded-xl shadow-lg border transition-all ${selectedDailyPlanId===p.id?'border-4 border-indigo-400':''}`}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold">{p.name}</h3>
                            <div className="flex space-x-2"><button onClick={()=>setEditingPlanId(p.id)} className="text-gray-500"><Edit className="w-5 h-5"/></button><button onClick={async ()=>{if(confirm('刪除？')) await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/PlansDB`, p.id));}} className="text-red-500"><Trash2 className="w-5 h-5"/></button></div>
                        </div>
                        <button onClick={()=>handleUsePlan(p)} className="text-sm text-indigo-500 font-bold">選為今日訓練內容</button>
                    </div>
                ))}
            </div>

            {/* --- 新增：AI 循環總結評估區塊 --- */}
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-6 mt-10 animate-fade-in pb-10">
                <div className="flex items-center justify-between border-b border-indigo-200 pb-3">
                    <h3 className="text-lg font-bold text-indigo-700 flex items-center"><Sparkles className="w-5 h-5 mr-2" /> AI 循環評估總結</h3>
                    <button 
                        onClick={handleCopyCyclePrompt}
                        disabled={plansDB.length === 0}
                        className="bg-white p-2.5 rounded-xl text-indigo-600 border border-indigo-200 hover:bg-indigo-100 active:scale-95 transition-all shadow-sm flex items-center text-xs font-bold"
                    >
                        <ClipboardCopy className="w-4 h-4 mr-1" /> 複製給 GPT
                    </button>
                </div>

                <div className="space-y-4">
                    <p className="text-sm font-bold text-indigo-600">步驟 1：挑選 7 天循環菜單</p>
                    <div className="grid grid-cols-1 gap-2">
                        {cyclePlanIds.map((val, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-indigo-400 w-8">D{idx + 1}</span>
                                <select 
                                    value={val} 
                                    onChange={(e) => {
                                        const newIds = [...cyclePlanIds];
                                        newIds[idx] = e.target.value;
                                        setCyclePlanIds(newIds);
                                    }}
                                    className="flex-grow p-2 border border-indigo-100 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                                >
                                    <option value="">休息日 (或點此選擇菜單)</option>
                                    {plansDB.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-sm font-bold text-indigo-600">步驟 2：填寫本次大週期目標部位</p>
                    <input 
                        type="text" 
                        value={aiEvalBodyPart} 
                        onChange={(e) => setAiEvalBodyPart(e.target.value)} 
                        className="w-full p-3 border border-indigo-100 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-400" 
                        placeholder="例如：全身肌肥大 / 核心增強 / 改善圓肩..." 
                    />
                </div>

                <div className="bg-white p-4 rounded-2xl border border-indigo-100 text-[11px] text-gray-400 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-sans">
                    {cyclePrompt}
                </div>
                <p className="text-[10px] text-center text-indigo-300">複製整段文字並貼給 ChatGPT，即可獲得專業的循環優化建議與評分！</p>
            </div>
        </div>
    );
};

const LogScreen = ({ selectedDailyPlanId, setSelectedDailyPlanId, plansDB, movementDB, weightHistory, db, userId, appId, setScreen, currentLog, setCurrentLog }) => {
    const today = new Date().toISOString().substring(0, 10);
    const [selectedDate, setSelectedDate] = useState(today);
    const [resetModalState, setResetModalState] = useState({ isOpen: false });
    const [addMoveModalOpen, setAddMoveModalOpen] = useState(false);
    const [isBodyMetricsModalOpen, setIsBodyMetricsModalOpen] = useState(false);
    const [sessionPhoto, setSessionPhoto] = useState(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const fileInputRef = useRef(null);

    const handleLogSubmit = async () => {
        const active = currentLog.filter(m => m.sets.some(s => s.weight > 0));
        if (active.length === 0) return alert("請至少記錄一組重量");
        const sub = { 
            date: new Date(selectedDate).getTime(), 
            userId, 
            menuId: selectedDailyPlanId || 'custom', 
            photo: sessionPhoto || null,
            movements: active.map(m => ({ ...m, totalVolume: calculateTotalVolume(m.sets) })) 
        };
        const total = sub.movements.reduce((s, m) => s + m.totalVolume, 0);
        await setDoc(doc(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), `${selectedDate}-${Date.now()}`), { ...sub, overallVolume: total });
        setCurrentLog([]); setSessionPhoto(null); setSelectedDailyPlanId('');
        alert('訓練完成！'); setScreen('Analysis');
    };

    return (
        <div className="space-y-4 pb-20">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-md mb-4">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                <button onClick={() => setIsBodyMetricsModalOpen(true)} className="p-2 bg-indigo-100 rounded-full text-indigo-600"><Scale className="w-5 h-5" /></button>
            </div>
            {currentLog.map((move, i) => (
                <MovementLogCard key={i} move={move} index={i} weightHistory={weightHistory} movementDB={movementDB} handleSetUpdate={(mi,si,f,v)=>{const n=[...currentLog]; n[mi].sets[si][f]=v; setCurrentLog(n);}} handleNoteUpdate={(mi,v)=>{const n=[...currentLog]; n[mi].note=v; setCurrentLog(n);}} handleRpeUpdate={(mi,v)=>{const n=[...currentLog]; n[mi].rpe=v; setCurrentLog(n);}} openResetModal={()=>{}} />
            ))}
            <button onClick={() => setAddMoveModalOpen(true)} className="w-full bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>新增動作</button>
            {currentLog.length > 0 && <button onClick={handleLogSubmit} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg">完成訓練</button>}
        </div>
    );
};

const AnalysisScreen = ({ logDB, bodyMetricsDB, movementDB, db, appId, userId }) => {
    return (
        <div className="space-y-6 pb-24">
            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
                <div className="text-gray-500 text-xs font-bold uppercase">近期訓練總量</div>
                <div className="text-3xl font-extrabold text-indigo-600 mt-1">{logDB.length} 次訓練</div>
            </div>
        </div>
    );
};

const App = () => {
    const [screen, setScreen] = useState('Log'); 
    const [userId, setUserId] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [movementDB, setMovementDB] = useState([]); 
    const [plansDB, setPlansDB] = useState([]); 
    const [logDB, setLogDB] = useState([]); 
    const [bodyMetricsDB, setBodyMetricsDB] = useState([]); 
    const [weightHistory, setWeightHistory] = useState({}); 
    const [selectedDailyPlanId, setSelectedDailyPlanId] = useState('');
    const [currentLog, setCurrentLog] = useState([]);

    useEffect(() => {
        onAuthStateChanged(auth, async (u) => {
            if (!u) await signInAnonymously(auth);
            setUserId(u?.uid);
            setCurrentUser(u);
            setIsAuthReady(true);
        });
    }, []);

    useEffect(() => {
        if (!isAuthReady || !userId || !db) return;
        const unsub1 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/MovementDB`)), (s) => setMovementDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub2 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/PlansDB`)), (s) => setPlansDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub3 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), orderBy('date', 'desc')), (s) => setLogDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub4 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`)), (s) => setBodyMetricsDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, [isAuthReady, userId]);

    if (!isAuthReady) return <div className="p-10 text-center">Loading...</div>;

    const renderScreen = () => {
        const props = { setSelectedDailyPlanId, selectedDailyPlanId, plansDB, movementDB, db, userId, appId, setScreen, currentLog, setCurrentLog, logDB, bodyMetricsDB, weightHistory, auth };
        switch (screen) {
            case 'Library': return <ScreenContainer title="🏋️ 動作庫"><LibraryScreen {...props} /></ScreenContainer>;
            case 'Menu': return <ScreenContainer title="📋 菜單"><MenuScreen {...props} /></ScreenContainer>;
            case 'Analysis': return <ScreenContainer title="📈 分析"><AnalysisScreen {...props} /></ScreenContainer>;
            case 'Profile': return <ScreenContainer title="👤 個人"><ProfileScreen {...props} /></ScreenContainer>;
            default: return <ScreenContainer title="✍️ 紀錄"><LogScreen {...props} /></ScreenContainer>;
        }
    };

    return (
        <div className="h-screen font-sans bg-gray-50 flex flex-col overflow-hidden">
            <div className="flex-grow overflow-hidden">{renderScreen()}</div>
            <NavMenu screen={screen} setScreen={setScreen} isAdmin={currentUser?.email === ADMIN_EMAIL} />
        </div>
    );
};

const ScreenContainer = ({ children, title }) => (
    <div className="flex flex-col h-full bg-gray-50 p-4 pt-8 overflow-y-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 border-b-2 border-indigo-200 pb-2">{title}</h1>
        <div className="pb-32">{children}</div>
    </div>
);

const NavMenu = ({ screen, setScreen, isAdmin }) => (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 pb-6 pt-3 px-2 flex justify-around shadow-lg z-50">
        {[
            { id: 'Log', icon: NotebookText, label: '紀錄' },
            { id: 'Menu', icon: ListChecks, label: '菜單' },
            { id: 'Library', icon: Dumbbell, label: '動作庫' },
            { id: 'Analysis', icon: BarChart3, label: '分析' },
            { id: 'Profile', icon: User, label: '個人' }
        ].map(i => (
            <button key={i.id} onClick={() => setScreen(i.id)} className={`flex flex-col items-center justify-center flex-1 py-1 ${screen===i.id?'text-indigo-600':'text-gray-400'}`}>
                <i.icon className="w-8 h-8 mb-1" strokeWidth={screen===i.id ? 2.5 : 2} /><span className="text-xs font-bold">{i.label}</span>
            </button>
        ))}
        {isAdmin && <button onClick={() => setScreen('Admin')} className="flex flex-col items-center justify-center flex-1 py-1 text-red-400"><Shield className="w-8 h-8 mb-1" /><span className="text-xs font-bold">管理</span></button>}
    </div>
);

const setupInitialData = async (db, appId, userId) => {
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/MovementDB`), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        const batch = writeBatch(db);
        DEFAULT_MOVEMENTS.forEach(move => { const ref = doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, move.name); batch.set(ref, move); });
        await batch.commit();
    }
    const userAuth = auth.currentUser;
    if (userAuth && userId) {
        const userIndexRef = doc(db, `artifacts/${appId}/public/data/UserIndex`, userId);
        await setDoc(userIndexRef, { email: userAuth.email || 'anonymous', uid: userId, lastLogin: Date.now(), isAnonymous: userAuth.isAnonymous }, { merge: true });
    }
};

if (auth) onAuthStateChanged(auth, (u) => { if(u) setupInitialData(db, appId, u.uid); });

export default App;