function signOut() {
    console.log('signOut function triggered');
    sessionStorage.clear();
    localStorage.removeItem('authToken');
    alert('You have been signed out');
    window.location.href = '/login.html';
}

//dont know why no reaction after click signout button