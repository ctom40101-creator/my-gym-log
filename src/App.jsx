import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Weight, Calendar, Sparkles, AlertTriangle, Armchair, Plus, Trash2, Edit, Save, X, Scale, ListPlus, ChevronDown, CheckCircle, Info, Wand2, MousePointerClick, Crown, Activity, User, PenSquare, Trophy, Timer, Copy, ShieldCheck, LogIn, LogOut, Loader2, Bug, Smartphone, Mail, Lock, KeyRound, UserX, CheckSquare, Square, FileSpreadsheet, Upload, Download, Undo2, PlayCircle, BarChart4, LineChart, PieChart
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

// Epley Formula for 1RM
const estimate1RM = (weight, reps) => {
    if (weight === 0) return 0;
    if (reps === 1) return weight;
    if (reps >= 15) return weight; // 高次數不適合估算極限
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
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

// ... (BodyMetricsModal, WeightResetModal, AddMovementModal, RpeSelectorAlwaysVisible, MovementEditor, MovementLogCard, ProfileScreen, LibraryScreen, MenuScreen, LogScreen 保持不變，為節省篇幅，這裡假設它們都在，請保留原有的這些元件程式碼)
// 為了確保程式碼完整性，我將在最後輸出完整的 AnalysisScreen 和 App，其他元件請確保保留。

// 1. 身體數據模態框
const BodyMetricsModal = ({ isOpen, onClose, onSave }) => {
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
    useEffect(() => { if (isOpen) { setWeight(''); setBodyFat(''); } }, [isOpen]);
    const handleSave = () => { onSave(date, weight, bodyFat); onClose(); };
    return (<ModalContainer isOpen={isOpen} onClose={onClose}><div className="bg-white p-6"><h3 className="text-xl font-bold text-indigo-600 flex items-center border-b pb-2"><Activity className="w-6 h-6 mr-2" />快速紀錄 (Log頁面)</h3><div className="space-y-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div><div className="flex gap-4"><div className="w-1/2"><label className="block text-sm font-medium text-gray-700 mb-1">體重 (KG)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div><div className="w-1/2"><label className="block text-sm font-medium text-gray-700 mb-1">體脂 (%)</label><input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div></div><div className="flex justify-end space-x-3 pt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">儲存</button></div></div></div></ModalContainer>);
};

// 2. 重置重量模態框
const WeightResetModal = ({ state, onClose, onConfirm }) => {
    const [weight, setWeight] = useState(state.initialWeight);
    useEffect(() => { setWeight(state.initialWeight); }, [state.initialWeight]);
    return (<ModalContainer isOpen={state.isOpen} onClose={onClose}><div className="bg-white p-6"><h3 className="text-xl font-bold text-red-600 flex items-center border-b pb-2"><RotateCcw className="w-6 h-6 mr-2" />重置訓練進度</h3><p className="text-gray-700 mt-4">您確定要重置 **{state.movementName}** 的重量嗎？</p><div className="flex items-center space-x-2 mt-4"><Scale className="w-6 h-6 text-indigo-500" /><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="flex-grow p-3 border-2 border-indigo-300 rounded-lg text-lg font-bold text-center" min="0" autoFocus /><span className="text-lg font-bold text-gray-700">KG</span></div><div className="flex justify-end space-x-3 pt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={() => onConfirm(state.movementName, weight)} className="px-4 py-2 bg-red-600 text-white rounded-lg">確認重置</button></div></div></ModalContainer>);
};

// 3. 快速新增動作模態框
const AddMovementModal = ({ isOpen, onClose, onAdd, movementDB }) => {
    const [selectedMuscle, setSelectedMuscle] = useState('');
    const [selectedMove, setSelectedMove] = useState('');
    const muscleGroups = useMemo(() => Array.from(new Set(movementDB.map(m => m.bodyPart || m.mainMuscle))).filter(Boolean).sort(), [movementDB]);
    const filteredMovements = useMemo(() => !selectedMuscle ? [] : movementDB.filter(m => (m.bodyPart || m.mainMuscle) === selectedMuscle).sort((a, b) => a.name.localeCompare(b.name)), [movementDB, selectedMuscle]);
    useEffect(() => { if (isOpen) { setSelectedMuscle(''); setSelectedMove(''); } }, [isOpen]);
    return (<ModalContainer isOpen={isOpen} onClose={onClose}><div className="bg-white p-6"><h3 className="text-xl font-bold text-indigo-600 flex items-center border-b pb-2"><ListPlus className="w-6 h-6 mr-2" />快速新增動作</h3><div className="space-y-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">1. 選擇部位</label><select value={selectedMuscle} onChange={(e) => {setSelectedMuscle(e.target.value); setSelectedMove('');}} className="w-full p-2 border rounded-lg"><option value="" disabled>-- 請選擇 --</option>{muscleGroups.map(m => <option key={m} value={m}>{m}</option>)}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-1">2. 選擇動作</label><select value={selectedMove} onChange={(e) => setSelectedMove(e.target.value)} className="w-full p-2 border rounded-lg" disabled={!selectedMuscle}><option value="" disabled>-- 請選擇 --</option>{filteredMovements.map(m => <option key={m.id || m.name} value={m.name}>{m.name}</option>)}</select></div><div className="flex justify-end space-x-3 pt-4 border-t"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={() => onAdd(selectedMove)} disabled={!selectedMove} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">確認新增</button></div></div></div></ModalContainer>);
};

// 4. RPE 
const RpeSelectorAlwaysVisible = ({ value, onChange }) => {
    const rpeValues = useMemo(() => { const v = []; for (let i = 50; i <= 100; i += 5) v.push(i / 10); return v; }, []);
    const feeling = [{r:10,t:'極限'},{r:9,t:'非常難'},{r:8,t:'困難'},{r:7,t:'中等'},{r:6,t:'輕鬆'},{r:5,t:'熱身'}].find(d=>d.r===Math.floor(parseFloat(value)))?.t||'';
    return (<div className="mt-3 pt-3 border-t border-gray-100"><div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-gray-700">RPE 感受評級 <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{feeling}</span></span><span className="text-lg font-extrabold text-indigo-600">{value}</span></div><div className="grid grid-cols-6 gap-1 overflow-x-auto pb-1">{rpeValues.map((r) => <button key={r} onClick={() => onChange(r.toFixed(1))} className={`flex-shrink-0 px-1 py-2 rounded-lg text-xs font-bold border ${parseFloat(value)===r ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>{r.toFixed(1)}</button>)}</div></div>);
};

// 6. 動作編輯器
const MovementEditor = ({ isOpen, onClose, onSave, data, onChange }) => {
    const types = ['推', '拉', '腿', '核心'];
    const bodyParts = ['胸', '背', '腿', '肩', '手臂', '核心', '全身']; 
    const aiPrompt = data.name ? `${data.name}確認英文名稱為何，並且告訴我動作類型為何(推、拉、腿、核心)，訓練部位(胸、背、腿、肩、核心、手臂、全身)以及告訴我主要肌群與協同肌群各自為何，並且告訴我這個動作的提示與要點` : '';
    const handleCopyPrompt = () => { if (!aiPrompt) return; const textArea = document.createElement("textarea"); textArea.value = aiPrompt; document.body.appendChild(textArea); textArea.select(); try { document.execCommand('copy'); alert('已複製提示詞！請貼上至 ChatGPT。'); } catch (err) { console.error('複製失敗', err); } document.body.removeChild(textArea); };
    return (<ModalContainer isOpen={isOpen} onClose={onClose}><div className="bg-white p-6"><h3 className="text-2xl font-bold text-indigo-600 border-b pb-2">{data.id ? '編輯動作' : '新增動作'}</h3><div className="space-y-4 mt-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">動作名稱 <span className="text-red-500">*</span></label><input type="text" value={data.name} onChange={(e) => onChange('name', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-500 font-medium" disabled={!!data.id} placeholder="例如：寬握槓片划船" /></div><div className="flex gap-3 items-end"><div className="flex-grow"><label className="block text-xs font-bold text-gray-500 mb-1">類型 <span className="text-red-500">*</span></label><select value={data.type || ''} onChange={(e) => onChange('type', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"><option value="" disabled>-- 請選擇 --</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select></div></div><div className="flex gap-3 items-end"><div className="flex-grow"><label className="block text-xs font-bold text-gray-500 mb-1">訓練部位 <span className="text-red-500">*</span></label><select value={data.bodyPart || ''} onChange={(e) => onChange('bodyPart', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white"><option value="" disabled>-- 請選擇 --</option>{bodyParts.map(t => <option key={t} value={t}>{t}</option>)}</select></div></div><div><label className="block text-xs font-bold text-gray-500 mb-1">主要肌群 (細項)</label><input type="text" value={data.mainMuscle} onChange={(e) => onChange('mainMuscle', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="例如：背闊肌上部" /></div><div><label className="block text-xs font-bold text-gray-500 mb-1">協同肌群</label><input type="text" value={data.secondaryMuscle} onChange={(e) => onChange('secondaryMuscle', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="例如：斜方肌" /></div><div className="border-t pt-4"><label className="block text-sm font-medium text-gray-700 mb-1">初始建議重量 (KG)</label><input type="number" value={data.initialWeight} onChange={(e) => onChange('initialWeight', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" min="0" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">動作提示/要點</label><textarea value={data.tips} onChange={(e) => onChange('tips', e.target.value)} rows="3" className="w-full p-2 border border-gray-300 rounded-lg" placeholder="動作要點..." /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">影片連結</label><input type="url" value={data.link} onChange={(e) => onChange('link', e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="YouTube URL" /></div>{data.name && (<div className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100"><div className="flex justify-between items-center mb-2"><h4 className="text-sm font-bold text-indigo-700 flex items-center"><Sparkles className="w-4 h-4 mr-1"/>建議於 AI 搜尋</h4><button onClick={handleCopyPrompt} className="text-xs flex items-center bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50"><Copy className="w-3 h-3 mr-1"/>複製</button></div><div className="bg-white p-3 rounded-lg border border-indigo-100 text-xs text-gray-600 leading-relaxed break-all">{aiPrompt}</div></div>)}</div><div className="flex justify-end space-x-3 pt-4 border-t"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">取消</button><button onClick={onSave} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">儲存動作</button></div></div></ModalContainer>);
};

const MovementLogCard = ({ move, index, weightHistory, movementDB, handleSetUpdate, handleNoteUpdate, handleRpeUpdate, openResetModal }) => {
    const history = weightHistory[move.movementName] || {};
    const lastRecord = history.lastRecord;
    const lastNote = history.lastNote; 
    const suggestion = history.suggestion || (movementDB.find(m => m.name === move.movementName)?.initialWeight || 20); 
    const totalVolume = calculateTotalVolume(move.sets);
    const movementDetail = movementDB.find(m => m.name === move.movementName) || {}; 
    return (<div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500 space-y-3"><div className="flex justify-between items-start border-b pb-2 mb-2"><h4 className="text-lg font-bold text-gray-800">{move.movementName}</h4><div className="flex space-x-3 items-center"><details className="relative group"><summary className="text-indigo-500 cursor-pointer list-none flex items-center text-xs"><ListChecks className="w-4 h-4 mr-1"/>指引</summary><div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white border rounded-xl shadow-2xl z-20 hidden group-open:block"><p className="font-bold text-gray-800 text-sm">提示:</p><p className="text-xs text-gray-600 mb-2">{movementDetail.tips||'無'}</p>{movementDetail.link && (<div className="mb-2"><a href={movementDetail.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline flex items-center"><PlayCircle className="w-3 h-3 mr-1" /> 觀看教學影片</a></div>)}<div className="text-xs text-gray-500 border-t pt-2"><p>部位: {movementDetail.bodyPart}</p><p>肌群: {movementDetail.mainMuscle}</p></div></div></details><button onClick={() => openResetModal(move.movementName)} className="text-red-400 text-xs flex items-center"><RotateCcw className="w-3 h-3 mr-1"/>重置</button></div></div><div className="flex justify-between text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg"><div className="flex items-center"><TrendingUp className="w-4 h-4 mr-1 text-indigo-600" /><span className="font-semibold">建議:</span><span className="ml-1 text-lg font-extrabold text-indigo-800">{suggestion}kg</span></div><div className="text-right text-xs">上次<br/><span className="font-medium text-gray-800">{lastRecord ? `${lastRecord.weight}kg x ${lastRecord.reps}` : '無'}</span></div></div><div className="space-y-2">{move.sets.map((set, si) => (<div key={si} className="flex items-center space-x-2"><span className="w-8 text-xs text-gray-400 font-bold">S{si+1}</span><div className="flex-grow flex space-x-2"><input type="number" value={set.weight} onChange={(e)=>handleSetUpdate(index,si,'weight',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold" /><input type="number" value={set.reps} onChange={(e)=>handleSetUpdate(index,si,'reps',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold" /></div></div>))}</div><RpeSelectorAlwaysVisible value={move.rpe || 8} onChange={(v) => handleRpeUpdate(index, v)} /><div className="text-gray-600 mt-2">{lastNote && <div className="bg-yellow-50 p-2 rounded-lg text-xs mb-2 border border-yellow-100">上次: {history.lastNote}</div>}<textarea placeholder="心得..." value={move.note || ''} onChange={(e) => handleNoteUpdate(index, e.target.value)} rows="1" className="w-full p-2 border rounded-lg text-sm" /></div><div className="text-right text-xs font-bold text-indigo-400">總量: {totalVolume} kg</div></div>);
};

// Profile, Library, Menu, Log Screen (省略重複部分，但功能保持)
// ... 請確保上述元件與之前的 v3.4 版本一致，這裡只展示 AnalysisScreen 的重大更新

// ----------------------------------------------------
// AnalysisScreen - v3.5 專業儀表板 + 肌力追蹤
// ----------------------------------------------------
const AnalysisScreen = ({ logDB, bodyMetricsDB, movementDB }) => {
    const [view, setView] = useState('Overview'); // Overview, Strength, Body
    const [selectedMovement, setSelectedMovement] = useState('');

    // 1. 概況數據計算
    const stats = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

        const monthlyLogs = logDB.filter(l => l.date >= firstDayOfMonth);
        const weeklyLogs = logDB.filter(l => l.date >= oneWeekAgo);

        const monthCount = new Set(monthlyLogs.map(l => new Date(l.date).toDateString())).size;
        const weekVolume = weeklyLogs.reduce((acc, curr) => acc + (curr.overallVolume || 0), 0);
        
        // 肌群分佈
        const muscleSplit = {};
        logDB.slice(0, 20).forEach(log => { // 取最近20次紀錄來分析
            log.movements.forEach(m => {
                // 這裡需要反查動作庫取得部位，若找不到則忽略
                const moveDetail = movementDB.find(dbM => dbM.name === m.movementName);
                const part = moveDetail?.bodyPart || '其他';
                muscleSplit[part] = (muscleSplit[part] || 0) + (m.totalVolume || 0);
            });
        });
        
        const totalSplitVolume = Object.values(muscleSplit).reduce((a,b)=>a+b, 0) || 1;
        const muscleSplitPercent = Object.entries(muscleSplit)
            .map(([k, v]) => ({ name: k, percent: Math.round((v / totalSplitVolume) * 100) }))
            .sort((a, b) => b.percent - a.percent);

        return { monthCount, weekVolume, muscleSplitPercent };
    }, [logDB, movementDB]);

    // 2. 肌力數據 (1RM 趨勢)
    const strengthData = useMemo(() => {
        if (!selectedMovement) return [];
        return logDB
            .filter(log => log.movements.some(m => m.movementName === selectedMovement))
            .map(log => {
                const moveLog = log.movements.find(m => m.movementName === selectedMovement);
                const bestSet = moveLog.sets.reduce((p, c) => (estimate1RM(c.weight, c.reps) > estimate1RM(p.weight, p.reps) ? c : p), { weight: 0, reps: 0 });
                return {
                    date: new Date(log.date).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}),
                    e1rm: estimate1RM(bestSet.weight, bestSet.reps),
                    rawDate: log.date
                };
            })
            .sort((a, b) => a.rawDate - b.rawDate)
            .slice(-10); // 取最近10次
    }, [logDB, selectedMovement]);

    // SVG 圖表繪製 helper
    const renderLineChart = (data, valueKey, labelKey, color) => {
        if (data.length < 2) return <div className="text-gray-400 text-center py-10">資料不足，無法繪製圖表</div>;
        const width = 300;
        const height = 150;
        const padding = 20;
        const maxVal = Math.max(...data.map(d => d[valueKey])) * 1.1;
        const minVal = Math.min(...data.map(d => d[valueKey])) * 0.9;
        
        const points = data.map((d, i) => {
            const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
            const y = height - ((d[valueKey] - minVal) / (maxVal - minVal)) * (height - 2 * padding) - padding;
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <polyline fill="none" stroke={color} strokeWidth="3" points={points} />
                {data.map((d, i) => {
                    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
                    const y = height - ((d[valueKey] - minVal) / (maxVal - minVal)) * (height - 2 * padding) - padding;
                    return (
                        <g key={i}>
                            <circle cx={x} cy={y} r="4" fill="white" stroke={color} strokeWidth="2" />
                            <text x={x} y={y - 10} fontSize="10" textAnchor="middle" fill="#666">{d[valueKey]}</text>
                            <text x={x} y={height - 2} fontSize="10" textAnchor="middle" fill="#999">{d[labelKey]}</text>
                        </g>
                    );
                })}
            </svg>
        );
    };

    return (
        <div className="space-y-6 pb-24">
            {/* 分頁切換 */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                {['Overview', 'Strength', 'Body'].map(v => (
                    <button key={v} onClick={() => setView(v)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${view===v ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                        {v === 'Overview' && '概況'}
                        {v === 'Strength' && '肌力'}
                        {v === 'Body' && '體態'}
                    </button>
                ))}
            </div>

            {/* 1. 概況 (Overview) */}
            {view === 'Overview' && (
                <div className="space-y-4 animate-fade-in">
                    {/* 頂部數據卡 */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-xl text-white shadow-lg">
                            <div className="flex items-center space-x-2 opacity-80 mb-1"><Calendar className="w-4 h-4"/> <span className="text-xs">本月訓練</span></div>
                            <div className="text-3xl font-extrabold">{stats.monthCount} <span className="text-sm font-medium opacity-70">次</span></div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-lg">
                             <div className="flex items-center space-x-2 text-gray-500 mb-1"><Weight className="w-4 h-4"/> <span className="text-xs">本週容量</span></div>
                             <div className="text-2xl font-bold text-gray-800">{(stats.weekVolume / 1000).toFixed(1)} <span className="text-sm text-gray-400">頓</span></div>
                        </div>
                    </div>

                    {/* 肌群分佈 */}
                    <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center"><Activity className="w-4 h-4 mr-2 text-indigo-500"/> 近期部位分佈</h4>
                        <div className="space-y-3">
                            {stats.muscleSplitPercent.length > 0 ? stats.muscleSplitPercent.map((m, i) => (
                                <div key={m.name}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-medium text-gray-700">{m.name}</span>
                                        <span className="text-gray-500">{m.percent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${m.percent}%` }}></div>
                                    </div>
                                </div>
                            )) : <p className="text-gray-400 text-sm text-center">尚無足夠數據</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. 肌力 (Strength) */}
            {view === 'Strength' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-xs font-bold text-gray-500 mb-2">選擇要分析的動作</label>
                        <select 
                            value={selectedMovement} 
                            onChange={(e) => setSelectedMovement(e.target.value)} 
                            className="w-full p-3 border rounded-lg bg-gray-50 font-bold text-gray-800"
                        >
                            <option value="" disabled>-- 請選擇動作 --</option>
                            {/* 列出有紀錄的動作 */}
                            {Array.from(new Set(logDB.flatMap(l => l.movements.map(m => m.movementName)))).map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedMovement && (
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
                            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                                <TrendingUp className="w-4 h-4 mr-2 text-green-500"/> 預估 1RM 趨勢 (kg)
                            </h4>
                            <div className="h-48 w-full">
                                {renderLineChart(strengthData, 'e1rm', 'date', '#10B981')}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-2 text-center">* 依據 Epley 公式估算，僅供參考</p>
                        </div>
                    )}
                </div>
            )}

            {/* 3. 體態 (Body) */}
            {view === 'Body' && (
                <div className="space-y-4 animate-fade-in">
                     <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                            <Scale className="w-4 h-4 mr-2 text-blue-500"/> 體重變化 (kg)
                        </h4>
                        <div className="h-48 w-full">
                            {renderLineChart(
                                [...bodyMetricsDB].sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-10).map(d => ({...d, shortDate: d.date.slice(5)})), 
                                'weight', 
                                'shortDate', 
                                '#3B82F6'
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ... (ProfileScreen, LibraryScreen, MenuScreen, LogScreen, App 需保留原樣或更新引用，下方是 App 的 return 部分)

const App = () => {
    const [screen, setScreen] = useState('Log'); 
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [movementDB, setMovementDB] = useState([]); 
    const [plansDB, setPlansDB] = useState([]); 
    const [logDB, setLogDB] = useState([]); 
    const [bodyMetricsDB, setBodyMetricsDB] = useState([]); 
    const [weightHistory, setWeightHistory] = useState({}); 

    const defaultMenuId = useMemo(() => plansDB.length > 0 ? plansDB[0].id : null, [plansDB]);
    const [selectedDailyPlanId, setSelectedDailyPlanId] = useState(defaultMenuId);

    // State Persistence (Draft)
    const [currentLog, setCurrentLog] = useState(() => {
        try {
            const saved = localStorage.getItem('gym_log_draft');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    useEffect(() => {
        localStorage.setItem('gym_log_draft', JSON.stringify(currentLog));
    }, [currentLog]);

    // ... (Authentication logic remains same as v3.2)
    useEffect(() => {
        if (!auth) return;
        const init = async () => {
            if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
            else {
                const unsubscribe = onAuthStateChanged(auth, async (user) => {
                    if (!user) await signInAnonymously(auth);
                    unsubscribe();
                });
            }
            setIsAuthReady(true);
        };
        init();
    }, []);

    useEffect(() => {
        if(!auth) return;
        const unsub = onAuthStateChanged(auth, (u) => { setUserId(u?.uid); });
        return () => unsub();
    }, []);

    // ... (Firestore listeners remain same)
    useEffect(() => {
        if (!isAuthReady || !userId || !db) return;
        const unsub1 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/MovementDB`)), (s) => setMovementDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub2 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/PlansDB`)), (s) => setPlansDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub3 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), orderBy('date', 'desc')), (s) => setLogDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub4 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`)), (s) => setBodyMetricsDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, [isAuthReady, userId]);

    // ... (Weight history calculation remains same)
    useEffect(() => {
        if (logDB.length === 0) return;
        const historyMap = {};
        movementDB.forEach(move => {
            const relevantLogs = logDB.filter(l => l.movements && l.movements.some(m => m.movementName === move.name));
            let lastRecord = null, absoluteBest = null;
            if (relevantLogs.length > 0) {
                 const sorted = relevantLogs.sort((a,b) => b.date - a.date);
                 const latest = sorted[0].movements.find(m => m.movementName === move.name);
                 if (latest) {
                     const bestSet = latest.sets.reduce((p, c) => (c.weight > p.weight ? c : p), { weight: 0 });
                     if (bestSet.weight > 0) lastRecord = { weight: bestSet.weight, reps: bestSet.reps };
                 }
                 let maxWeight = 0, bestReps = 0;
                 sorted.forEach(l => {
                     const m = l.movements.find(x => x.movementName === move.name);
                     if (m) {
                         const bs = m.sets.reduce((p, c) => (c.weight > p.weight ? c : p), { weight: 0 });
                         if (bs.weight > maxWeight) { maxWeight = bs.weight; bestReps = bs.reps; }
                     }
                 });
                 if (maxWeight > 0) absoluteBest = { weight: maxWeight, reps: bestReps };
            }
            historyMap[move.name] = { lastRecord, absoluteBest, suggestion: move.initialWeight || 20 };
        });
        setWeightHistory(historyMap);
    }, [logDB, movementDB]);

    if (!isAuthReady) return <div className="p-10 text-center">Loading...</div>;

    const renderScreen = () => {
        switch (screen) {
            case 'Library': return <ScreenContainer title="🏋️ 動作庫"><LibraryScreen weightHistory={weightHistory} movementDB={movementDB} db={db} appId={appId} userId={userId} /></ScreenContainer>;
            case 'Menu': return <ScreenContainer title="📋 菜單"><MenuScreen setSelectedDailyPlanId={setSelectedDailyPlanId} selectedDailyPlanId={selectedDailyPlanId} plansDB={plansDB} movementDB={movementDB} db={db} userId={userId} appId={appId} /></ScreenContainer>;
            case 'Analysis': return <ScreenContainer title="📈 分析"><AnalysisScreen logDB={logDB} bodyMetricsDB={bodyMetricsDB} movementDB={movementDB} /></ScreenContainer>;
            case 'Profile': return <ScreenContainer title="👤 個人"><ProfileScreen bodyMetricsDB={bodyMetricsDB} userId={userId} db={db} appId={appId} logDB={logDB} auth={auth} /></ScreenContainer>;
            default: return <ScreenContainer title="✍️ 紀錄"><LogScreen selectedDailyPlanId={selectedDailyPlanId} setSelectedDailyPlanId={setSelectedDailyPlanId} plansDB={plansDB} movementDB={movementDB} weightHistory={weightHistory} db={db} userId={userId} appId={appId} setScreen={setScreen} currentLog={currentLog} setCurrentLog={setCurrentLog} /></ScreenContainer>;
        }
    };

    return (
        <div className="h-screen font-sans bg-gray-50 flex flex-col">
            <div className="flex-grow overflow-hidden">{renderScreen()}</div>
            <NavMenu screen={screen} setScreen={setScreen} />
        </div>
    );
};

const ScreenContainer = ({ children, title }) => (
    <div className="flex flex-col h-full bg-gray-50 p-4 pt-8 overflow-y-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 border-b-2 border-indigo-200 pb-2 flex items-center">{title}</h1>
        <div className="pb-32">{children}</div>
    </div>
);
const NavMenu = ({ screen, setScreen }) => (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 pb-6 pt-3 px-2 flex justify-around shadow-[0_-5px_10px_rgba(0,0,0,0.05)] z-50">
        {[
            { id: 'Log', icon: NotebookText, label: '紀錄' },
            { id: 'Menu', icon: ListChecks, label: '菜單' },
            { id: 'Library', icon: Dumbbell, label: '動作庫' },
            { id: 'Analysis', icon: BarChart3, label: '分析' },
            { id: 'Profile', icon: User, label: '個人' }
        ].map(i => (
            <button 
                key={i.id} 
                onClick={() => setScreen(i.id)} 
                className={`flex flex-col items-center justify-center flex-1 py-1 active:scale-95 transition-all ${screen===i.id?'text-indigo-600':'text-gray-400'}`}
            >
                <i.icon className="w-8 h-8 mb-1" strokeWidth={screen===i.id ? 2.5 : 2} />
                <span className="text-xs font-bold">{i.label}</span>
            </button>
        ))}
    </div>
);

// 新增：初始化預設動作 (針對新用戶)
const setupInitialData = async (db, appId, userId) => {
    // 檢查用戶的動作庫是否為空
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/MovementDB`), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        // 如果是空的，執行批次寫入
        const batch = writeBatch(db);
        DEFAULT_MOVEMENTS.forEach(move => {
            const ref = doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, move.name);
            batch.set(ref, move);
        });
        await batch.commit();
    }
};

if (auth) onAuthStateChanged(auth, (u) => { if(u) setupInitialData(db, appId, u.uid); });

export default App;