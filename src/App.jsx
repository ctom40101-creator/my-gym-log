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
import { getFirestore, doc, setDoc, collection, query, onSnapshot, getDocs, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import {
  Dumbbell, Menu, NotebookText, BarChart3, ListChecks, ArrowLeft, RotateCcw, TrendingUp,
  Weight, Calendar, Sparkles, AlertTriangle, Armchair, Plus, Trash2, Edit, Save, X, Scale, ListPlus, ChevronDown, CheckCircle, Info, Wand2, MousePointerClick, Crown, Activity, User, PenSquare, Trophy, Timer, Copy, ShieldCheck, LogIn, LogOut, Loader2, Bug, Smartphone, Mail, Lock, KeyRound, UserX, CheckSquare, Square, FileSpreadsheet, Upload, Download, Undo2, PlayCircle, LineChart, PieChart, History, Eraser, Shield, RefreshCw, GripVertical, Camera, Image as ImageIcon, ChevronUp, Grid, ClipboardCopy
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "AIzaSyBsHIPtSV_wRioxBKYOqzgLGwZHWWfZcNc",
      authDomain: "mygymlog-604bc.firebaseapp.com",
      projectId: "mygymlog-604bc",
      storageBucket: "mygymlog-604bc.firebasestorage.app",
      messagingSenderId: "980701704046",
      appId: "1:980701704046:web:22a2b1a727fa511107db7f",
      measurementId: "G-MPXB8R0L6H"
    };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mygymlog-604bc'; 

const ADMIN_EMAIL = 'ctom40101@gmail.com';

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

const RPE_UP_THRESHOLD = 7;      
const RPE_DOWN_THRESHOLD = 9.5; 
const WEIGHT_INCREASE_MULTIPLIER = 1.025; 
const WEIGHT_DECREASE_MULTIPLIER = 0.975; 

// --- Utility Functions ---
const calculateTotalVolume = (log) => {
  if (!log || !Array.isArray(log)) return 0;
  return log.reduce((total, set) => total + (Number(set.reps || 0) * Number(set.weight || 0)), 0);
};

const estimate1RM = (weight, reps) => {
    if (!weight || weight === 0) return 0;
    if (reps === 1) return weight;
    if (reps >= 15) return weight; 
    return Math.round(weight * (1 + reps / 30) * 10) / 10;
};

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
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

// --- Components ---
const ModalContainer = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75" onClick={onClose}></div>
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
                <h3 className="text-xl font-bold text-indigo-600 flex items-center border-b pb-2"><Activity className="w-6 h-6 mr-2" />快速紀錄身體數據</h3>
                <div className="space-y-4 mt-4">
                    <div><label className="block text-sm font-medium text-gray-700">日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                    <div className="flex gap-4">
                        <div className="w-1/2"><label className="block text-sm font-medium text-gray-700">體重 (KG)</label><input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div>
                        <div className="w-1/2"><label className="block text-sm font-medium text-gray-700">體脂 (%)</label><input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} className="w-full p-2 border rounded-lg" step="0.1" /></div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-4"><button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">儲存</button></div>
                </div>
            </div>
        </ModalContainer>
    );
};

