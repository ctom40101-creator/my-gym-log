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

// 圖片壓縮工具
const compressImage = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
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
        try { document.execCommand('copy'); alert('已複製提示詞！請貼上至 ChatGPT。'); } catch (err) { console.error('複製失敗', err); }
        document.body.removeChild(textArea);
    };
    return (
        <ModalContainer isOpen={isOpen} onClose={onClose}>
            <div className="bg-white p-6 relative">
                {isProcessing && (
                    <div className="absolute inset-0 bg-white bg-opacity-80 z-50 flex flex-col items-center justify-center rounded-xl">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
                        <span className="font-bold text-indigo-600">更新所有歷史紀錄中...</span>
                    </div>
                )}
                <h3 className="text-2xl font-bold text-indigo-600 border-b pb-2">{data.id ? '編輯動作' : '新增動作'}</h3>
                <div className="space-y-4 mt-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">動作名稱 <span className="text-red-500">*</span></label>
                        <input type="text" value={data.name} onChange={(e) => onChange('name', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-500 font-medium" placeholder="例如：寬握槓片划船" />
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-grow"><label className="block text-xs font-bold text-gray-500 mb-1">類型</label>
                            <select value={data.type || ''} onChange={(e) => onChange('type', e.target.value)} className="w-full p-2.5 border rounded-lg bg-white">{types.map(t => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                        <div className="flex-grow"><label className="block text-xs font-bold text-gray-500 mb-1">部位</label>
                            <select value={data.bodyPart || ''} onChange={(e) => onChange('bodyPart', e.target.value)} className="w-full p-2.5 border rounded-lg bg-white">{bodyParts.map(t => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                    </div>
                    <div><label className="block text-xs font-bold text-gray-500 mb-1">主要肌群</label><input type="text" value={data.mainMuscle} onChange={(e) => onChange('mainMuscle', e.target.value)} className="w-full p-2.5 border rounded-lg" /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">提示</label><textarea value={data.tips} onChange={(e) => onChange('tips', e.target.value)} rows="3" className="w-full p-2 border rounded-lg" /></div>
                    {data.name && (
                        <div className="mt-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-xs">
                           <div className="flex justify-between items-center mb-1"><span className="font-bold text-indigo-700">AI 輔助</span><button onClick={handleCopyPrompt} className="text-indigo-600 flex items-center"><Copy className="w-3 h-3 mr-1"/>複製</button></div>
                           {aiPrompt}
                        </div>
                    )}
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={onSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">儲存</button></div>
            </div>
        </ModalContainer>
    );
};

const MovementLogCard = ({ move, index, weightHistory, movementDB, handleSetUpdate, handleNoteUpdate, handleRpeUpdate, openResetModal }) => {
    const history = weightHistory[move.movementName] || {};
    const suggestion = history.suggestion || (movementDB.find(m => m.name === move.movementName)?.initialWeight || 20); 
    const movementDetail = movementDB.find(m => m.name === move.movementName) || {}; 
    const repsOptions = useMemo(() => Array.from({length: 20}, (_, i) => 20 - i), []);
    return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500 space-y-3">
            <div className="flex justify-between items-start border-b pb-2">
                <h4 className="text-lg font-bold text-gray-800">{move.movementName}</h4>
                <div className="flex space-x-3 items-center">
                    <details className="relative group"><summary className="text-indigo-500 cursor-pointer list-none flex items-center text-xs"><ListChecks className="w-4 h-4 mr-1"/>指引</summary><div className="absolute right-0 top-full mt-2 w-64 p-4 bg-white border rounded-xl shadow-2xl z-20 hidden group-open:block"><p className="text-xs text-gray-600 mb-2">{movementDetail.tips||'無'}</p>{movementDetail.link && <a href={movementDetail.link} target="_blank" className="text-xs text-blue-500 underline flex items-center"><PlayCircle className="w-3 h-3 mr-1" /> 影片</a>}</div></details>
                    <button onClick={() => openResetModal(move.movementName)} className="text-red-400 text-xs flex items-center"><RotateCcw className="w-3 h-3 mr-1"/>重置</button>
                </div>
            </div>
            <div className="flex justify-between text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg items-center">
                <div className="flex items-center"><TrendingUp className="w-4 h-4 mr-1 text-indigo-600" /><span className="font-semibold">建議:</span><span className="ml-1 text-lg font-extrabold text-indigo-800">{suggestion}kg</span></div>
                <div className="text-right text-xs">上次: {history.lastRecord ? `${history.lastRecord.weight}kg` : '無'}</div>
            </div>
            <div className="space-y-2">{move.sets.map((set, si) => (<div key={si} className="flex items-center space-x-2"><span className="w-8 text-xs text-gray-400 font-bold">S{si+1}</span><input type="number" value={set.weight} onChange={(e)=>handleSetUpdate(index,si,'weight',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold" /><select value={set.reps} onChange={(e)=>handleSetUpdate(index,si,'reps',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold bg-white">{repsOptions.map(num => <option key={num} value={num}>{num}</option>)}</select></div>))}</div>
            <RpeSelectorAlwaysVisible value={move.rpe || 8} onChange={(v) => handleRpeUpdate(index, v)} />
            <textarea placeholder="筆記..." value={move.note || ''} onChange={(e) => handleNoteUpdate(index, e.target.value)} rows="1" className="w-full p-2 border rounded-lg text-sm mt-2" />
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
            const q = query(collection(db, `artifacts/${appId}/public/data/UserIndex`));
            const snapshot = await getDocs(q);
            setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) { console.error(error); } finally { setIsLoading(false); }
    }, [db, appId]);
    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    return (
        <div className="space-y-4">
            <h3 className="font-bold text-red-800 flex items-center bg-red-50 p-4 rounded-xl border border-red-200"><Shield className="w-5 h-5 mr-2"/> 管理員專區</h3>
            {isLoading ? <Loader2 className="animate-spin mx-auto"/> : users.map(u => (
                <div key={u.id} className="bg-white p-4 rounded-xl border shadow-sm">
                    <div className="font-bold">{u.nickname || '未命名'}</div>
                    <div className="text-xs text-gray-400">{u.id}</div>
                </div>
            ))}
        </div>
    );
};

// ----------------------------------------------------
// ProfileScreen
// ----------------------------------------------------
const ProfileScreen = ({ bodyMetricsDB, userId, db, appId, logDB, auth }) => {
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
    const [nickname, setNickname] = useState('');
    const [user, setUser] = useState(auth?.currentUser);
    useEffect(() => { if(auth) return onAuthStateChanged(auth, (u) => setUser(u)); }, [auth]);
    const handleSave = async () => {
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`, `metrics-${date}`), { date, weight: parseFloat(weight), bodyFat: parseFloat(bodyFat) });
        alert('儲存成功');
    };
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100">
                <h3 className="text-xl font-bold flex items-center"><Activity className="w-5 h-5 mr-2 text-indigo-500" />身體數據</h3>
                <div className="space-y-4 mt-4">
                    <div className="flex gap-4">
                        <div className="w-1/2"><label className="text-xs font-bold text-gray-500">體重 (KG)</label><input type="number" value={weight} onChange={(e)=>setWeight(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                        <div className="w-1/2"><label className="text-xs font-bold text-gray-500">體脂 (%)</label><input type="number" value={bodyFat} onChange={(e)=>setBodyFat(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                    </div>
                    <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">更新體態</button>
                </div>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-lg overflow-x-auto">
                <table className="w-full text-sm"><thead><tr className="border-b"><th>日期</th><th>體重</th><th>體脂</th></tr></thead><tbody>{bodyMetricsDB.map(m=><tr key={m.id} className="text-center border-b"><td>{m.date}</td><td>{m.weight}</td><td>{m.bodyFat}</td></tr>)}</tbody></table>
            </div>
        </div>
    );
};

// ----------------------------------------------------
// LibraryScreen
// ----------------------------------------------------
const LibraryScreen = ({ weightHistory, movementDB, db, appId, userId, logDB, plansDB }) => {
    const [filter, setFilter] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingMove, setEditingMove] = useState(null);
    const filteredMovements = movementDB.filter(m => (!filter || m.bodyPart === filter || m.name.includes(filter)));
    const handleSaveMovement = async () => {
        const id = editingMove.id || editingMove.name;
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/MovementDB`, id), { ...editingMove });
        setIsEditing(false);
    };
    return (
        <div className="space-y-4">
            <MovementEditor isOpen={isEditing} onClose={() => setIsEditing(false)} onSave={handleSaveMovement} data={editingMove || {}} onChange={(f, v) => setEditingMove(p => ({ ...p, [f]: v }))} />
            <button onClick={() => {setEditingMove({ name: '', type: '', bodyPart: '' }); setIsEditing(true);}} className="w-full bg-teal-500 text-white font-bold py-3 rounded-xl flex items-center justify-center"><Plus className="w-5 h-5 mr-2"/>新增動作</button>
            <div className="space-y-3">{filteredMovements.map(move => (
                <div key={move.id} className="bg-white p-4 rounded-xl border shadow-lg flex justify-between items-center">
                    <div>
                        <div className="font-bold text-lg">{move.name}</div>
                        <div className="text-xs text-gray-500">{move.bodyPart} - {move.type}</div>
                    </div>
                    <button onClick={() => {setEditingMove(move); setIsEditing(true);}} className="text-indigo-500"><Edit className="w-5 h-5"/></button>
                </div>
            ))}</div>
        </div>
    );
};

// ----------------------------------------------------
// MenuScreen (新增 AI 總結助手)
// ----------------------------------------------------
const MenuScreen = ({ setSelectedDailyPlanId, selectedDailyPlanId, plansDB, movementDB, db, userId, appId, setScreen, currentLog, setCurrentLog }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [planName, setPlanName] = useState('');
    const [planMovements, setPlanMovements] = useState([]);
    const [tempSelectedMove, setTempSelectedMove] = useState('');
    const [promptBodyPart, setPromptBodyPart] = useState(''); // 新增：供提示詞使用的訓練部位

    useEffect(() => {
        const plan = editingPlanId ? plansDB.find(p => p.id === editingPlanId) : null;
        setPlanName(plan ? plan.name : '');
        setPlanMovements(plan ? plan.movements : []);
    }, [editingPlanId, plansDB]);

    const addMovementToPlan = (name) => {
        const detail = movementDB.find(m => m.name === name);
        setPlanMovements([...planMovements, { name, sets: 4, targetReps: 12, type: detail?.type || '' }]);
    };

    const handleSave = async () => {
        if (!planName) return alert('請輸入菜單名稱');
        const id = editingPlanId || `plan-${Date.now()}`;
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/PlansDB`, id), { name: planName, movements: planMovements, userId });
        setIsCreating(false); setEditingPlanId(null);
    };

    // 提示詞生成邏輯
    const getAiPrompt = () => {
        const movementSummary = planMovements.map(m => `${m.name} ${m.sets}組${m.targetReps}下`).join('\n');
        return `此菜單內容為：\n${movementSummary}\n\n我要練的部位是「${promptBodyPart || '(請填寫)'}」，請幫我評估如果：\n1.是否目標肌群過於重複以至於有可以少掉的動作\n2.目前動作順序需要調整嗎\n3.有沒有不足建議補上的部位\n4.總訓練量之組數與下數需要調整嗎`;
    };

    const handleCopyAiPrompt = () => {
        const text = getAiPrompt();
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert('已複製提示詞！請貼上至 ChatGPT 進行評估。');
        } catch (err) {
            console.error('複製失敗', err);
        }
        document.body.removeChild(textArea);
    };

    if (isCreating || editingPlanId) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md">
                    <input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} className="text-xl font-bold w-2/3 border-b outline-none" placeholder="菜單名稱" />
                    <div className="flex space-x-2">
                        <button onClick={() => {setIsCreating(false); setEditingPlanId(null);}} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
                        <button onClick={handleSave} className="p-2 bg-indigo-600 text-white rounded-full"><Save className="w-5 h-5"/></button>
                    </div>
                </div>
                <div className="space-y-2">
                    {planMovements.map((m, i) => (
                        <div key={i} className="flex items-center space-x-2 bg-white p-3 rounded-xl border">
                            <span className="flex-grow font-bold">{m.name}</span>
                            <input type="number" value={m.sets} onChange={(e)=>{const n=[...planMovements]; n[i].sets=e.target.value; setPlanMovements(n);}} className="w-10 text-center border rounded" />
                            <span className="text-xs">組</span>
                            <input type="number" value={m.targetReps} onChange={(e)=>{const n=[...planMovements]; n[i].targetReps=e.target.value; setPlanMovements(n);}} className="w-10 text-center border rounded" />
                            <span className="text-xs">下</span>
                            <button onClick={()=>setPlanMovements(planMovements.filter((_,idx)=>idx!==i))} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
                <div className="bg-white p-4 rounded-xl border">
                    <h4 className="font-bold text-sm text-gray-500 mb-2">新增動作</h4>
                    <select value={tempSelectedMove} onChange={(e)=>{addMovementToPlan(e.target.value); setTempSelectedMove('');}} className="w-full p-2 border rounded-lg bg-gray-50">
                        <option value="" disabled>-- 選擇動作 --</option>
                        {movementDB.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
                    </select>
                </div>

                {/* AI 評估助手區塊 */}
                {planMovements.length > 0 && (
                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 space-y-3 shadow-sm mt-6">
                        <h4 className="flex items-center font-bold text-indigo-700">
                            <Sparkles className="w-5 h-5 mr-2" /> AI 菜單評估助手
                        </h4>
                        
                        <div>
                            <label className="text-xs font-bold text-indigo-600 mb-1 block">我要練的部位是：</label>
                            <input 
                                type="text" 
                                value={promptBodyPart} 
                                onChange={(e) => setPromptBodyPart(e.target.value)}
                                className="w-full p-2 border border-indigo-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-400 outline-none" 
                                placeholder="例如：胸背超級組 / 腿部與臀部"
                            />
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-indigo-100 max-h-40 overflow-y-auto">
                            <pre className="text-[10px] text-gray-500 whitespace-pre-wrap leading-relaxed font-sans">
                                {getAiPrompt()}
                            </pre>
                        </div>

                        <button 
                            onClick={handleCopyAiPrompt}
                            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-lg active:scale-95"
                        >
                            <ClipboardCopy className="w-5 h-5 mr-2" /> 複製評估提示詞 (給 GPT)
                        </button>
                        <p className="text-[10px] text-center text-indigo-400">複製後將內容貼給 ChatGPT，即可獲得專業建議！</p>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <button onClick={() => setIsCreating(true)} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl flex items-center justify-center"><Plus className="w-5 h-5 mr-2"/>創建菜單</button>
            {plansDB.map(p => (
                <div key={p.id} className="bg-white p-4 rounded-xl border shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xl font-bold">{p.name}</h3>
                        <div className="flex space-x-2">
                            <button onClick={()=>setEditingPlanId(p.id)} className="text-gray-400"><Edit className="w-5 h-5"/></button>
                            <button onClick={async ()=>{if(confirm('刪除?')) await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/PlansDB`, p.id));}} className="text-red-400"><Trash2 className="w-5 h-5"/></button>
                        </div>
                    </div>
                    <div className="text-sm text-gray-500">{p.movements?.map(m=>m.name).join('、').slice(0,25)}...</div>
                    <button onClick={()=>{setCurrentLog(p.movements.map(m=>({ movementName: m.name, sets: Array(Number(m.sets||4)).fill({reps: m.targetReps||12, weight: 0}), rpe: 8 }))); setScreen('Log');}} className="w-full bg-indigo-50 text-indigo-600 font-bold py-2 rounded-lg mt-3">使用此菜單</button>
                </div>
            ))}
        </div>
    );
};

