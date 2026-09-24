import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const reauthenticateWithGoogle = user => reauthenticateWithPopup(user, googleProvider);
export const logoutUser = () => signOut(auth);
