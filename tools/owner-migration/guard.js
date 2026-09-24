const OWNER_EMAIL = 'ctom40101@gmail.com';

export function verifyBeforeLink(user, expectedUid) {
  if (!expectedUid || user?.uid !== expectedUid || user.email !== OWNER_EMAIL) {
    throw new Error('owner_identity_mismatch');
  }
  const providers = user.providerData || [];
  if (!providers.some(item => item.providerId === 'password') || providers.some(item => item.providerId === 'google.com')) {
    throw new Error('owner_provider_state_mismatch');
  }
}

export function verifyAfterLink(user, expectedUid) {
  if (!expectedUid || user?.uid !== expectedUid || user.email !== OWNER_EMAIL) {
    throw new Error('owner_uid_changed');
  }
  if (!user.providerData?.some(item => item.providerId === 'google.com' && item.email === OWNER_EMAIL)) {
    throw new Error('google_provider_mismatch');
  }
}

export function verifyGoogleToken(claims, expectedUid) {
  if (!expectedUid || claims?.sub !== expectedUid || claims.email !== OWNER_EMAIL
      || claims.email_verified !== true || claims.firebase?.sign_in_provider !== 'google.com') {
    throw new Error('owner_google_token_mismatch');
  }
}