// ----------------------------------------------------
// Analysis & Main App
// ----------------------------------------------------
const AnalysisScreen = ({ logDB, movementDB }) => {
    const stats = useMemo(() => {
        const monthCount = new Set(logDB.map(l => new Date(l.date).toDateString())).size;
        return { monthCount };
    }, [logDB]);
    return (
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
                <div className="text-gray-500 text-xs font-bold">本月訓練次數</div>
                <div className="text-3xl font-extrabold text-indigo-600">{stats.monthCount} 次</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <h3 className="font-bold mb-3">歷史紀錄</h3>
                {logDB.map(l => (
                    <div key={l.id} className="border-b py-2 text-sm flex justify-between">
                        <span>{new Date(l.date).toLocaleDateString()}</span>
                        <span className="font-bold">{l.overallVolume || 0}kg</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LogScreen = ({ plansDB, movementDB, weightHistory, db, userId, appId, setScreen, currentLog, setCurrentLog }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().substring(0, 10));
    const handleSetUpdate = (mi, si, f, v) => {
        const n = [...currentLog]; n[mi].sets[si] = { ...n[mi].sets[si], [f]: Number(v) || v }; setCurrentLog(n);
    };
    const handleLogSubmit = async () => {
        const active = currentLog.filter(m => m.sets.some(s => s.weight > 0));
        if (active.length === 0) return alert('請填寫重量');
        const docId = `${selectedDate}-${Date.now()}`;
        const total = active.reduce((s, m) => s + calculateTotalVolume(m.sets), 0);
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/LogDB`, docId), { date: new Date(selectedDate).getTime(), movements: active, overallVolume: total, userId });
        setCurrentLog([]); alert('儲存成功');
    };
    return (
        <div className="space-y-4 pb-20">
            <div className="bg-white p-3 rounded-xl shadow-md flex justify-between items-center mb-4">
                <input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
                <button onClick={()=>{setCurrentLog([]);}} className="p-2 text-red-500 text-xs font-bold">清空草稿</button>
            </div>
            {currentLog.map((move, i) => (
                <MovementLogCard key={i} index={i} move={move} weightHistory={weightHistory} movementDB={movementDB} handleSetUpdate={handleSetUpdate} handleRpeUpdate={(mi,v)=>{const n=[...currentLog]; n[mi].rpe=v; setCurrentLog(n);}} handleNoteUpdate={(mi,v)=>{const n=[...currentLog]; n[mi].note=v; setCurrentLog(n);}} openResetModal={()=>{}} />
            ))}
            {currentLog.length > 0 ? (
                <button onClick={handleLogSubmit} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg">完成訓練</button>
            ) : (
                <div className="text-center py-20 text-gray-400">去「菜單」頁面選個菜單開始吧！</div>
            )}
        </div>
    );
};

const App = () => {
    const [screen, setScreen] = useState('Log'); 
    const [userId, setUserId] = useState(null);
    const [movementDB, setMovementDB] = useState([]); 
    const [plansDB, setPlansDB] = useState([]); 
    const [logDB, setLogDB] = useState([]); 
    const [bodyMetricsDB, setBodyMetricsDB] = useState([]); 
    const [weightHistory, setWeightHistory] = useState({});
    const [currentLog, setCurrentLog] = useState([]);

    useEffect(() => {
        onAuthStateChanged(auth, async (u) => {
            if (!u) await signInAnonymously(auth);
            else setUserId(u.uid);
        });
    }, []);

    useEffect(() => {
        if (!userId) return;
        const unsub1 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/MovementDB`)), (s) => setMovementDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub2 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/PlansDB`)), (s) => setPlansDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub3 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/LogDB`), orderBy('date', 'desc')), (s) => setLogDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsub4 = onSnapshot(query(collection(db, `artifacts/${appId}/users/${userId}/BodyMetricsDB`)), (s) => setBodyMetricsDB(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, [userId]);

    const renderScreen = () => {
        const props = { movementDB, plansDB, logDB, bodyMetricsDB, weightHistory, db, appId, userId, setScreen, currentLog, setCurrentLog };
        switch (screen) {
            case 'Library': return <Screen title="動作庫" children={<LibraryScreen {...props} />} />;
            case 'Menu': return <Screen title="菜單" children={<MenuScreen {...props} />} />;
            case 'Analysis': return <Screen title="分析" children={<AnalysisScreen {...props} />} />;
            case 'Profile': return <Screen title="個人" children={<ProfileScreen {...props} />} />;
            default: return <Screen title="記錄" children={<LogScreen {...props} />} />;
        }
    };

    return (
        <div className="h-screen bg-gray-50 flex flex-col">
            <div className="flex-grow overflow-hidden">{renderScreen()}</div>
            <Nav screen={screen} setScreen={setScreen} />
        </div>
    );
};

const Screen = ({ title, children }) => (
    <div className="h-full overflow-y-auto p-4 pt-8">
        <h1 className="text-3xl font-extrabold mb-6 border-b-2 border-indigo-200 pb-2">{title}</h1>
        <div className="pb-32">{children}</div>
    </div>
);

const Nav = ({ screen, setScreen }) => (
    <div className="fixed bottom-0 w-full bg-white border-t p-4 flex justify-around shadow-lg z-50">
        {[
            { id: 'Log', icon: NotebookText, label: '記錄' },
            { id: 'Menu', icon: ListChecks, label: '菜單' },
            { id: 'Library', icon: Dumbbell, label: '動作庫' },
            { id: 'Analysis', icon: BarChart3, label: '分析' },
            { id: 'Profile', icon: User, label: '個人' }
        ].map(i => (
            <button key={i.id} onClick={() => setScreen(i.id)} className={`flex flex-col items-center ${screen===i.id?'text-indigo-600':'text-gray-400'}`}>
                <i.icon className="w-6 h-6" />
                <span className="text-[10px] font-bold">{i.label}</span>
            </button>
        ))}
    </div>
);

export default App;