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
  Weight, Calendar, Sparkles, AlertTriangle, Armchair, Plus, Trash2, Edit, Save, X, Scale, ListPlus, ChevronDown, CheckCircle, Info, Wand2, MousePointerClick, Crown, Activity, User, PenSquare, Trophy, Timer, Copy, ShieldCheck, LogIn, LogOut, Loader2, Bug, Smartphone, Mail, Lock, KeyRound, UserX, CheckSquare, Square, FileSpreadsheet, Upload, Download, Undo2, PlayCircle, LineChart, PieChart, History, Eraser
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

// 6. 動作編輯器 (AI Prompt 複製功能 + 必填驗證)
const MovementEditor = ({ isOpen, onClose, onSave, data, onChange }) => {
    const types = ['推', '拉', '腿', '核心'];
    const bodyParts = ['胸', '背', '腿', '肩', '手臂', '核心', '全身']; 
    
    const aiPrompt = data.name ? `${data.name}確認英文名稱為何，並且告訴我動作類型為何(推、拉、腿、核心)，訓練部位(胸、背、腿、肩、核心、手臂、全身)以及告訴我主要肌群與協同肌群各自為何，並且告訴我這個動作的提示與要點` : '';

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
            <div className="bg-white p-6">
                <h3 className="text-2xl font-bold text-indigo-600 border-b pb-2">{data.id ? '編輯動作' : '新增動作'}</h3>
                
                <div className="space-y-4 mt-4">
                    {/* 動作名稱 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">動作名稱 <span className="text-red-500">*</span></label>
                        <input type="text" value={data.name} onChange={(e) => onChange('name', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-500 font-medium" disabled={!!data.id} placeholder="例如：寬握槓片划船" />
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
                <div className="flex justify-end space-x-3 pt-4 border-t"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300">取消</button><button onClick={onSave} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">儲存動作</button></div>
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
            <div className="space-y-2">{move.sets.map((set, si) => (<div key={si} className="flex items-center space-x-2"><span className="w-8 text-xs text-gray-400 font-bold">S{si+1}</span><div className="flex-grow flex space-x-2"><input type="number" value={set.weight} onChange={(e)=>handleSetUpdate(index,si,'weight',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold" /><input type="number" value={set.reps} onChange={(e)=>handleSetUpdate(index,si,'reps',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold" /></div></div>))}</div>
            <RpeSelectorAlwaysVisible value={move.rpe || 8} onChange={(v) => handleRpeUpdate(index, v)} />
            <div className="text-gray-600 mt-2">{lastNote && <div className="bg-yellow-50 p-2 rounded-lg text-xs mb-2 border border-yellow-100">上次: {history.lastNote}</div>}<textarea placeholder="心得..." value={move.note || ''} onChange={(e) => handleNoteUpdate(index, e.target.value)} rows="1" className="w-full p-2 border rounded-lg text-sm" /></div>
            <div className="text-right text-xs font-bold text-indigo-400">總量: {totalVolume} kg</div>
        </div>
    );
};

// ----------------------------------------------------
// 新增：個人頁面 (ProfileScreen) - v3.3 (移除資料救援功能)
// ----------------------------------------------------
const ProfileScreen = ({ bodyMetricsDB, userId, db, appId, logDB, auth }) => {
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const today = new Date().toISOString().substring(0, 10);
    const [date, setDate] = useState(today);
    const [isLoading, setIsLoading] = useState(false); 
    const [debugMsg, setDebugMsg] = useState('');

    // 生涯設定
    const [startDate, setStartDate] = useState('');
    const [baseTrainingDays, setBaseTrainingDays] = useState(0);
    const [nickname, setNickname] = useState(''); // New state for nickname

    
    // 帳號管理 state
    const [user, setUser] = useState(auth?.currentUser);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // 確認密碼
    const [isSetPasswordMode, setIsSetPasswordMode] = useState(false);
    const [isLoginMode, setIsLoginMode] = useState(false); 

    useEffect(() => {
        if(auth) {
            const unsub = onAuthStateChanged(auth, (u) => setUser(u));
            return () => unsub();
        }
    }, [auth]);

    // 檢查是否已設定過密碼
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

    // 1. 設定 Email/密碼 (連結 Password Provider)
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

    // 2. 登入 Email/密碼 (切換帳號)
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

    // 忘記密碼
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

    // 登出
    const handleLogout = async () => {
        if (confirm("確定要登出嗎？")) {
            await signOut(auth);
            // 登出後，會自動觸發 App 層級的 onAuthStateChanged 變回匿名
        }
    };

    // 刪除帳號與資料
    const handleDeleteAccount = async () => {
        if (!confirm("警告！這將永久刪除您的帳號以及所有訓練紀錄，無法復原。\n\n您確定要繼續嗎？")) return;
        
        setIsLoading(true);
        try {
            // 1. 刪除資料庫紀錄 (手動刪除主要集合)
            // 注意：這裡只做簡單刪除，大量數據建議用 Cloud Functions，但在 Client 端盡力而為
            const collectionsToDelete = ['LogDB', 'BodyMetricsDB', 'MovementDB', 'PlansDB'];
            for (const colName of collectionsToDelete) {
                const q = query(collection(db, `artifacts/${appId}/users/${userId}/${colName}`));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
            }
            
            // 刪除設定檔
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile'));

            // 2. 刪除使用者帳號
            await deleteUser(user);
            alert("帳號與資料已成功刪除。");
            
            // 刪除後會自動登出
        } catch (error) {
            handleError(error, '刪除帳號');
        } finally {
            setIsLoading(false);
        }
    };

    // 載入生涯設定
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

    // 計算總天數
    const totalTrainingDays = useMemo(() => {
        const uniqueDates = new Set(logDB.map(log => new Date(log.date).toDateString()));
        return Number(baseTrainingDays) + uniqueDates.size;
    }, [logDB, baseTrainingDays]);

    // 儲存生涯設定
    const handleSaveSettings = async () => {
        if (!userId || !db) return;
        try {
             await setDoc(doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile'), {
                startDate,
                baseTrainingDays: Number(baseTrainingDays),
                nickname // Save nickname
            });
            alert('個人設定已更新！');
        } catch (e) {
            console.error(e);
            alert('更新失敗');
        }
    };

    // 儲存或更新體態
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

    // 刪除紀錄
    const handleDelete = async (dateKey) => {
        if (!confirm('確定要刪除這筆紀錄嗎？')) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`, `metrics-${dateKey}`));
        } catch (e) {
            console.error("Delete error:", e);
        }
    };

    // 編輯 (將資料填入上方表單)
    const handleEdit = (metric) => {
        setDate(metric.date);
        setWeight(metric.weight);
        setBodyFat(metric.bodyFat);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const sortedMetrics = [...bodyMetricsDB].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div className="space-y-6">
            
            {/* 新增：帳號中心 (v3.1 純信箱 + 刪除帳號) */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <ShieldCheck className="w-5 h-5 mr-2 text-indigo-600" /> 帳號中心
                    </div>
                    {user?.isAnonymous ? <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">訪客</span> : <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">已登入</span>}
                </h3>

                {/* 狀態顯示區 */}
                <div className="flex items-center space-x-2 mb-4">
                    <div className={`w-full p-3 rounded-lg border flex items-center justify-center ${isEmailLinked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                        <Mail className="w-4 h-4 mr-2" /> {isEmailLinked ? `已登入：${user.email}` : '尚未設定帳號密碼'}
                    </div>
                </div>

                {/* 主操作區：還沒登入 (訪客) 或是想要設定帳密 */}
                {!isEmailLinked && !isLoginMode && (
                    <div className="space-y-3">
                         {isSetPasswordMode ? (
                            <div className="animate-fade-in p-4 bg-gray-50 rounded-lg">
                                <h4 className="text-sm font-bold text-gray-700 mb-2">建立帳號 (綁定此裝置資料)</h4>
                                <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2 mb-2 border rounded text-sm"/>
                                <input type="password" placeholder="密碼 (至少6碼)" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-2 mb-2 border rounded text-sm"/>
                                <input type="password" placeholder="再次確認密碼" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full p-2 mb-2 border rounded text-sm"/>
                                <div className="flex gap-2">
                                    <button onClick={handleSetEmailPassword} disabled={isLoading} className="flex-1 bg-indigo-600 text-white py-2 rounded text-sm font-bold">
                                        {isLoading ? '處理中...' : '確認建立'}
                                    </button>
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
                
                {/* 底部功能區 (登出/登入/刪除) */}
                <div className="flex justify-between items-center text-xs text-gray-500 mt-6">
                    {user?.isAnonymous ? (
                        <button onClick={()=>setIsLoginMode(!isLoginMode)} className="flex items-center hover:text-indigo-600">
                             <LogIn className="w-3 h-3 mr-1" /> 切換至現有帳號
                        </button>
                    ) : (
                        <div className="flex w-full justify-between">
                            <button onClick={handleDeleteAccount} disabled={isLoading} className="flex items-center text-red-500 hover:text-red-700">
                                {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <UserX className="w-3 h-3 mr-1" />} 刪除帳號與資料
                            </button>
                            <button onClick={handleLogout} className="flex items-center text-gray-500 hover:text-gray-700">
                                 <LogOut className="w-3 h-3 mr-1" /> 登出
                            </button>
                        </div>
                    )}
                </div>

                {/* 登入模式區塊 */}
                {isLoginMode && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg animate-fade-in border border-indigo-100">
                        <h4 className="text-sm font-bold text-gray-700 mb-3 text-center">登入現有帳號</h4>
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

            {/* 新增：健身旅程卡片 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500" />個人資訊與旅程</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-gray-500 mb-1">總訓練天數</div>
                        <div className="text-2xl font-extrabold text-indigo-600">{totalTrainingDays} <span className="text-xs font-normal text-gray-400">天</span></div>
                    </div>
                     <div className="bg-indigo-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-gray-500 mb-1">打卡紀錄</div>
                        <div className="text-2xl font-extrabold text-indigo-600">{totalTrainingDays - baseTrainingDays} <span className="text-xs font-normal text-gray-400">次</span></div>
                    </div>
                </div>

                <div className="space-y-3 border-t pt-4">
                    {/* Nickname Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><User className="w-4 h-4 mr-1"/>暱稱 (APP如何稱呼您)</label>
                        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full p-2 border rounded-lg focus:border-indigo-500" placeholder="例如：巨巨" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Calendar className="w-4 h-4 mr-1"/>開始接觸健身日期</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Timer className="w-4 h-4 mr-1"/>過往累積天數 (App使用前)</label>
                        <input type="number" value={baseTrainingDays} onChange={(e) => setBaseTrainingDays(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="例如：100" />
                        <p className="text-xs text-gray-400 mt-1">輸入您在使用此 App 之前大概已經練了幾天，系統會自動加上 App 內的打卡次數。</p>
                    </div>
                    <button onClick={handleSaveSettings} className="w-full bg-gray-800 text-white font-bold py-2 rounded-lg hover:bg-gray-900 transition-colors">更新設定</button>
                </div>
            </div>

            {/* 體態數據卡片 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Activity className="w-5 h-5 mr-2 text-indigo-600" />更新身體數據</h3>
                <div className="space-y-4">
                     <div><label className="block text-sm font-medium text-gray-700 mb-1">日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border rounded-lg focus:border-indigo-500" /></div>
                    <div className="flex gap-4">
                        <div className="w-1/2"><label className="block text-sm font-medium text-gray-700 mb-1">體重 (KG)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div>
                        <div className="w-1/2"><label className="block text-sm font-medium text-gray-700 mb-1">體脂 (%)</label><input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div>
                    </div>
                    <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-indigo-700 transition-colors">儲存 / 更新體態</button>
                </div>
            </div>
            
            {/* 歷史列表 */}
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <h3 className="text-lg font-bold text-gray-800 mb-3 border-b pb-2">歷史紀錄</h3>
                {sortedMetrics.length === 0 ? <p className="text-center text-gray-500">無數據</p> : (
                    <table className="min-w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">日期</th><th>體重</th><th>體脂</th><th className="text-right">操作</th></tr></thead>
                    <tbody>{sortedMetrics.map(m => (<tr key={m.date} className="border-b hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-900">{m.date}</td><td className="text-center">{m.weight}</td><td className="text-center">{m.bodyFat||'-'}</td><td className="text-right"><button onClick={() => handleEdit(m)} className="text-indigo-500 mr-3"><PenSquare className="w-4 h-4"/></button><button onClick={() => handleDelete(m.date)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button></td></tr>))}</tbody></table>
                )}
            </div>
        </div>
    );
};

const LibraryScreen = ({ weightHistory, movementDB, db, appId, userId }) => {
    const [filter, setFilter] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isBatchMode, setIsBatchMode] = useState(false); 
    const [selectedItems, setSelectedItems] = useState(new Set()); 
    const [lastImportedIds, setLastImportedIds] = useState([]); 
    const [editingMove, setEditingMove] = useState(null); 
    
    // Fetch Nickname
    const [nickname, setNickname] = useState('');
    useEffect(() => {
        if (!userId) return;
        const fetchNickname = async () => {
            const snap = await getDoc(doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile'));
            if (snap.exists()) setNickname(snap.data().nickname || '');
        };
        fetchNickname();
    }, [userId, db, appId]);

    // Import Mode State (預設為「一般匯入」，可切換為「保留來源註記」)
    const [importWithNickname, setImportWithNickname] = useState(false);

    const categories = ['胸', '背', '腿', '肩', '手臂', '核心', '全身'];
    const filteredMovements = movementDB.filter(m => (!filter || m.bodyPart === filter || m.name.includes(filter)));

    const toggleSelection = (id) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === filteredMovements.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredMovements.map(m => m.id)));
        }
    };

    const handleBatchDelete = async () => {
        if (!confirm(`確定要刪除選取的 ${selectedItems.size} 個動作嗎？`)) return;
        const batch = writeBatch(db);
        selectedItems.forEach(id => {
            const ref = doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, id); 
            batch.delete(ref);
        });
        await batch.commit();
        setIsBatchMode(false);
        setSelectedItems(new Set());
    };

    const handleUndoImport = async () => {
        if (lastImportedIds.length === 0) return;
        if (!confirm(`確定要復原 (刪除) 剛剛匯入的 ${lastImportedIds.length} 個動作嗎？`)) return;
        
        const batch = writeBatch(db);
        lastImportedIds.forEach(id => {
            const ref = doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, id); 
            batch.delete(ref);
        });
        
        try {
            await batch.commit();
            setLastImportedIds([]); 
            alert("已復原上一次匯入！");
        } catch (error) {
            console.error("Undo failed:", error);
            alert("復原失敗，請稍後再試。");
        }
    };
    
    // 匯出 CSV (新版：第一欄固定為暱稱)
    const handleExportCSV = () => {
        // 新版格式：暱稱, 名稱...
        const headers = "暱稱,名稱,類型,部位,主要肌群,協同肌群,提示,影片連結,初始重量\n";
        const rows = movementDB.map(m => {
            // 包裹雙引號處理逗號，並處理內容中既有的雙引號
            const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
            return `${escape(nickname)},${escape(m.name)},${escape(m.type)},${escape(m.bodyPart)},${escape(m.mainMuscle)},${escape(m.secondaryMuscle)},${escape(m.tips)},${escape(m.link)},${escape(m.initialWeight)}`;
        }).join("\n");

        const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `movement_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadSampleCSV = () => {
        const headers = "暱稱,名稱,類型,部位,主要肌群,協同肌群,提示,影片連結,初始重量\n";
        // 範例資料加上引號，避免逗號衝突
        const sampleRow1 = `"範例教練","臥推(教練版)","推","胸","胸大肌","三頭肌","保持背部挺直, 不要聳肩","",20\n`;
        const sampleRow2 = `,"深蹲(無暱稱)","腿","腿","股四頭肌","臀大肌","膝蓋對準腳尖","",20`;
        
        const blob = new Blob(["\uFEFF" + headers + sampleRow1 + sampleRow2], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'movement_sample.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 新增：CSV 匯入 (增強版解析 + 智慧欄位偵測)
    const handleImportCSV = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        
        reader.onload = async (event) => {
            const text = event.target.result;
            
            // --- 強大的 CSV 解析器 (開始) ---
            const parseCSV = (str) => {
                const arr = [];
                let quote = false;  
                let row = 0, col = 0;
                let c = 0;
                
                for (; c < str.length; c++) {
                    let cc = str[c], nc = str[c+1];
                    arr[row] = arr[row] || [];
                    arr[row][col] = arr[row][col] || '';
                    
                    if (cc == '"' && quote && nc == '"') { 
                        arr[row][col] += cc; 
                        ++c; 
                        continue; 
                    }  
                    if (cc == '"') { 
                        quote = !quote; 
                        continue; 
                    }
                    if (cc == ',' && !quote) { 
                        ++col; 
                        continue; 
                    }
                    if (cc == '\r' && nc == '\n' && !quote) { 
                        ++row; col = 0; 
                        ++c; 
                        continue; 
                    }
                    if (cc == '\n' && !quote) { 
                        ++row; col = 0; 
                        continue; 
                    }
                    if (cc == '\r' && !quote) { 
                        ++row; col = 0; 
                        continue; 
                    }
                    arr[row][col] += cc;
                }
                return arr;
            };
            // --- 解析器 (結束) ---

            const rawData = parseCSV(text);
            // 移除空行與標題列
            const rows = rawData.slice(1).filter(r => r.length > 0 && r.some(c => c.trim() !== ''));

            const batch = writeBatch(db);
            let count = 0;
            let skippedCount = 0;
            const newIds = []; 

            rows.forEach(cols => {
                // 判斷格式：舊版(8欄) vs 新版(9欄，第一欄是暱稱)
                let sourceNickname = '';
                let name = '';
                let dataStartIdx = 0;

                if (cols.length >= 9) { // 新版格式 (有暱稱欄位)
                    sourceNickname = cols[0];
                    name = cols[1];
                    dataStartIdx = 1;
                } else if (cols.length >= 8) { // 舊版格式 (無暱稱)
                    name = cols[0];
                    dataStartIdx = 0;
                } else {
                    if (cols.length > 1) skippedCount++; 
                    return; 
                }

                // 必填欄位驗證：名稱、類型、部位
                const type = cols[dataStartIdx+1]?.trim();
                const bodyPart = cols[dataStartIdx+2]?.trim();

                if (name && type && bodyPart) {
                    name = name.trim();
                    let finalName = name;
                    
                    if (importWithNickname && sourceNickname && sourceNickname.trim()) {
                        finalName = `(來自${sourceNickname.trim()})${name}`;
                    }

                    const ref = doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, finalName); 
                    batch.set(ref, {
                        name: finalName,
                        type: type,
                        bodyPart: bodyPart,
                        mainMuscle: cols[dataStartIdx+3]?.trim() || '',
                        secondaryMuscle: cols[dataStartIdx+4]?.trim() || '',
                        tips: cols[dataStartIdx+5]?.trim() || '',
                        link: cols[dataStartIdx+6]?.trim() || '',
                        initialWeight: Number(cols[dataStartIdx+7]?.trim()) || 20
                    });
                    count++;
                    newIds.push(finalName);
                } else {
                    skippedCount++;
                }
            });

            if (count > 0) {
                try {
                    await batch.commit();
                    setLastImportedIds(newIds); 
                    let msg = `成功匯入 ${count} 個動作！\n如果不滿意，可以點擊「復原」按鈕撤銷。`;
                    if (skippedCount > 0) {
                        msg += `\n注意：有 ${skippedCount} 筆資料因欄位不全（名稱/類型/部位為空）而略過。`;
                    }
                    alert(msg);
                } catch (error) {
                    console.error("Import failed:", error);
                    alert("匯入失敗，請檢查檔案格式。");
                }
            } else {
                if (skippedCount > 0) {
                    alert(`所有資料 (${skippedCount} 筆) 皆因欄位不全而無法匯入。`);
                } else {
                    alert("檔案中沒有有效的資料列。");
                }
            }
        };
        reader.readAsText(file);
        e.target.value = null; 
    };
    
    // 手動儲存驗證
    const handleSaveMovement = async () => {
        if (!db) return;
        // Validation
        if (!editingMove.name?.trim()) return alert("請輸入動作名稱");
        if (!editingMove.type) return alert("請選擇動作類型");
        if (!editingMove.bodyPart) return alert("請選擇訓練部位");

        const docId = editingMove.id || editingMove.name.trim(); 
        try { await setDoc(doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, docId), { ...editingMove, initialWeight: Number(editingMove.initialWeight||20) }); setIsEditing(false); setEditingMove(null); if (!editingMove.id) setFilter(''); } catch(e) { console.error(e); }
    };
    const handleDeleteMovement = async (id) => { if (confirm('刪除?')) await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, id)); };

    return (
        <>
            <MovementEditor isOpen={isEditing} onClose={() => setIsEditing(false)} onSave={handleSaveMovement} data={editingMove || {}} onChange={(f, v) => setEditingMove(p => ({ ...p, [f]: v }))} />
            
            <div className="flex gap-2 mb-4">
                <button onClick={() => {setEditingMove({ name: '', type: '', bodyPart: '', mainMuscle: '', secondaryMuscle: '', tips: '', link: '', initialWeight: 20 }); setIsEditing(true);}} className="flex-1 bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>新增動作</button>
                <button onClick={() => setIsBatchMode(!isBatchMode)} className={`px-4 rounded-xl font-bold border ${isBatchMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>{isBatchMode ? '完成' : '管理'}</button>
            </div>

            {/* 匯入匯出區塊 (僅在管理模式顯示) */}
            {isBatchMode && (
                <div className="bg-gray-100 p-3 rounded-xl mb-4 animate-fade-in">
                    <div className="flex flex-col gap-3">
                        {/* 匯出 */}
                        <div className="flex justify-between items-center border-b pb-2 border-gray-200">
                             <div className="text-sm font-bold text-gray-600">匯出動作庫</div>
                             <button onClick={handleExportCSV} className="bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center hover:bg-indigo-50">
                                <Download className="w-3 h-3 mr-1" /> 匯出 CSV (含暱稱)
                            </button>
                        </div>

                        {/* 匯入 */}
                        <div className="flex flex-col gap-2">
                            <div className="text-sm font-bold text-gray-600">匯入動作</div>
                            
                            <div className="flex items-center gap-2 mb-1">
                                <input type="checkbox" id="importNick" checked={importWithNickname} onChange={e=>setImportWithNickname(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
                                <label htmlFor="importNick" className="text-xs text-gray-600">保留來源註記 (來自 XXX)</label>
                            </div>

                            <div className="flex gap-2">
                                 <label className="flex-1 cursor-pointer bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center hover:bg-indigo-700 shadow-sm">
                                    <Upload className="w-3 h-3 mr-1" /> 選擇檔案匯入
                                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                                </label>
                                <button onClick={handleDownloadSampleCSV} className="bg-white border border-gray-300 text-gray-500 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-50">
                                    下載範例
                                </button>
                            </div>
                        </div>

                        {/* 復原 & 刪除 */}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                            {lastImportedIds.length > 0 ? (
                                <button onClick={handleUndoImport} className="bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm animate-pulse">
                                    <Undo2 className="w-3 h-3 mr-1" /> 復原上一次匯入
                                </button>
                            ) : <div></div>}
                            
                            {selectedItems.size > 0 && (
                                <button onClick={handleBatchDelete} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                                    <Trash2 className="w-3 h-3 mr-1" /> 刪除 ({selectedItems.size})
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between space-x-2 mb-4 overflow-x-auto"><button onClick={() => setFilter('')} className={`p-2 rounded-full text-sm font-semibold whitespace-nowrap ${!filter ? 'bg-indigo-600 text-white' : 'bg-white'}`}>全部</button>{categories.map(t => <button key={t} onClick={() => setFilter(t)} className={`p-2 rounded-full text-sm font-semibold whitespace-nowrap ${filter === t ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{t}</button>)}</div>
            
            {/* 全選按鈕 */}
            {isBatchMode && (
                <div className="flex items-center mb-2 px-1" onClick={toggleSelectAll}>
                     {selectedItems.size === filteredMovements.length && filteredMovements.length > 0 ? <CheckSquare className="w-5 h-5 text-indigo-600 mr-2"/> : <Square className="w-5 h-5 text-gray-400 mr-2"/>}
                     <span className="text-sm font-bold text-gray-600">全選本頁</span>
                </div>
            )}

            <div className="space-y-3">{filteredMovements.map(move => {
                const record = weightHistory[move.name]?.absoluteBest;
                return (
                    <div key={move.id} className={`bg-white p-4 rounded-xl shadow-lg border transition-all ${isBatchMode && selectedItems.has(move.id) ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-100'}`} onClick={() => isBatchMode && toggleSelection(move.id)}>
                        <div className="flex justify-between items-start">
                            <div className="flex items-center">
                                {isBatchMode && (selectedItems.has(move.id) ? <CheckSquare className="w-5 h-5 text-indigo-600 mr-3 shrink-0"/> : <Square className="w-5 h-5 text-gray-300 mr-3 shrink-0"/>)}
                                <h3 className="text-xl font-bold text-gray-800">{move.name}</h3>
                            </div>
                            {!isBatchMode && record && <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-md border border-yellow-200"><Crown className="w-3 h-3 text-yellow-600 mr-1" /><span className="text-xs font-bold text-yellow-700">PR: {record.weight}kg x {record.reps}</span></div>}
                        </div>
                        <div className="text-sm mt-1 mb-2 flex justify-between items-center pl-8">
                            <div><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 mr-2">{move.type}</span><span className="text-gray-600">{move.bodyPart} - {move.mainMuscle}</span></div>
                            {!isBatchMode && <div className="flex space-x-2"><button onClick={(e) => {e.stopPropagation(); setEditingMove(move); setIsEditing(true);}} className="text-indigo-500 p-1"><Edit className="w-5 h-5"/></button><button onClick={(e) => {e.stopPropagation(); handleDeleteMovement(move.id, move.name);}} className="text-red-500 p-1"><Trash2 className="w-5 h-5"/></button></div>}
                        </div>
                        {!isBatchMode && <details className="text-gray-600 border-t pt-2 mt-2 pl-8"><summary className="font-semibold cursor-pointer">動作提示</summary><p className="mt-2 text-sm">{move.tips}</p>{move.secondaryMuscle && <p className="text-xs text-gray-500 mt-1">協同: {move.secondaryMuscle}</p>}</details>}
                    </div>
                );
            })}</div>
        </>
    );
};

