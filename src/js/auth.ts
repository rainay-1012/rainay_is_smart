import { initializeApp } from "@firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  FacebookAuthProvider,
  getAdditionalUserInfo,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  TwitterAuthProvider,
  updateCurrentUser,
  updatePassword,
  User,
} from "@firebase/auth";
import "dotenv";
import { Response } from ".";

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY!,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.FIREBASE_PROJECT_ID!,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.FIREBASE_APP_ID!,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID!,
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export const authStateChangedListener = (
  callback: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const getCurrentUserToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    return await auth.currentUser.getIdToken(true);
  } else {
    return new Promise((resolve) => {
      authStateChangedListener((user) => {
        if (user) {
          resolve(user.getIdToken(true));
        } else {
          resolve(null);
        }
      });
    });
  }
};

export const updateUser = async (user: User) => {
  await updateCurrentUser(auth, user);
};

export const getCurrentUserClaims = async (): Promise<any> => {
  if (!auth.currentUser) {
    throw new Error("User is not authenticated. Please login to proceed.");
  }

  try {
    const idTokenResult = await auth.currentUser.getIdTokenResult();
    return idTokenResult.claims;
  } catch (error) {
    console.error("Error fetching user role:", error);
    throw error;
  }
};

export interface SignupRequest {
  email: string;
  password: string;
  fullname: string;
  username: string;
  phone: string;
}

export const signup = async ({
  email,
  password,
  fullname,
  username,
  phone,
}: SignupRequest): Promise<Response> => {
  const response = await fetch(`/create_email_user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      password: password,
      fullname: fullname,
      username: username,
      phone: phone,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData;
  }

  const data: Response = await response.json();
  return data;
};

interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

interface LoginResponse extends Response {
  redirect: string;
}

export const login = async ({
  email,
  password,
  remember = false,
}: LoginRequest): Promise<LoginResponse> => {
  await auth.setPersistence(
    remember ? browserLocalPersistence : browserSessionPersistence
  );

  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
  const token = await userCredential.user.getIdToken(true);
  console.log(token);
  return await validateToken(token);
};

export async function sendResetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export const verifyCompanyToken = async (token: string) => {
  const response = await fetch(`/verify_token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData: Response = await response.json();
    throw errorData;
  }

  const data: Response = await response.json();
  return data;
};

export const validateToken = async (token: string) => {
  const response = await fetch(`/login_redirect`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData;
  }

  const data: LoginResponse = await response.json();
  return data;
};

export const logout = async (toLogin: boolean = true): Promise<void> => {
  await signOut(auth);
  if (toLogin) window.location.pathname = "/";
};

interface UpdatePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export const changePassword = async ({
  oldPassword,
  newPassword,
}: UpdatePasswordRequest): Promise<void> => {
  const user = auth.currentUser;
  console.log(oldPassword, newPassword);

  if (!user) {
    throw new Error("No user is currently signed in.");
  }

  const credential = EmailAuthProvider.credential(user.email!, oldPassword);
  await reauthenticateWithCredential(user, credential);

  await updatePassword(user, newPassword);
};

export enum SocialLogin {
  Google,
  Twitter,
  Facebook,
}

export const signUpWithSocialLogin = async (socialLogin: SocialLogin) => {
  try {
    let provider;
    switch (socialLogin) {
      case SocialLogin.Google:
        provider = new GoogleAuthProvider();
        break;
      case SocialLogin.Twitter:
        provider = new TwitterAuthProvider();
        break;
      case SocialLogin.Facebook:
        provider = new FacebookAuthProvider();
        break;
      default:
        return;
    }

    const userCredential = await signInWithPopup(auth, provider);

    if (socialLogin === SocialLogin.Facebook) {
      const token =
        FacebookAuthProvider.credentialFromResult(userCredential)?.accessToken;
      token && localStorage.setItem("profileUrlToken", token);
    }

    if (getAdditionalUserInfo(userCredential)?.isNewUser) {
      const idToken = await userCredential.user.getIdToken(true);

      const response = await fetch("auth/success-redirect", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to set default claims");
      }

      await userCredential.user.reload();
    }
  } catch (error) {
    console.error(`Social sign failed with type ${socialLogin}:`, error);
    throw error;
  }
};
