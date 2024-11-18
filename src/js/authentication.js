import { initializeApp } from "../vendor/firebase/firebase-app";
import { getAuth, signInWithEmailAndPassword } from "../vendor/firebase/firebase-auth";

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

export const login = async ({email, password}) => {
    signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        // Signed in 
        const user = userCredential.user;

        const response = await fetch("http://localhost:5001/login",{
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email})
        });
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(`${errorCode} : ${errorMessage}`);
      });


    // if (!response.ok) {
    //     throw new Error(`Login failed: ${response.statusText}`);
    // }
}