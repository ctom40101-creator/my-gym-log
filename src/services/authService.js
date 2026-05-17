// V1.0
// authService.js
// Firebase Auth 服務層

import {
  signInAnonymously,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

import { auth } from '../firebase';

// 匿名登入
export const anonymousLogin = async () => {
  return await signInAnonymously(auth);
};

// Email 登入
export const loginWithEmail = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

// 登出
export const logoutUser = async () => {
  return await signOut(auth);
};

// 重設密碼
export const resetPassword = async (email) => {
  return await sendPasswordResetEmail(auth, email);
};