const WeightResetModal = ({ state, onClose, onConfirm }) => {
    const [weight, setWeight] = useState(state.initialWeight || 20);
    useEffect(() => { setWeight(state.initialWeight || 20); }, [state.initialWeight]);
    return (
        <ModalContainer isOpen={state.isOpen} onClose={onClose}>
            <div className="bg-white p-6">
                <h3 className="text-xl font-bold text-red-600 flex items-center border-b pb-2"><RotateCcw className="w-6 h-6 mr-2" />重置訓練進度</h3>
                <p className="text-gray-700 mt-4">確定要重置 **{state.movementName}** 的重量嗎？</p>
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
        const textArea = document.createElement("textarea");
        textArea.value = aiPrompt;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('已複製提示詞！');
    };
    return (
        <ModalContainer isOpen={isOpen} onClose={onClose}>
            <div className="bg-white p-6 relative">
                {isProcessing && (
                    <div className="absolute inset-0 bg-white bg-opacity-80 z-50 flex flex-col items-center justify-center rounded-xl">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
                        <span className="font-bold text-indigo-600">更新中...</span>
                    </div>
                )}
                <h3 className="text-2xl font-bold text-indigo-600 border-b pb-2">{data.id ? '編輯動作' : '新增動作'}</h3>
                <div className="space-y-4 mt-4">
                    <div><label className="block text-sm font-medium text-gray-700">動作名稱 *</label><input type="text" value={data.name || ''} onChange={(e) => onChange('name', e.target.value)} className="w-full p-3 border rounded-lg focus:border-indigo-500" placeholder="例如：寬握槓片划船" /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-gray-500">類型 *</label><select value={data.type || ''} onChange={(e) => onChange('type', e.target.value)} className="w-full p-2.5 border rounded-lg"><option value="" disabled>選擇</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        <div><label className="block text-xs font-bold text-gray-500">部位 *</label><select value={data.bodyPart || ''} onChange={(e) => onChange('bodyPart', e.target.value)} className="w-full p-2.5 border rounded-lg"><option value="" disabled>選擇</option>{bodyParts.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-gray-500">主要肌群</label><input type="text" value={data.mainMuscle || ''} onChange={(e) => onChange('mainMuscle', e.target.value)} className="w-full p-2.5 border rounded-lg" /></div>
                        <div><label className="block text-xs font-bold text-gray-500">協同肌群</label><input type="text" value={data.secondaryMuscle || ''} onChange={(e) => onChange('secondaryMuscle', e.target.value)} className="w-full p-2.5 border rounded-lg" /></div>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700">初始建議重量 (KG)</label><input type="number" value={data.initialWeight || 0} onChange={(e) => onChange('initialWeight', e.target.value)} className="w-full p-2 border rounded-lg" min="0" /></div>
                    <div><label className="block text-sm font-medium text-gray-700">要點</label><textarea value={data.tips || ''} onChange={(e) => onChange('tips', e.target.value)} rows="2" className="w-full p-2 border rounded-lg" /></div>
                    {data.name && (
                        <div className="mt-2 bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex justify-between items-center">
                            <span className="text-xs font-bold text-indigo-700">AI 輔助提示詞</span>
                            <button onClick={handleCopyPrompt} className="text-xs flex items-center bg-white px-2 py-1 rounded border border-indigo-200 text-indigo-600"><Copy className="w-3 h-3 mr-1"/>複製</button>
                        </div>
                    )}
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4"><button onClick={onClose} disabled={isProcessing} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button><button onClick={onSave} disabled={isProcessing} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">儲存動作</button></div>
            </div>
        </ModalContainer>
    );
};