const MenuScreen = ({ setSelectedDailyPlanId, selectedDailyPlanId, plansDB, movementDB, db, userId, appId }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [planName, setPlanName] = useState('');
    const [planMovements, setPlanMovements] = useState([]);
    const [tempSelectedMove, setTempSelectedMove] = useState('');
    
    // MenuScreen: Batch Mode & Filter
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [filterBodyPart, setFilterBodyPart] = useState('');
    const bodyParts = ['胸', '背', '腿', '肩', '手臂', '核心', '全身'];

    useEffect(() => {
        const plan = editingPlanId ? plansDB.find(p => p.id === editingPlanId) : null;
        setPlanName(plan ? plan.name : '');
        setPlanMovements(plan ? plan.movements : []);
    }, [editingPlanId, plansDB]);

    const handleMovementUpdate = (index, field, value) => {
        const newMovements = [...planMovements];
        newMovements[index] = { ...newMovements[index], [field]: Number(value) || value };
        setPlanMovements(newMovements);
    };

    const addMovementToPlan = (movementName) => {
        const movementDetail = movementDB.find(m => m.name === movementName);
        if (!movementDetail) return;
        setPlanMovements([...planMovements, { name: movementName, sets: 4, targetReps: 12, type: movementDetail.type }]);
    };

    const handleSave = async () => {
        if (!db || !userId || !planName) return;
        const docId = editingPlanId || `plan-${Date.now()}`;
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/PlansDB`, docId), { name: planName, movements: planMovements, userId }); // 修正為 users 路徑
        setIsCreating(false); setEditingPlanId(null);
    };
    const handleDelete = async (id) => { if(confirm('刪除?')) await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/PlansDB`, id)); }; // 修正為 users 路徑

    // Batch Delete for Menu
    const toggleSelection = (id) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItems(newSet);
    };

    const handleBatchDelete = async () => {
        if (!confirm(`確定要刪除選取的 ${selectedItems.size} 個菜單嗎？`)) return;
        const batch = writeBatch(db);
        selectedItems.forEach(id => {
            const ref = doc(db, `artifacts/${appId}/users/${userId}/PlansDB`, id); // 修正為 users 路徑
            batch.delete(ref);
        });
        await batch.commit();
        setIsBatchMode(false);
        setSelectedItems(new Set());
    };

    // MenuScreen: Filter movements based on selected body part
    const filteredMovementsForMenu = filterBodyPart
        ? movementDB.filter(m => m.bodyPart === filterBodyPart)
        : movementDB;

    if (isCreating || editingPlanId) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md"><input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} className="text-xl font-bold w-2/3 p-2 border-b-2 outline-none" placeholder="菜單名稱" /><div className="flex space-x-2"><button onClick={() => {setEditingPlanId(null); setIsCreating(false);}} className="p-2 bg-gray-200 rounded-full"><X className="w-5 h-5"/></button><button onClick={handleSave} className="p-2 bg-indigo-600 text-white rounded-full"><Save className="w-5 h-5"/></button></div></div>
                <div className="space-y-3">{planMovements.map((m, i) => (<div key={i} className="flex items-center space-x-3 bg-white p-3 rounded-xl shadow-sm"><div className="flex-grow font-bold">{m.name}</div><input type="number" value={m.sets} onChange={(e)=>handleMovementUpdate(i, 'sets', e.target.value)} className="w-12 p-1 border rounded text-center"/>x<input type="number" value={m.targetReps} onChange={(e)=>handleMovementUpdate(i, 'targetReps', e.target.value)} className="w-12 p-1 border rounded text-center"/><button onClick={()=>setPlanMovements(planMovements.filter((_,idx)=>idx!==i))} className="text-red-500"><Trash2 className="w-5 h-5"/></button></div>))}</div>
                <div className="bg-white p-4 rounded-xl shadow-md border-t">
                    <h4 className="font-bold mb-2">新增動作</h4>
                    {/* MenuScreen: Body Part Filter Dropdown */}
                    <div className="mb-2">
                         <select value={filterBodyPart} onChange={(e) => setFilterBodyPart(e.target.value)} className="w-full p-2 border rounded-lg bg-gray-50 text-sm">
                            <option value="">全部部位</option>
                            {bodyParts.map(bp => <option key={bp} value={bp}>{bp}</option>)}
                        </select>
                    </div>
                    <select value={tempSelectedMove} onChange={(e)=>{addMovementToPlan(e.target.value); setTempSelectedMove('');}} className="w-full p-2 border rounded-lg"><option value="" disabled>-- 選擇動作 --</option>{filteredMovementsForMenu.map(m=><option key={m.id} value={m.name}>{m.name}{m.mainMuscle ? ` [${m.mainMuscle}]` : ''}{m.secondaryMuscle ? ` (+${m.secondaryMuscle})` : ''}</option>)}</select>
                </div>
            </div>
        );
    }
    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <button onClick={() => setIsCreating(true)} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>創建菜單</button>
                <button onClick={() => setIsBatchMode(!isBatchMode)} className={`px-4 rounded-xl font-bold border ${isBatchMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>{isBatchMode ? '完成' : '管理'}</button>
            </div>

            {isBatchMode && selectedItems.size > 0 && (
                <div className="bg-gray-100 p-2 rounded-lg flex justify-end animate-fade-in">
                     <button onClick={handleBatchDelete} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center">
                        <Trash2 className="w-3 h-3 mr-1" /> 刪除 ({selectedItems.size})
                    </button>
                </div>
            )}

            {plansDB.map(p => (
                <div key={p.id} className={`bg-white p-4 rounded-xl shadow-lg border transition-all ${isBatchMode && selectedItems.has(p.id) ? 'border-indigo-500 bg-indigo-50' : (selectedDailyPlanId===p.id?'border-4 border-indigo-400':'')}`} onClick={() => isBatchMode && toggleSelection(p.id)}>
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                             {isBatchMode && (selectedItems.has(p.id) ? <CheckSquare className="w-5 h-5 text-indigo-600 mr-3 shrink-0"/> : <Square className="w-5 h-5 text-gray-300 mr-3 shrink-0"/>)}
                            <div>
                                <h3 className="text-xl font-bold">{p.name}</h3>
                                {!isBatchMode && (selectedDailyPlanId===p.id?<span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">今日使用</span>:<button onClick={(e)=>{e.stopPropagation(); setSelectedDailyPlanId(p.id);}} className="text-sm text-indigo-500">選為今日</button>)}
                            </div>
                        </div>
                        {!isBatchMode && <div className="flex space-x-2"><button onClick={(e)=>{e.stopPropagation(); setEditingPlanId(p.id);}} className="text-gray-500"><Edit className="w-5 h-5"/></button><button onClick={(e)=>{e.stopPropagation(); handleDelete(p.id);}} className="text-red-500"><Trash2 className="w-5 h-5"/></button></div>}
                    </div>
                    <p className="text-sm text-gray-600 mt-2 border-t pt-2 pl-8">{p.movements?.slice(0,3).map(m=>m.name).join('、')}...</p>
                </div>
            ))}
        </div>
    );
};

const LogScreen = ({ selectedDailyPlanId, setSelectedDailyPlanId, plansDB, movementDB, weightHistory, db, userId, appId, setScreen, currentLog, setCurrentLog }) => {
    const today = new Date().toISOString().substring(0, 10);
    const [selectedDate, setSelectedDate] = useState(today);
    // currentLog is now a prop from App
    const [resetModalState, setResetModalState] = useState({ isOpen: false });
    const [addMoveModalOpen, setAddMoveModalOpen] = useState(false);
    const [isBodyMetricsModalOpen, setIsBodyMetricsModalOpen] = useState(false);

    // Manual Menu Selection Logic (to prevent overwriting draft on tab switch)
    const handleMenuChange = (e) => {
        const newId = e.target.value;
        setSelectedDailyPlanId(newId);
        
        // 如果選的是空白，不動作
        if (!newId) return;

        // Only overwrite currentLog when user explicitly changes the menu
        const plan = plansDB.find(p => p.id === newId);
        if (plan) {
            if (currentLog.length > 0 && !confirm("載入新菜單將會覆蓋目前的紀錄，確定嗎？")) {
                // 如果取消，把下拉選單選回原本的 (或是空的)
                e.target.value = selectedDailyPlanId;
                return;
            }
            setCurrentLog(plan.movements.map(m => ({ 
                order: 0, 
                movementName: m.name, 
                targetSets: m.sets, 
                note: '', 
                // 預設組數為菜單設定，若無則預設 4 組 12 下
                sets: Array(Number(m.sets || 4)).fill({ reps: m.targetReps || 12, weight: 0 }), 
                rpe: 8 
            })));
        }
    };

    const handleSetUpdate = (mi, si, f, v) => {
        const newLog = [...currentLog]; newLog[mi].sets[si] = { ...newLog[mi].sets[si], [f]: Number(v) || v }; setCurrentLog(newLog);
    };
    const handleNoteUpdate = (mi, v) => { const newLog = [...currentLog]; newLog[mi].note = v; setCurrentLog(newLog); };
    const handleRpeUpdate = (mi, v) => { const newLog = [...currentLog]; newLog[mi].rpe = v; setCurrentLog(newLog); };
    const handleLogSubmit = async () => {
        const active = currentLog.filter(m => m.sets.some(s => s.weight > 0));
        if (active.length === 0) return alert("請至少記錄一組重量");
        
        const sub = { date: new Date(selectedDate).getTime(), userId, menuId: selectedDailyPlanId || 'custom', movements: active.map(m => ({ ...m, totalVolume: calculateTotalVolume(m.sets) })) };
        const total = sub.movements.reduce((s, m) => s + m.totalVolume, 0);
        await setDoc(doc(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), `${selectedDate}-${Date.now()}`), { ...sub, overallVolume: total });
        
        setCurrentLog([]); // Clear draft after submit
        setSelectedDailyPlanId(''); // Reset menu selection
        alert('訓練完成！');
        setScreen('Analysis'); // Jump to Analysis
    };
    
    const executeResetWeight = async (name, weight) => {
        await setDoc(doc(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), `reset-${Date.now()}`), { date: Date.now(), userId, movementName: name, isReset: true, resetWeight: weight });
        setResetModalState({ isOpen: false });
    };

    return (
        <>
            <WeightResetModal state={resetModalState} onClose={() => setResetModalState({ isOpen: false })} onConfirm={executeResetWeight} />
            <BodyMetricsModal isOpen={isBodyMetricsModalOpen} onClose={() => setIsBodyMetricsModalOpen(false)} onSave={async (d, w, f) => { await setDoc(doc(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`), `metrics-${d}`), { date: d, weight: w, bodyFat: f }); }} />
            <AddMovementModal isOpen={addMoveModalOpen} onClose={() => setAddMoveModalOpen(false)} movementDB={movementDB} onAdd={(name) => { setCurrentLog([...currentLog, { movementName: name, targetSets: 4, note: '', sets: Array(4).fill({ reps: 12, weight: 0 }), rpe: 8 }]); setAddMoveModalOpen(false); }} />
            
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-md mb-4">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                <button onClick={() => setIsBodyMetricsModalOpen(true)} className="p-2 bg-indigo-100 rounded-full text-indigo-600"><Scale className="w-5 h-5" /></button>
                <select value={selectedDailyPlanId || ''} onChange={handleMenuChange} className="p-2 border rounded-lg text-sm bg-white w-1/3 text-gray-700">
                    <option value="">載入菜單</option>
                    {plansDB.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            
            <div className="space-y-4 pb-20">
                {currentLog.length === 0 && <div className="text-center text-gray-400 py-10">從選單載入菜單，或點擊下方新增動作</div>}
                {currentLog.map((move, i) => (
                    <MovementLogCard key={i} move={move} index={i} weightHistory={weightHistory} movementDB={movementDB} handleSetUpdate={handleSetUpdate} handleNoteUpdate={handleNoteUpdate} handleRpeUpdate={(index, val) => handleRpeUpdate(i, val)} openResetModal={(name) => setResetModalState({ isOpen: true, movementName: name, initialWeight: 20 })} />
                ))}
                <button onClick={() => setAddMoveModalOpen(true)} className="w-full bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>新增動作 (預設 4組)</button>
                {currentLog.length > 0 && <button onClick={handleLogSubmit} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg my-4">完成訓練</button>}
            </div>
        </>
    );
};

