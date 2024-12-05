import { initializeApp } from "@firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "@firebase/auth";
import "dotenv";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export const authStateChangedListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUserToken = async () => {
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken();
  } else {
    return new Promise((resolve) => {
      authStateChangedListener((user) => {
        if (user) {
          resolve(user.getIdToken());
        } else {
          resolve(null);
        }
      });
    });
  }
};

export const signup = async ({ email, password, token }) => {
  const response = await fetch(`/create_user`, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: email, password: password, token: token }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData;
  }

  const data = await response.json();
  return data;
};

export const login = async ({ email, password, remember = false } = {}) => {
  await auth.setPersistence(
    remember ? browserLocalPersistence : browserSessionPersistence
  );

  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  const token = await userCredential.user.getIdToken(true);

  const response = await fetch(`/login_redirect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw {
      code: response.status,
      message: errorData.message || response.statusText,
    };
  }

  const data = await response.json();
  return data;
};

export const logout = async () => {
  await signOut(auth);
};
