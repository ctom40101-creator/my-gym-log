import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

const OWNER_EMAIL = 'ctom40101@gmail.com';
const STATUSES = new Set(['pending', 'approved', 'rejected', 'disabled']);

export function isVerifiedAdmin(claims) {
  return claims?.email === OWNER_EMAIL && claims.email_verified === true;
}

export function decideAccess(user, claims, request) {
  if (!user) return 'unauthenticated';
  if (!claims?.email || claims.email_verified !== true || claims.firebase?.sign_in_provider !== 'google.com') {
    return 'identity_invalid';
  }
  if (isVerifiedAdmin(claims)) return 'admin';
  if (!request) return 'request_needed';
  return STATUSES.has(request.status) ? request.status : 'identity_invalid';
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
