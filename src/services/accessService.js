import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const OWNER_EMAIL = 'ctom40101@gmail.com';
const STATUSES = new Set(['pending', 'approved', 'rejected', 'disabled']);

export function isVerifiedAdmin(claims, userUid, originalOwnerUid) {
  return claims?.email === OWNER_EMAIL && claims.email_verified === true
    && !!userUid && userUid === originalOwnerUid;
}

export function decideAccess(user, claims, request, originalOwnerUid) {
  if (!user) return 'unauthenticated';
  if (!claims?.email || claims.email_verified !== true || claims.firebase?.sign_in_provider !== 'google.com') {
    return 'identity_invalid';
  }
  if (isVerifiedAdmin(claims, user.uid, originalOwnerUid)) return 'admin';
  if (!request) return 'request_needed';
  return STATUSES.has(request.status) ? request.status : 'identity_invalid';
}

export async function loadOriginalOwnerUid(db) {
  const snapshot = await getDoc(doc(db, 'SecurityConfig', 'owner'));
  return snapshot.exists() ? snapshot.data().uid : null;
}

export function observeAccessRequest(db, user, onChange, onError) {
  const path = doc(db, 'AccessRequests', user.uid);
  return onSnapshot(path, snapshot => onChange(snapshot.exists() ? snapshot.data() : null), onError);
}

export async function submitAccessRequest(db, user, claims) {
  if (decideAccess(user, claims, null) !== 'request_needed') throw new Error('Google verified identity required');
  await setDoc(doc(db, 'AccessRequests', user.uid), {
    uid: user.uid,
    email: claims.email,
    displayName: user.displayName || claims.name || '',
    status: 'pending',
    requestedAt: serverTimestamp(),
  });
}