const MovementLogCard = ({ move, index, weightHistory, movementDB, handleSetUpdate, handleNoteUpdate, handleRpeUpdate, openResetModal }) => {
    const history = weightHistory[move.movementName] || {};
    const suggestion = history.suggestion || (movementDB.find(m => m.name === move.movementName)?.initialWeight || 20); 
    const repsOptions = useMemo(() => Array.from({length: 20}, (_, i) => 20 - i), []);

    return (
        <div className="bg-white p-4 rounded-xl shadow-lg border-l-4 border-indigo-500 space-y-3">
            <div className="flex justify-between items-start border-b pb-2 mb-2">
                <h4 className="text-lg font-bold text-gray-800">{move.movementName}</h4>
                <div className="flex space-x-3 items-center">
                    <button onClick={() => openResetModal(move.movementName)} className="text-red-400 text-xs flex items-center"><RotateCcw className="w-3 h-3 mr-1"/>重置</button>
                </div>
            </div>
            <div className="flex justify-between text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg">
                <div className="flex items-center"><TrendingUp className="w-4 h-4 mr-1 text-indigo-600" /><span className="font-semibold">建議:</span><span className="ml-1 text-lg font-extrabold text-indigo-800">{suggestion}kg</span></div>
                <div className="text-right text-xs">上次: <span className="font-medium text-gray-800">{history.lastRecord ? `${history.lastRecord.weight}kg` : '無'}</span></div>
            </div>
            <div className="space-y-2">{move.sets.map((set, si) => (
                <div key={si} className="flex items-center space-x-2">
                    <span className="w-8 text-xs text-gray-400 font-bold">S{si+1}</span>
                    <input type="number" value={set.weight} onChange={(e)=>handleSetUpdate(index,si,'weight',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold" />
                    <select value={set.reps} onChange={(e)=>handleSetUpdate(index,si,'reps',e.target.value)} className="w-full p-2 border rounded-lg text-center font-bold bg-white">{repsOptions.map(num => <option key={num} value={num}>{num}</option>)}</select>
                </div>
            ))}</div>
            <RpeSelectorAlwaysVisible value={move.rpe || 8} onChange={(v) => handleRpeUpdate(index, v)} />
            <textarea placeholder="訓練筆記..." value={move.note || ''} onChange={(e) => handleNoteUpdate(index, e.target.value)} rows="1" className="w-full p-2 border rounded-lg text-sm" />
        </div>
    );
};

// --- Screen Components ---

const AdminScreen = ({ db, appId }) => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const snapshot = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'UserIndex')));
            setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch(e) { console.error(e); } finally { setIsLoading(false); }
    }, [db, appId]);
    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    return (
        <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <h3 className="font-bold text-red-800 flex items-center"><Shield className="w-5 h-5 mr-2"/> 管理員專區</h3>
            </div>
            {isLoading ? <Loader2 className="animate-spin mx-auto mt-10 text-indigo-500" /> : users.map(u => (
                <div key={u.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div className="font-bold">{u.nickname || '未命名'}</div>
                    <div className="text-xs text-gray-400">UID: {u.id}</div>
                </div>
            ))}
        </div>
    );
};

const ProfileScreen = ({ bodyMetricsDB, userId, db, appId, logDB, auth }) => {
    const [nickname, setNickname] = useState('');
    const [startDate, setStartDate] = useState('');

    useEffect(() => {
        if (!userId) return;
        const fetchSettings = async () => {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'users', userId, 'Settings', 'profile'));
            if (snap.exists()) {
                setNickname(snap.data().nickname || '');
                setStartDate(snap.data().startDate || '');
            }
        };
        fetchSettings();
    }, [userId, db, appId]);

    const handleSaveSettings = async () => {
        if (!userId) return;
        await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'Settings', 'profile'), { nickname, startDate });
        alert('設定已儲存');
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                <h3 className="text-xl font-bold mb-4 flex items-center"><User className="w-5 h-5 mr-2 text-indigo-600" /> 個人設定</h3>
                <div className="space-y-4">
                    <div><label className="text-sm font-bold">暱稱</label><input type="text" value={nickname} onChange={e=>setNickname(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                    <div><label className="text-sm font-bold">訓練開始日期</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full p-2 border rounded-lg" /></div>
                    <button onClick={handleSaveSettings} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold shadow-md">儲存設定</button>
                </div>
            </div>
        </div>
    );
};

