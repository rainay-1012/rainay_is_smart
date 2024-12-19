import { FirebaseError, initializeApp } from "@firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  User,
} from "@firebase/auth";
import "dotenv";
import { AlertType, ContentResponse, GeneralResponse, showAlert } from ".";

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

export const getCurrentUserToken = async (): Promise<string | null> => {
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

interface UserRoleResponse {
  role: string;
}

export const getCurrentUserRole = async (
  currentUserToken: string | null
): Promise<string> => {
  if (!currentUserToken) {
    throw new Error("User is not authenticated. No token provided.");
  }

  try {
    const response = await fetch(`/get_user_role`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${currentUserToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw {
        code: response.status,
        message: errorData.message || response.statusText,
      };
    }

    const data: UserRoleResponse = await response.json();
    return data.role;
  } catch (error) {
    console.error("Error fetching user role:", error);
    throw error;
  }
};

interface SignupRequest {
  email: string;
  password: string;
  token: string;
}

export const signup = async ({
  email,
  password,
  token,
}: SignupRequest): Promise<GeneralResponse> => {
  const response = await fetch(`/create_user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, token }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData;
  }

  const data: GeneralResponse = await response.json();
  return data;
};

interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

interface LoginResponse extends GeneralResponse {
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
  return await validateToken(token);
};

export async function handleForgotPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    showAlert("Password reset email sent! Please check your inbox.", {
      type: AlertType.SUCCESS,
      position: "fixed-top",
    });
  } catch (error) {
    if (error instanceof FirebaseError) {
      console.error("Error during password reset:", error.message);
      switch (error.code) {
        case "auth/invalid-email":
          showAlert("Invalid email address. Please try again.", {
            type: AlertType.DANGER,
            position: "fixed-top",
          });
          break;
        case "auth/user-not-found":
          showAlert("No user found with this email address.", {
            type: AlertType.DANGER,
            position: "fixed-top",
          });
          break;
        default:
          showAlert(`Error: ${error.message}`, {
            type: AlertType.DANGER,
            position: "fixed-top",
          });
      }
    }
  }
}

export const verifyCompanyToken = async (token: string) => {
  const response = await fetch(`/verify_token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData: GeneralResponse = await response.json();
    throw errorData;
  }

  const data: GeneralResponse = await response.json();
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
    const errorData: ContentResponse = await response.json();
    throw errorData;
  }

  const data: LoginResponse = await response.json();
  return data;
};

export const logout = async (toLogin: boolean = true): Promise<void> => {
  await signOut(auth);
  if (toLogin) window.location.pathname = "/login";
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

export const signUpWithGoogle = async (token: string) => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  const user = result.user;
  const id_token = await user.getIdToken(true);

  const response = await fetch("/create_user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id_token: id_token,
      token: token,
    }),
  });

  if (!response.ok) {
    throw await response.json();
  }

  return await response.json();
};
