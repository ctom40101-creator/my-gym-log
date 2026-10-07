import { getRedirectResult, GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { auth, firebaseEnvironment } from '../firebase';
import { createStagingGoogleRedirect, isStagingGoogleRedirectEligible } from './stagingGoogleRedirect';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const browser = typeof window === 'undefined' ? undefined : window;
const redirectEligible = isStagingGoogleRedirectEligible(firebaseEnvironment, browser);
const googleRedirect = createStagingGoogleRedirect({
  enabled: redirectEligible,
  browser,
  recover: () => getRedirectResult(auth),
  redirect: () => signInWithRedirect(auth, googleProvider),
});

export const initializeGoogleRedirect = googleRedirect.initialize;
export const getGoogleRedirectSnapshot = googleRedirect.getSnapshot;
export const subscribeGoogleRedirect = googleRedirect.subscribe;
export const reloadGoogleRedirect = googleRedirect.reload;
export const loginWithGoogle = () => redirectEligible
  ? googleRedirect.login()
  : signInWithPopup(auth, googleProvider);
export const reauthenticateWithGoogle = user => reauthenticateWithPopup(user, googleProvider);
export const logoutUser = () => signOut(auth);
