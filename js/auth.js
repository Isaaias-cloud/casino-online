(function () {
  const hasFirebaseConfig = Boolean(window.firebaseConfig && window.firebaseConfig.apiKey);
  let firebaseAuth = null;

  if (hasFirebaseConfig && window.firebase) {
    firebase.initializeApp(window.firebaseConfig);
    firebaseAuth = firebase.auth();
  }

  window.CasinoAuth = {
    async register(email, password, name) {
      if (!firebaseAuth) throw new Error('Configura Firebase para registrar usuarios.');
      const credential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      await credential.user.updateProfile({ displayName: name });
      return this.tokenPayload(name);
    },

    async login(email, password, name) {
      if (!firebaseAuth) throw new Error('Configura Firebase para login.');
      await firebaseAuth.signInWithEmailAndPassword(email, password);
      return this.tokenPayload(name);
    },

    async tokenPayload(name) {
      const user = firebaseAuth.currentUser;
      const idToken = await user.getIdToken();
      return { idToken, name: name || user.displayName || user.email, uid: user.uid };
    },

    guestPayload(name) {
      return { name };
    },

    devRegisteredPayload(name) {
      const uid = localStorage.getItem('casino-dev-uid') || `dev-${crypto.randomUUID()}`;
      localStorage.setItem('casino-dev-uid', uid);
      return { uid, name };
    },

    hasFirebaseConfig
  };
})();
