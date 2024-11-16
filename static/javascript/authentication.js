import { initializeApp } from "../vendor/firebase/firebase-app";
import { getAuth, signInWithCustomToken } from "../vendor/firebase/firebase-auth";

const firebaseConfig = {
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

export const signup = async ({email, password}) => {
    const response = await fetch("http://localhost:5000/create_user", {
        method: "post",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({email: email,password: password})
    });

    if (!response.ok) {
        throw new Error(`Signup failed: ${response.statusText}`);
    }

    return await response.json();
};

export const requestLoginRedirect = async ({email, password}) => {
    const response = await fetch("http://localhost:5000/login",{
        method: "POST",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })

    if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
    }
}

export const loginWithToken = async (token) => {
    signInWithCustomToken(auth, token)
    .then((crendential) => {
        console.log(`User with email ${crendential.user.email} has been successfully login`);
    }).catch((error) => {
        console.error(`${error.code} : ${error.message}`);
    })
};