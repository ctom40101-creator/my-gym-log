import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, linkWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, getDocs, orderBy, limit, deleteDoc, getDoc } from 'firebase/firestore';
import {
  Dumbbell, Menu, NotebookText, BarChart3, ListChecks, ArrowLeft, RotateCcw, TrendingUp,
  Weight, Calendar, Sparkles, AlertTriangle, Armchair, Plus, Trash2, Edit, Save, X, Scale, ListPlus, ChevronDown, CheckCircle, Info, Wand2, MousePointerClick, Crown, Activity, User, PenSquare, Trophy, Timer, Copy, ShieldCheck, LogIn
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
    if (reps >= 15) return weight; 
    return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
};

// ----------------------------------------------------
// 獨立元件區 (確保所有元件都在 App 外部定義)
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

// 6. 動作編輯器 (修改版 - 移除內建建議，加入 AI Prompt 複製功能)
const MovementEditor = ({ isOpen, onClose, onSave, data, onChange }) => {
    const types = ['推', '拉', '腿', '核心'];
    const bodyParts = ['胸', '背', '腿', '肩', '核心', '手臂', '全身']; 
    
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">動作名稱</label>
                        <input type="text" value={data.name} onChange={(e) => onChange('name', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-500 font-medium" disabled={!!data.id} placeholder="例如：寬握槓片划船" />
                    </div>

                    {/* 1. 類型 */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-grow">
                            <label className="block text-xs font-bold text-gray-500 mb-1">類型</label>
                            <select value={data.type || ''} onChange={(e) => onChange('type', e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-white">
                                <option value="" disabled>-- 請選擇 --</option>
                                {types.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* 2. 部位 */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-grow">
                            <label className="block text-xs font-bold text-gray-500 mb-1">訓練部位</label>
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
                    <details className="relative group"><summary className="text-indigo-500 cursor-pointer list-none flex items-center text-xs"><ListChecks className="w-4 h-4 mr-1"/>指引</summary><div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white border rounded-xl shadow-2xl z-20 hidden group-open:block"><p className="font-bold text-gray-800 text-sm">提示:</p><p className="text-xs text-gray-600 mb-2">{movementDetail.tips||'無'}</p><div className="text-xs text-gray-500 border-t pt-2"><p>部位: {movementDetail.bodyPart}</p><p>肌群: {movementDetail.mainMuscle}</p></div></div></details>
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
// 新增：個人頁面 (ProfileScreen) - 支援編輯與刪除 + 生涯天數設定 + Google 綁定
// ----------------------------------------------------
const ProfileScreen = ({ bodyMetricsDB, userId, db, appId, logDB, auth }) => {
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const today = new Date().toISOString().substring(0, 10);
    const [date, setDate] = useState(today);

    // 新增：生涯設定
    const [startDate, setStartDate] = useState('');
    const [baseTrainingDays, setBaseTrainingDays] = useState(0);
    
    // 新增：使用者狀態
    const [user, setUser] = useState(auth?.currentUser);

    useEffect(() => {
        if(auth) {
            const unsub = onAuthStateChanged(auth, (u) => setUser(u));
            return () => unsub();
        }
    }, [auth]);

    // Google 綁定邏輯
    const handleLinkGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await linkWithPopup(auth.currentUser, provider);
            alert("綁定成功！您的資料現在已安全連結至 Google 帳號，不用擔心遺失了。");
        } catch (error) {
            console.error(error);
            if (error.code === 'auth/credential-already-in-use') {
                alert("此 Google 帳號已有其他紀錄。無法合併，請聯絡管理員或使用不同帳號。");
            } else {
                alert("綁定失敗，請確認您已在 Firebase Console 開啟 Google 登入功能。");
            }
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
            }
        };
        fetchSettings();
    }, [userId, db, appId]);

    // 計算總天數
    const totalTrainingDays = useMemo(() => {
        // 從 logDB 中找出不重複的日期數量
        const uniqueDates = new Set(logDB.map(log => new Date(log.date).toDateString()));
        return Number(baseTrainingDays) + uniqueDates.size;
    }, [logDB, baseTrainingDays]);

    // 儲存生涯設定
    const handleSaveSettings = async () => {
        if (!userId || !db) return;
        try {
             await setDoc(doc(db, `artifacts/${appId}/users/${userId}/Settings`, 'profile'), {
                startDate,
                baseTrainingDays: Number(baseTrainingDays)
            });
            alert('生涯設定已更新！');
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
            
            {/* 新增：帳號安全卡片 */}
            <div className={`p-6 rounded-xl shadow-lg border ${user?.isAnonymous ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center">
                    {user?.isAnonymous ? <ShieldCheck className="w-5 h-5 mr-2 text-orange-500" /> : <ShieldCheck className="w-5 h-5 mr-2 text-green-600" />}
                    帳號狀態：{user?.isAnonymous ? '訪客 (未備份)' : '已綁定 Google'}
                </h3>
                {user?.isAnonymous ? (
                    <div>
                        <p className="text-sm text-gray-600 mb-4">
                            目前為訪客模式，清除瀏覽器快取將會導致資料遺失。
                            <br/><strong>強烈建議您綁定 Google 帳號以永久保存紀錄。</strong>
                        </p>
                        <button onClick={handleLinkGoogle} className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-2 rounded-lg shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors">
                            <LogIn className="w-4 h-4 mr-2" />
                            綁定 Google 帳號
                        </button>
                    </div>
                ) : (
                    <div className="text-sm text-green-700 font-medium flex items-center">
                        <CheckCircle className="w-4 h-4 mr-2"/> 您的紀錄已安全連結至：{user?.email}
                    </div>
                )}
            </div>

            {/* 新增：健身旅程卡片 */}
            <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500" />健身旅程設定</h3>
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
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Calendar className="w-4 h-4 mr-1"/>開始接觸健身日期</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Timer className="w-4 h-4 mr-1"/>過往累積天數 (App使用前)</label>
                        <input type="number" value={baseTrainingDays} onChange={(e) => setBaseTrainingDays(e.target.value)} className="w-full p-2 border rounded-lg" placeholder="例如：100" />
                        <p className="text-xs text-gray-400 mt-1">輸入您在使用此 App 之前大概已經練了幾天，系統會自動加上 App 內的打卡次數。</p>
                    </div>
                    <button onClick={handleSaveSettings} className="w-full bg-gray-800 text-white font-bold py-2 rounded-lg hover:bg-gray-900 transition-colors">更新旅程設定</button>
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

const LibraryScreen = ({ weightHistory, movementDB, db, appId }) => {
    const [filter, setFilter] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingMove, setEditingMove] = useState(null); 
    const types = ['推', '拉', '腿', '核心'];
    const filteredMovements = movementDB.filter(m => (!filter || m.type === filter || m.name.includes(filter)));
    
    const handleSaveMovement = async () => {
        if (!db || !editingMove.name) return;
        const docId = editingMove.id || editingMove.name.trim(); 
        try { await setDoc(doc(db, `artifacts/${appId}/public/data/MovementDB`, docId), { ...editingMove, initialWeight: Number(editingMove.initialWeight||20) }); setIsEditing(false); setEditingMove(null); if (!editingMove.id) setFilter(''); } catch(e) { console.error(e); }
    };
    const handleDeleteMovement = async (id) => { if (confirm('刪除?')) await deleteDoc(doc(db, `artifacts/${appId}/public/data/MovementDB`, id)); };

    return (
        <>
            <MovementEditor isOpen={isEditing} onClose={() => setIsEditing(false)} onSave={handleSaveMovement} data={editingMove || {}} onChange={(f, v) => setEditingMove(p => ({ ...p, [f]: v }))} />
            <button onClick={() => {setEditingMove({ name: '', type: '', bodyPart: '', mainMuscle: '', secondaryMuscle: '', tips: '', link: '', initialWeight: 20 }); setIsEditing(true);}} className="w-full bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg mb-4 flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>新增自定義動作</button>
            <div className="flex justify-between space-x-2 mb-4 overflow-x-auto"><button onClick={() => setFilter('')} className={`p-2 rounded-full text-sm font-semibold whitespace-nowrap ${!filter ? 'bg-indigo-600 text-white' : 'bg-white'}`}>全部</button>{types.map(t => <button key={t} onClick={() => setFilter(t)} className={`p-2 rounded-full text-sm font-semibold whitespace-nowrap ${filter === t ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{t}</button>)}</div>
            <div className="space-y-3">{filteredMovements.map(move => {
                const record = weightHistory[move.name]?.absoluteBest;
                return (
                    <div key={move.id} className="bg-white p-4 rounded-xl shadow-lg border border-indigo-100">
                        <div className="flex justify-between items-start"><h3 className="text-xl font-bold text-gray-800">{move.name}</h3>{record && <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-md border border-yellow-200"><Crown className="w-3 h-3 text-yellow-600 mr-1" /><span className="text-xs font-bold text-yellow-700">PR: {record.weight}kg x {record.reps}</span></div>}</div>
                        <div className="text-sm mt-1 mb-2 flex justify-between items-center">
                            <div><span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 mr-2">{move.type}</span><span className="text-gray-600">{move.bodyPart} - {move.mainMuscle}</span></div>
                            <div className="flex space-x-2"><button onClick={() => {setEditingMove(move); setIsEditing(true);}} className="text-indigo-500 p-1"><Edit className="w-5 h-5"/></button><button onClick={() => handleDeleteMovement(move.id, move.name)} className="text-red-500 p-1"><Trash2 className="w-5 h-5"/></button></div>
                        </div>
                        <details className="text-gray-600 border-t pt-2 mt-2"><summary className="font-semibold cursor-pointer">動作提示</summary><p className="mt-2 text-sm">{move.tips}</p>{move.secondaryMuscle && <p className="text-xs text-gray-500 mt-1">協同: {move.secondaryMuscle}</p>}</details>
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
        setPlanMovements([...planMovements, { name: movementName, sets: 3, targetReps: 10, type: movementDetail.type }]);
    };

    const handleSave = async () => {
        if (!db || !userId || !planName) return;
        const docId = editingPlanId || `plan-${Date.now()}`;
        await setDoc(doc(db, `artifacts/${appId}/public/data/PlansDB`, docId), { name: planName, movements: planMovements, userId });
        setIsCreating(false); setEditingPlanId(null);
    };
    const handleDelete = async (id) => { if(confirm('刪除?')) await deleteDoc(doc(db, `artifacts/${appId}/public/data/PlansDB`, id)); };

    if (isCreating || editingPlanId) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md"><input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} className="text-xl font-bold w-2/3 p-2 border-b-2 outline-none" placeholder="菜單名稱" /><div className="flex space-x-2"><button onClick={() => {setEditingPlanId(null); setIsCreating(false);}} className="p-2 bg-gray-200 rounded-full"><X className="w-5 h-5"/></button><button onClick={handleSave} className="p-2 bg-indigo-600 text-white rounded-full"><Save className="w-5 h-5"/></button></div></div>
                <div className="space-y-3">{planMovements.map((m, i) => (<div key={i} className="flex items-center space-x-3 bg-white p-3 rounded-xl shadow-sm"><div className="flex-grow font-bold">{m.name}</div><input type="number" value={m.sets} onChange={(e)=>handleMovementUpdate(i, 'sets', e.target.value)} className="w-12 p-1 border rounded text-center"/>x<input type="number" value={m.targetReps} onChange={(e)=>handleMovementUpdate(i, 'targetReps', e.target.value)} className="w-12 p-1 border rounded text-center"/><button onClick={()=>setPlanMovements(planMovements.filter((_,idx)=>idx!==i))} className="text-red-500"><Trash2 className="w-5 h-5"/></button></div>))}</div>
                <div className="bg-white p-4 rounded-xl shadow-md border-t"><h4 className="font-bold mb-2">新增動作</h4><select value={tempSelectedMove} onChange={(e)=>{addMovementToPlan(e.target.value); setTempSelectedMove('');}} className="w-full p-2 border rounded-lg"><option value="" disabled>-- 選擇動作 --</option>{movementDB.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}</select></div>
            </div>
        );
    }
    return (
        <div className="space-y-4"><button onClick={() => setIsCreating(true)} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>創建菜單</button>{plansDB.map(p => (<div key={p.id} className={`bg-white p-4 rounded-xl shadow-lg ${selectedDailyPlanId===p.id?'border-4 border-indigo-400':''}`}><div className="flex justify-between items-start mb-2"><div><h3 className="text-xl font-bold">{p.name}</h3>{selectedDailyPlanId===p.id?<span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">今日使用</span>:<button onClick={()=>setSelectedDailyPlanId(p.id)} className="text-sm text-indigo-500">選為今日</button>}</div><div className="flex space-x-2"><button onClick={()=>setEditingPlanId(p.id)} className="text-gray-500"><Edit className="w-5 h-5"/></button><button onClick={()=>handleDelete(p.id)} className="text-red-500"><Trash2 className="w-5 h-5"/></button></div></div><p className="text-sm text-gray-600 mt-2 border-t pt-2">{p.movements?.slice(0,3).map(m=>m.name).join('、')}...</p></div>))}</div>
    );
};

const LogScreen = ({ selectedDailyPlanId, setSelectedDailyPlanId, plansDB, movementDB, weightHistory, db, userId, appId, setScreen }) => {
    const today = new Date().toISOString().substring(0, 10);
    const [selectedDate, setSelectedDate] = useState(today);
    const [currentLog, setCurrentLog] = useState([]);
    const [resetModalState, setResetModalState] = useState({ isOpen: false });
    const [addMoveModalOpen, setAddMoveModalOpen] = useState(false);
    const [isBodyMetricsModalOpen, setIsBodyMetricsModalOpen] = useState(false);

    useEffect(() => {
        const plan = plansDB.find(p => p.id === selectedDailyPlanId);
        if (plan) setCurrentLog(plan.movements.map(m => ({ order: 0, movementName: m.name, targetSets: m.sets, note: '', sets: Array(Number(m.sets)).fill({ reps: m.targetReps, weight: 0 }), rpe: 8 })));
    }, [plansDB, selectedDailyPlanId]);

    const handleSetUpdate = (mi, si, f, v) => {
        const newLog = [...currentLog]; newLog[mi].sets[si] = { ...newLog[mi].sets[si], [f]: Number(v) || v }; setCurrentLog(newLog);
    };
    const handleNoteUpdate = (mi, v) => { const newLog = [...currentLog]; newLog[mi].note = v; setCurrentLog(newLog); };
    const handleRpeUpdate = (mi, v) => { const newLog = [...currentLog]; newLog[mi].rpe = v; setCurrentLog(newLog); };
    const handleLogSubmit = async () => {
        const active = currentLog.filter(m => m.sets.some(s => s.weight > 0));
        if (active.length === 0) return;
        const sub = { date: new Date(selectedDate).getTime(), userId, menuId: selectedDailyPlanId, movements: active.map(m => ({ ...m, totalVolume: calculateTotalVolume(m.sets) })) };
        const total = sub.movements.reduce((s, m) => s + m.totalVolume, 0);
        await setDoc(doc(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), `${selectedDate}-${Date.now()}`), { ...sub, overallVolume: total });
        setScreen('Analysis');
    };
    
    const executeResetWeight = async (name, weight) => {
        await setDoc(doc(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), `reset-${Date.now()}`), { date: Date.now(), userId, movementName: name, isReset: true, resetWeight: weight });
        setResetModalState({ isOpen: false });
    };

    return (
        <>
            <WeightResetModal state={resetModalState} onClose={() => setResetModalState({ isOpen: false })} onConfirm={executeResetWeight} />
            <BodyMetricsModal isOpen={isBodyMetricsModalOpen} onClose={() => setIsBodyMetricsModalOpen(false)} onSave={async (d, w, f) => { await setDoc(doc(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`), `metrics-${d}`), { date: d, weight: w, bodyFat: f }); }} />
            <AddMovementModal isOpen={addMoveModalOpen} onClose={() => setAddMoveModalOpen(false)} movementDB={movementDB} onAdd={(name) => { setCurrentLog([...currentLog, { movementName: name, targetSets: 3, note: '', sets: Array(3).fill({ reps: 10, weight: 0 }), rpe: 8 }]); setAddMoveModalOpen(false); }} />
            
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-md mb-4">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                <button onClick={() => setIsBodyMetricsModalOpen(true)} className="p-2 bg-indigo-100 rounded-full text-indigo-600"><Scale className="w-5 h-5" /></button>
                <select value={selectedDailyPlanId || ''} onChange={(e) => setSelectedDailyPlanId(e.target.value)} className="p-2 border rounded-lg text-sm bg-white w-1/3"><option value="" disabled>菜單</option>{plansDB.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </div>
            
            <div className="space-y-4 pb-20">
                {currentLog.map((move, i) => (
                    <MovementLogCard key={i} move={move} index={i} weightHistory={weightHistory} movementDB={movementDB} handleSetUpdate={handleSetUpdate} handleNoteUpdate={handleNoteUpdate} handleRpeUpdate={(index, val) => handleRpeUpdate(i, val)} openResetModal={(name) => setResetModalState({ isOpen: true, movementName: name, initialWeight: 20 })} />
                ))}
                <button onClick={() => setAddMoveModalOpen(true)} className="w-full bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>新增動作</button>
                <button onClick={handleLogSubmit} disabled={currentLog.length === 0} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg my-4">完成訓練</button>
            </div>
        </>
    );
};

const AnalysisScreen = ({ logDB, bodyMetricsDB }) => {
    const [view, setView] = useState('Volume');
    const dailyVolume = useMemo(() => {
        const map = {};
        logDB.forEach(l => { if(!l.isReset) map[new Date(l.date).toLocaleDateString()] = (map[new Date(l.date).toLocaleDateString()] || 0) + l.overallVolume; });
        return Object.keys(map).map(d => ({ name: d, Volume: map[d] })).slice(-10);
    }, [logDB]);

    return (
        <div className="space-y-6">
            <div className="flex justify-center bg-white p-1 rounded-full shadow-md"><button onClick={() => setView('Volume')} className={`px-4 py-2 rounded-full ${view==='Volume'?'bg-indigo-600 text-white':'text-gray-600'}`}>訓練量</button><button onClick={() => setView('Body')} className={`px-4 py-2 rounded-full ${view==='Body'?'bg-indigo-600 text-white':'text-gray-600'}`}>身體數據</button></div>
            <div className="bg-white p-4 rounded-xl shadow-lg h-64 flex items-center justify-center text-gray-500">
                {view === 'Volume' && (dailyVolume.length ? <div className="w-full h-full flex items-end space-x-1">{dailyVolume.map((d,i) => <div key={i} className="bg-indigo-500 w-full rounded-t" style={{height: `${Math.min(100, d.Volume/100)}%`}}></div>)}</div> : "尚無數據")}
                {view === 'Body' && (bodyMetricsDB.length ? "圖表顯示區" : "尚無身體數據")}
            </div>
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

    const defaultMenuId = useMemo(() => plansDB.length > 0 ? plansDB[0].id : null, [plansDB]);
    const [selectedDailyPlanId, setSelectedDailyPlanId] = useState(defaultMenuId);

    useEffect(() => { if (plansDB.length > 0 && !selectedDailyPlanId) setSelectedDailyPlanId(plansDB[0].id); }, [plansDB, selectedDailyPlanId]);

    useEffect(() => {
        if (!auth) return;
        const init = async () => {
            if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
            else await signInAnonymously(auth);
            setUserId(auth.currentUser?.uid);
            setIsAuthReady(true);
        };
        init();
    }, []);

    useEffect(() => {
        if (!isAuthReady || !userId || !db) return;
        const unsub1 = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/MovementDB`)), (s) => setMovementDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub2 = onSnapshot(query(collection(db, `artifacts/${appId}/public/data/PlansDB`)), (s) => setPlansDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub3 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), orderBy('date', 'desc')), (s) => setLogDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub4 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`)), (s) => setBodyMetricsDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, [isAuthReady, userId]);

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
            case 'Library': return <ScreenContainer title="🏋️ 動作庫"><LibraryScreen weightHistory={weightHistory} movementDB={movementDB} db={db} appId={appId} /></ScreenContainer>;
            case 'Menu': return <ScreenContainer title="📋 菜單"><MenuScreen setSelectedDailyPlanId={setSelectedDailyPlanId} selectedDailyPlanId={selectedDailyPlanId} plansDB={plansDB} movementDB={movementDB} db={db} userId={userId} appId={appId} /></ScreenContainer>;
            case 'Analysis': return <ScreenContainer title="📈 分析"><AnalysisScreen logDB={logDB} bodyMetricsDB={bodyMetricsDB} /></ScreenContainer>;
            case 'Profile': return <ScreenContainer title="👤 個人"><ProfileScreen bodyMetricsDB={bodyMetricsDB} userId={userId} db={db} appId={appId} logDB={logDB} auth={auth} /></ScreenContainer>;
            default: return <ScreenContainer title="✍️ 紀錄"><LogScreen selectedDailyPlanId={selectedDailyPlanId} setSelectedDailyPlanId={setSelectedDailyPlanId} plansDB={plansDB} movementDB={movementDB} weightHistory={weightHistory} db={db} userId={userId} appId={appId} setScreen={setScreen} /></ScreenContainer>;
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
        <div className="pb-20">{children}</div>
    </div>
);
const NavMenu = ({ screen, setScreen }) => (
    <div className="fixed bottom-0 w-full bg-white border-t p-2 flex justify-around shadow-2xl z-50">
        {[
            { id: 'Log', icon: NotebookText, label: '紀錄' }, { id: 'Menu', icon: ListChecks, label: '菜單' },
            { id: 'Library', icon: Dumbbell, label: '動作庫' }, { id: 'Analysis', icon: BarChart3, label: '分析' }, { id: 'Profile', icon: User, label: '個人' }
        ].map(i => (
            <button key={i.id} onClick={() => setScreen(i.id)} className={`flex flex-col items-center ${screen===i.id?'text-indigo-600':'text-gray-400'}`}>
                <i.icon className="w-6 h-6" /><span className="text-xs">{i.label}</span>
            </button>
        ))}
    </div>
);

const setupInitialData = async (db, appId, userId) => {
    // (Mock data logic simplified for brevity, assume present)
};
if (auth) onAuthStateChanged(auth, (u) => { if(u) setupInitialData(db, appId, u.uid); });

export default App;