const LibraryScreen = ({ weightHistory, movementDB, db, appId, userId }) => {
    const [filter, setFilter] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingMove, setEditingMove] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const categories = ['胸', '背', '腿', '肩', '手臂', '核心', '全身'];
    const filteredMovements = movementDB.filter(m => (!filter || m.bodyPart === filter || m.name.includes(filter)));

    const handleSaveMovement = async () => {
        if (!editingMove.name || !editingMove.type || !editingMove.bodyPart) return alert("資訊不完整");
        if (!userId) return;
        setIsProcessing(true);
        try {
            await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'MovementDB', editingMove.name), { ...editingMove, initialWeight: Number(editingMove.initialWeight||0) });
            setIsEditing(false);
            setEditingMove(null);
        } finally { setIsProcessing(false); }
    };

    return (
        <div className="space-y-4">
            <MovementEditor isOpen={isEditing} onClose={() => setIsEditing(false)} onSave={handleSaveMovement} data={editingMove || {}} onChange={(f, v) => setEditingMove(p => ({ ...p, [f]: v }))} isProcessing={isProcessing} />
            <button onClick={() => {setEditingMove({ name: '', type: '', bodyPart: '', mainMuscle: '', tips: '', initialWeight: 0 }); setIsEditing(true);}} className="w-full bg-teal-500 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>手動新增動作</button>
            <div className="flex space-x-2 overflow-x-auto pb-2">
                <button onClick={() => setFilter('')} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold shadow-sm ${!filter ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>全部</button>
                {categories.map(c => <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold shadow-sm ${filter === c ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>{c}</button>)}
            </div>
            <div className="space-y-3">
                {filteredMovements.map(m => (
                    <div key={m.id} className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 flex justify-between items-center">
                        <div>
                            <div className="font-bold text-lg text-gray-800">{m.name}</div>
                            <div className="text-xs text-gray-400">{m.bodyPart} | {m.type}</div>
                        </div>
                        <button onClick={() => {setEditingMove(m); setIsEditing(true);}} className="text-indigo-500 hover:bg-indigo-50 p-2 rounded-lg"><Edit className="w-5 h-5"/></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MenuScreen = ({ setSelectedDailyPlanId, selectedDailyPlanId, plansDB, movementDB, db, userId, appId, setScreen, currentLog, setCurrentLog }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [planName, setPlanName] = useState('');
    const [planMovements, setPlanMovements] = useState([]);
    const [tempSelectedMove, setTempSelectedMove] = useState('');
    const [aiEvalBodyPart, setAiEvalBodyPart] = useState('');

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
        if (!planName || !userId) return;
        const docId = editingPlanId || `plan-${Date.now()}`;
        await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'PlansDB', docId), { name: planName, movements: planMovements, userId });
        setIsCreating(false); setEditingPlanId(null);
    };

    const handleUsePlan = (plan) => {
        if (currentLog.length > 0 && !confirm("載入新菜單將會覆蓋目前的紀錄，確定嗎？")) return;
        setSelectedDailyPlanId(plan.id);
        setCurrentLog(plan.movements.map(m => ({ 
            movementName: m.name, 
            targetSets: m.sets, 
            sets: Array(Number(m.sets || 4)).fill({ reps: m.targetReps || 12, weight: 0 }), 
            rpe: 8 
        })));
        setScreen('Log');
    };

    const aiSingleSummaryPrompt = useMemo(() => {
        const moveList = planMovements.map(m => `${m.name} ${m.sets}組${m.targetReps}下`).join('\n');
        return `此菜單內容為\n${moveList}\n我要練的部位是「${aiEvalBodyPart || '______'}」，如果我組間休息時間都是1分半的話，請幫我評估如果：\n1.是否整體目標肌群過於重複，有建議少掉的動作嗎\n2.目前動作順序需要調整嗎\n3.有沒有不足建議補上的部位\n4.總訓練量之組數與下數需要調整嗎，如果有需要分別給我我的版本與你建議的版本的建議\n5.如果不照你的建議，依然使用我的菜單與對應組數與下數，滿分100分，不及格60，可直接操課使用為80分的話，我的你認為是幾分`;
    }, [planMovements, aiEvalBodyPart]);

    const globalGptPrompt = useMemo(() => {
        if (plansDB.length === 0) return "尚無已創建的菜單。";
        let menuDetails = "";
        plansDB.slice(0, 6).forEach((plan, index) => {
            const moves = plan.movements?.map(m => ` - ${m.name}: ${m.sets}組 x ${m.targetReps}下`).join('\n') || "無動作";
            menuDetails += `【選單 ${index + 1}: ${plan.name}】\n${moves}\n\n`;
        });
        return `給我6個選單，選單內容即為我創建的菜單如下：\n\n${menuDetails}這是我的一份循環訓練菜單，進行下個循環前會有至少一天休息日，如果我組間休息時間都是1分半的話，請幫我評估：\n1.考量整個循環是否整體目標肌群過於重複，有建議少掉的動作嗎\n2.各別菜單的動作順序需要調整嗎\n3.考量整個循環，有沒有不足建議補上的部位\n4.考量整個循環總訓練量之組數與下數需要調整嗎，如果有需要分別給我我的版本與你建議的版本的建議\n5.滿分100分，不及格60，可直接操課使用為80分的話，我的你認為是幾分\n6.如果你給我的分數已超過80分，現在不調整我的菜單，目前的對應組數與下數是否ok還是需要調整？`;
    }, [plansDB]);

    const copyToClipboard = (text, msg) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(msg);
    };

    if (isCreating || editingPlanId) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-md"><input type="text" value={planName} onChange={(e) => setPlanName(e.target.value)} className="text-xl font-bold w-2/3 p-2 border-b-2 outline-none" placeholder="菜單名稱" /><div className="flex space-x-2"><button onClick={() => {setEditingPlanId(null); setIsCreating(false);}} className="p-2 bg-gray-200 rounded-full"><X className="w-5 h-5"/></button><button onClick={handleSave} className="p-2 bg-indigo-600 text-white rounded-full"><Save className="w-5 h-5"/></button></div></div>
                <div className="space-y-3">
                    {planMovements.map((m, i) => (
                        <div key={i} className="flex items-center space-x-2 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex-grow font-bold text-sm text-gray-700">{m.name}</div>
                            <input type="number" value={m.sets} onChange={(e)=>handleMovementUpdate(i, 'sets', e.target.value)} className="w-10 p-1 border rounded text-center text-xs font-bold text-indigo-600"/>
                            <span className="text-gray-400 text-[10px]">組</span>
                            <input type="number" value={m.targetReps} onChange={(e)=>handleMovementUpdate(i, 'targetReps', e.target.value)} className="w-10 p-1 border rounded text-center text-xs font-bold text-indigo-600"/>
                            <button onClick={()=>setPlanMovements(planMovements.filter((_,idx)=>idx!==i))} className="text-red-500 ml-1"><Trash2 className="w-5 h-5"/></button>
                        </div>
                    ))}
                </div>
                <div className="bg-white p-4 rounded-xl shadow-md">
                    <h4 className="font-bold mb-2 text-sm text-gray-600">新增動作至此菜單</h4>
                    <select value={tempSelectedMove} onChange={(e)=>{addMovementToPlan(e.target.value); setTempSelectedMove('');}} className="w-full p-2 border rounded-lg text-sm bg-gray-50"><option value="" disabled>-- 選擇動作庫中的動作 --</option>{movementDB.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}</select>
                </div>
                {planMovements.length > 0 && (
                    <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-3 shadow-sm">
                        <div className="flex justify-between items-center"><h4 className="font-bold text-indigo-700 text-sm flex items-center"><Sparkles className="w-4 h-4 mr-1"/>單一菜單 AI 助手</h4><button onClick={()=>copyToClipboard(aiSingleSummaryPrompt, '單一評估提示詞已複製')} className="bg-white p-1.5 rounded-lg text-indigo-600 border border-indigo-200 text-xs font-bold shadow-sm"><ClipboardCopy className="w-3 h-3 mr-1"/>複製</button></div>
                        <input type="text" value={aiEvalBodyPart} onChange={(e) => setAiEvalBodyPart(e.target.value)} className="w-full p-2 border border-indigo-200 rounded-lg text-xs" placeholder="設定訓練目標部位 (如：推日、胸部、全身分化)..." />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <button onClick={() => setIsCreating(true)} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg flex justify-center items-center"><Plus className="w-5 h-5 mr-2"/>創建新菜單</button>
            </div>
            <div className="space-y-3">
                {plansDB.map(p => (
                    <div key={p.id} className={`bg-white p-4 rounded-xl shadow-lg border transition-all ${selectedDailyPlanId===p.id?'border-4 border-indigo-400':''}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{p.name}</h3>
                                <button onClick={()=>handleUsePlan(p)} className="text-sm text-indigo-500 font-bold mt-1 bg-indigo-50 px-2 py-0.5 rounded">選為今日訓練</button>
                            </div>
                            <div className="flex space-x-2"><button onClick={()=>setEditingPlanId(p.id)} className="text-gray-400 p-1"><Edit className="w-5 h-5"/></button><button onClick={async ()=>{if(confirm('確定刪除此菜單？')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'PlansDB', p.id));}} className="text-red-400 p-1"><Trash2 className="w-5 h-5"/></button></div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 border-t pt-2 italic">{p.movements?.slice(0,4).map(m=>m.name).join('、')}...</p>
                    </div>
                ))}
            </div>

            {plansDB.length > 0 && (
                <div className="bg-gradient-to-br from-gray-900 to-indigo-900 p-5 rounded-2xl shadow-xl mt-10 border border-indigo-400">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center text-white">
                            <Sparkles className="w-5 h-5 mr-2 text-yellow-400" />
                            <h3 className="font-bold text-lg">全週期 GPT 評估總結</h3>
                        </div>
                        <button 
                            onClick={() => copyToClipboard(globalGptPrompt, '全週期評估提示詞已複製！')}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center transition-all active:scale-95 shadow-lg border border-indigo-400"
                        >
                            <ClipboardCopy className="w-4 h-4 mr-1" /> 複製全週期評估
                        </button>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl border border-white/10">
                        <p className="text-gray-300 text-[11px] leading-relaxed line-clamp-3 italic">
                            抓取目前所有創建的菜單，生成一份包含選單內容、循環休息、動作順序、肌群重複性與組數建議的 GPT 完整提問。
                        </p>
                        <div className="mt-3 text-[10px] text-indigo-300 font-bold">已彙整目前 {plansDB.length} 個菜單資訊</div>
                    </div>
                </div>
            )}
        </div>
    );
};

const LogScreen = ({ selectedDailyPlanId, setSelectedDailyPlanId, plansDB, movementDB, weightHistory, db, userId, appId, setScreen, currentLog, setCurrentLog }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().substring(0, 10));
    const [resetModalState, setResetModalState] = useState({ isOpen: false });
    const [addMoveModalOpen, setAddMoveModalOpen] = useState(false);

    const handleLogSubmit = async () => {
        if (!userId) return;
        const active = currentLog.filter(m => m.sets.some(s => s.weight > 0));
        if (active.length === 0) return alert("請填寫至少一組重量");
        const docId = `${selectedDate}-${Date.now()}`;
        await setDoc(doc(collection(db, 'artifacts', appId, 'users', userId, 'LogDB'), docId), { 
            date: new Date(selectedDate).getTime(), 
            movements: active, 
            overallVolume: active.reduce((s, m) => s + calculateTotalVolume(m.sets), 0)
        });
        setCurrentLog([]); setSelectedDailyPlanId('');
        setScreen('Analysis');
    };

    return (
        <div className="space-y-4">
            <WeightResetModal state={resetModalState} onClose={() => setResetModalState({ isOpen: false })} onConfirm={async (name, w) => { await setDoc(doc(collection(db, 'artifacts', appId, 'users', userId, 'LogDB'), `reset-${Date.now()}`), { movementName: name, resetWeight: w, isReset: true, date: Date.now() }); setResetModalState({isOpen:false}); }} />
            <AddMovementModal isOpen={addMoveModalOpen} onClose={() => setAddMoveModalOpen(false)} movementDB={movementDB} onAdd={(n) => setCurrentLog([...currentLog, { movementName: n, sets: Array(4).fill({reps:12, weight:0}), rpe:8 }])} />
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-md border-b-2 border-indigo-100">
                <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="text-sm border p-1 rounded font-bold text-gray-600" />
                <span className="text-xs font-bold text-indigo-400 bg-indigo-50 px-2 py-1 rounded">訓練紀錄模式</span>
            </div>
            {currentLog.map((m, i) => (
                <MovementLogCard key={i} index={i} move={m} weightHistory={weightHistory} movementDB={movementDB} handleRpeUpdate={(idx, v)=>{const n=[...currentLog];n[idx].rpe=v;setCurrentLog(n);}} handleSetUpdate={(mi,si,f,v)=>{const n=[...currentLog];n[mi].sets[si][f]=Number(v);setCurrentLog(n);}} handleNoteUpdate={(mi,v)=>{const n=[...currentLog];n[mi].note=v;setCurrentLog(n);}} openResetModal={(n)=>setResetModalState({isOpen:true, movementName:n, initialWeight:20})} />
            ))}
            <button onClick={()=>setAddMoveModalOpen(true)} className="w-full bg-teal-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-teal-600">+ 單次新增動作</button>
            {currentLog.length > 0 && <button onClick={handleLogSubmit} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-xl hover:bg-indigo-700 transition-all">完成本次訓練並存檔</button>}
        </div>
    );
};

const AnalysisScreen = ({ logDB, bodyMetricsDB }) => {
    const lastLogs = useMemo(() => [...logDB].slice(0, 10), [logDB]);
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-indigo-500"><div className="text-xs text-gray-400 font-bold">累計訓練</div><div className="text-2xl font-bold text-indigo-600">{logDB.length} 次</div></div>
                <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-teal-500"><div className="text-xs text-gray-400 font-bold">身體測量</div><div className="text-2xl font-bold text-teal-600">{bodyMetricsDB.length} 筆</div></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-md"><h3 className="font-bold border-b pb-2 mb-2 text-gray-700 flex items-center"><History className="w-4 h-4 mr-1"/> 最近紀錄</h3>{lastLogs.map(l=>(<div key={l.id} className="text-sm py-2 flex justify-between border-b last:border-0 border-gray-50"><span>{new Date(l.date).toLocaleDateString()}</span><span className="font-bold text-indigo-500">{l.overallVolume || 0}kg</span></div>))}</div>
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
    const [selectedDailyPlanId, setSelectedDailyPlanId] = useState('');
    const [currentLog, setCurrentLog] = useState([]);

    // --- Authentication Flow (Rule 3) ---
    useEffect(() => {
        const initAuth = async () => {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (e) { console.error("Auth failed:", e); }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUserId(user?.uid || null);
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    // --- Initial Data Setup ---
    useEffect(() => {
        if (!isAuthReady || !userId) return;
        const setup = async () => {
            try {
                const q = query(collection(db, 'artifacts', appId, 'users', userId, 'MovementDB'));
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    const batch = writeBatch(db);
                    DEFAULT_MOVEMENTS.forEach(move => {
                        const ref = doc(db, 'artifacts', appId, 'users', userId, 'MovementDB', move.name);
                        batch.set(ref, move);
                    });
                    await batch.commit();
                }
                // Update UserIndex
                const userIndexRef = doc(db, 'artifacts', appId, 'public', 'data', 'UserIndex', userId);
                await setDoc(userIndexRef, { uid: userId, lastActive: Date.now() }, { merge: true });
            } catch (e) { console.error("Setup failed:", e); }
        };
        setup();
    }, [isAuthReady, userId]);

    // --- Real-time Data Sync (Rule 2: No complex queries) ---
    useEffect(() => {
        if (!isAuthReady || !userId) return;

        const unsub1 = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'MovementDB'), 
            (s) => setMovementDB(s.docs.map(d => ({ id: d.id, ...d.data() }))),
            (e) => console.error("Movement sync error:", e)
        );
        const unsub2 = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'PlansDB'), 
            (s) => setPlansDB(s.docs.map(d => ({ id: d.id, ...d.data() }))),
            (e) => console.error("Plans sync error:", e)
        );
        const unsub3 = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'LogDB'), 
            (s) => setLogDB(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date - a.date)),
            (e) => console.error("Log sync error:", e)
        );
        const unsub4 = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'BodyMetricsDB'), 
            (s) => setBodyMetricsDB(s.docs.map(d => ({ id: d.id, ...d.data() }))),
            (e) => console.error("BodyMetrics sync error:", e)
        );

        return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
    }, [isAuthReady, userId]);

    // --- Process Weight History (Suggestion Logic) ---
    useEffect(() => {
        const historyMap = {};
        movementDB.forEach(move => {
            const relevant = logDB.filter(l => (l.movements?.some(m=>m.movementName===move.name)) || (l.isReset && l.movementName===move.name));
            if (relevant.length > 0) {
                const latest = relevant[0];
                if (latest.isReset) {
                    historyMap[move.name] = { suggestion: latest.resetWeight };
                } else {
                    const moveData = latest.movements.find(m=>m.movementName===move.name);
                    if (moveData && moveData.sets) {
                        const best = moveData.sets.reduce((p,c)=>(Number(c.weight)>Number(p.weight)?c:p), {weight:0, reps:0});
                        historyMap[move.name] = { lastRecord: best, suggestion: best.weight };
                    }
                }
            }
        });
        setWeightHistory(historyMap);
    }, [logDB, movementDB]);

    if (!isAuthReady) return <div className="flex items-center justify-center h-screen font-bold text-indigo-500 bg-gray-50">載入訓練系統中...</div>;

    const renderScreen = () => {
        switch (screen) {
            case 'Library': return <ScreenContainer title="🏋️ 動作庫"><LibraryScreen weightHistory={weightHistory} movementDB={movementDB} db={db} appId={appId} userId={userId} /></ScreenContainer>;
            case 'Menu': return <ScreenContainer title="📋 菜單列表"><MenuScreen setSelectedDailyPlanId={setSelectedDailyPlanId} selectedDailyPlanId={selectedDailyPlanId} plansDB={plansDB} movementDB={movementDB} db={db} userId={userId} appId={appId} setScreen={setScreen} currentLog={currentLog} setCurrentLog={setCurrentLog} /></ScreenContainer>;
            case 'Analysis': return <ScreenContainer title="📈 數據分析"><AnalysisScreen logDB={logDB} bodyMetricsDB={bodyMetricsDB} /></ScreenContainer>;
            case 'Profile': return <ScreenContainer title="👤 個人中心"><ProfileScreen bodyMetricsDB={bodyMetricsDB} userId={userId} db={db} appId={appId} logDB={logDB} auth={auth} /></ScreenContainer>;
            default: return <ScreenContainer title="✍️ 訓練紀錄"><LogScreen selectedDailyPlanId={selectedDailyPlanId} setSelectedDailyPlanId={setSelectedDailyPlanId} plansDB={plansDB} movementDB={movementDB} weightHistory={weightHistory} db={db} userId={userId} appId={appId} setScreen={setScreen} currentLog={currentLog} setCurrentLog={setCurrentLog} /></ScreenContainer>;
        }
    };

    return (
        <div className="h-screen font-sans bg-gray-50 flex flex-col">
            <div className="flex-grow overflow-hidden">{renderScreen()}</div>
            <div className="fixed bottom-0 w-full bg-white border-t flex justify-around py-3 pb-8 shadow-2xl z-50">
                {[
                    { id: 'Log', icon: NotebookText, label: '紀錄' },
                    { id: 'Menu', icon: ListChecks, label: '菜單' },
                    { id: 'Library', icon: Dumbbell, label: '庫存' },
                    { id: 'Analysis', icon: BarChart3, label: '分析' },
                    { id: 'Profile', icon: User, label: '個人' }
                ].map(i => (
                    <button key={i.id} onClick={() => setScreen(i.id)} className={`flex flex-col items-center flex-1 transition-all active:scale-95 ${screen===i.id?'text-indigo-600':'text-gray-400'}`}>
                        <i.icon className="w-6 h-6 mb-1" strokeWidth={screen===i.id ? 2.5 : 2} /><span className="text-[10px] font-bold">{i.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const ScreenContainer = ({ children, title }) => (
    <div className="flex flex-col h-full p-4 pt-8 overflow-y-auto pb-32">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-6 flex items-center border-b-2 border-indigo-100 pb-2">{title}</h1>
        {children}
    </div>
);

export default App;