// ----------------------------------------------------
// AnalysisScreen - v3.7 專業儀表板 + 肌力 + 體態 + 歷史紀錄管理 (含刪除功能)
// ----------------------------------------------------
const AnalysisScreen = ({ logDB, bodyMetricsDB, movementDB, db, appId, userId }) => {
    const [view, setView] = useState('Overview'); // Overview, Strength, Body, History
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
        logDB.slice(0, 20).forEach(log => { 
            log.movements.forEach(m => {
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
            .slice(-10); 
    }, [logDB, selectedMovement]);

    // 歷史紀錄刪除
    const handleDeleteLog = async (logId) => {
        if(!confirm("確定要刪除這筆紀錄嗎？無法復原。")) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/LogDB`, logId));
            alert("刪除成功");
        } catch(e) {
            console.error(e);
            alert("刪除失敗");
        }
    };
    
    // 清空所有紀錄
    const handleClearAllLogs = async () => {
        if(!confirm("警告：這將會刪除「所有」的歷史訓練紀錄！\n這通常是為了清除測試資料。\n\n確定要清空嗎？")) return;
        
        const batch = writeBatch(db);
        logDB.forEach(log => {
             const ref = doc(db, `artifacts/${appId}/users/${userId}/LogDB`, log.id);
             batch.delete(ref);
        });
        
        try {
            await batch.commit();
            alert("所有紀錄已清空！");
        } catch(e) {
             console.error(e);
             alert("清空失敗");
        }
    };

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
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                {['Overview', 'Strength', 'Body', 'History'].map(v => (
                    <button key={v} onClick={() => setView(v)} className={`flex-1 py-2 px-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${view===v ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                        {v === 'Overview' && '概況'}
                        {v === 'Strength' && '肌力'}
                        {v === 'Body' && '體態'}
                        {v === 'History' && '歷史紀錄'}
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

            {/* 4. 歷史紀錄 (History) - 新增功能 */}
            {view === 'History' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center"><History className="w-5 h-5 mr-2 text-indigo-600"/> 訓練日誌</h3>
                        {logDB.length > 0 && (
                            <button onClick={handleClearAllLogs} className="text-xs text-red-500 font-bold border border-red-200 bg-red-50 px-2 py-1 rounded flex items-center hover:bg-red-100">
                                <Eraser className="w-3 h-3 mr-1" /> 清空所有紀錄
                            </button>
                        )}
                    </div>

                    {logDB.length === 0 ? <p className="text-gray-400 text-center py-10">尚無紀錄</p> : (
                        <div className="space-y-3">
                            {logDB.map(log => (
                                <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="font-bold text-indigo-600 text-lg">{new Date(log.date).toLocaleDateString()}</div>
                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-bold">
                                                {log.menuId === 'custom' || !log.menuId ? '自訂訓練' : '菜單訓練'}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 line-clamp-1 mb-2">
                                            {log.movements.map(m => m.movementName).join('、')}
                                        </div>
                                        <div className="flex gap-3">
                                             <div className="text-xs font-bold text-gray-700 bg-indigo-50 px-2 py-1 rounded">總量: {log.overallVolume} kg</div>
                                             <div className="text-xs font-bold text-gray-700 bg-indigo-50 px-2 py-1 rounded">動作數: {log.movements.length}</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteLog(log.id)}
                                        className="p-3 text-red-400 hover:bg-red-50 rounded-full transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const App = () => {
    const [screen, setScreen] = useState('Log'); 
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [movementDB, setMovementDB] = useState([]); 
    const [plansDB, setPlansDB] = useState([]); 
    const [logDB, setLogDB] = useState([]); 
    const [bodyMetricsDB, setBodyMetricsDB] = useState([]); 
    const [weightHistory, setWeightHistory] = useState({}); 

    // 初始化為空字串，防止自動選取
    const [selectedDailyPlanId, setSelectedDailyPlanId] = useState('');

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

    // 移除自動設定第一個菜單的 useEffect

    useEffect(() => {
        if (!auth) return;
        const init = async () => {
            if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
            else {
                // 等待一下確認沒有currentUser才匿名，避免覆蓋
                const unsubscribe = onAuthStateChanged(auth, async (user) => {
                    if (!user) {
                        await signInAnonymously(auth);
                    }
                    unsubscribe();
                });
            }
            
            // setUserId 會由下方的 onAuthStateChanged 統一管理
            setIsAuthReady(true);
        };
        init();
    }, []);

    // 統一監聽登入狀態
    useEffect(() => {
        if(!auth) return;
        const unsub = onAuthStateChanged(auth, (u) => {
            setUserId(u?.uid);
        });
        return () => unsub();
    }, []);

    // 計算歷史紀錄與 AI 建議重量 (修正版：實作漸進式負荷邏輯)
    useEffect(() => {
        if (logDB.length === 0) return;
        const historyMap = {};
        movementDB.forEach(move => {
            // 找出該動作的所有紀錄
            const relevantLogs = logDB.filter(l => l.movements && l.movements.some(m => m.movementName === move.name));
            let lastRecord = null, absoluteBest = null, calculatedSuggestion = move.initialWeight || 20;
            
            if (relevantLogs.length > 0) {
                 // 排序：最新的在最前面
                 const sorted = relevantLogs.sort((a,b) => b.date - a.date);
                 
                 // --- 1. 找上次紀錄與 RPE ---
                 const latestLog = sorted[0];
                 const latestMoveData = latestLog.movements.find(m => m.movementName === move.name);
                 
                 if (latestMoveData) {
                     // 找出上次最重的一組 (通常以最重組作為基準)
                     const bestSet = latestMoveData.sets.reduce((p, c) => (c.weight > p.weight ? c : p), { weight: 0 });
                     if (bestSet.weight > 0) {
                         lastRecord = { weight: bestSet.weight, reps: bestSet.reps };
                         
                         // --- 核心邏輯：漸進式負荷計算 ---
                         const lastRpe = latestMoveData.rpe || 8; // 若沒填預設為 8
                         const lastWeight = bestSet.weight;

                         if (lastRpe <= RPE_UP_THRESHOLD) {
                             // 太輕了 (< 7)，加重 2.5%
                             calculatedSuggestion = Math.ceil(lastWeight * WEIGHT_INCREASE_MULTIPLIER * 2) / 2; // 四捨五入到 0.5
                         } else if (lastRpe >= RPE_DOWN_THRESHOLD) {
                             // 太重了 (> 9.5)，減重 2.5%
                             calculatedSuggestion = Math.floor(lastWeight * WEIGHT_DECREASE_MULTIPLIER * 2) / 2;
                         } else {
                             // 剛好，維持原重
                             calculatedSuggestion = lastWeight;
                         }
                     }
                 }

                 // --- 2. 找歷史 PR (絕對最大重量) ---
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
            
            historyMap[move.name] = { 
                lastRecord, 
                absoluteBest, 
                suggestion: calculatedSuggestion // 這裡現在會顯示動態計算後的值
            };
        });
        setWeightHistory(historyMap);
    }, [logDB, movementDB]);

    useEffect(() => {
        if (!isAuthReady || !userId || !db) return;
        // 修正路徑：讀取 users/{userId}/MovementDB (私有)
        const unsub1 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/MovementDB`)), (s) => setMovementDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        // 修正路徑：讀取 users/{userId}/PlansDB (私有)
        const unsub2 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/PlansDB`)), (s) => setPlansDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        
        const unsub3 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), orderBy('date', 'desc')), (s) => setLogDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub4 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`)), (s) => setBodyMetricsDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, [isAuthReady, userId]);

    if (!isAuthReady) return <div className="p-10 text-center">Loading...</div>;

    const renderScreen = () => {
        switch (screen) {
            case 'Library': return <ScreenContainer title="🏋️ 動作庫"><LibraryScreen weightHistory={weightHistory} movementDB={movementDB} db={db} appId={appId} userId={userId} /></ScreenContainer>;
            case 'Menu': return <ScreenContainer title="📋 菜單"><MenuScreen setSelectedDailyPlanId={setSelectedDailyPlanId} selectedDailyPlanId={selectedDailyPlanId} plansDB={plansDB} movementDB={movementDB} db={db} userId={userId} appId={appId} /></ScreenContainer>;
            case 'Analysis': return <ScreenContainer title="📈 分析"><AnalysisScreen logDB={logDB} bodyMetricsDB={bodyMetricsDB} movementDB={movementDB} db={db} appId={appId} userId={userId} /></ScreenContainer>;
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
        console.log("已為新用戶初始化基礎動作庫");
    }
};

if (auth) onAuthStateChanged(auth, (u) => { if(u) setupInitialData(db, appId, u.uid); });

export default App;