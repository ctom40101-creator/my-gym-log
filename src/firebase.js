// V1.1
// Firebase initialization with build-time environment isolation.

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { resolveFirebaseEnvironment } from "./firebaseEnvironment";

export const firebaseEnvironment = resolveFirebaseEnvironment(import.meta.env);
const app = initializeApp(firebaseEnvironment.firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
