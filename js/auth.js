/* auth.js - sign in / sign up, profile, nickname, photo upload (accounts live on this device) */
(function () {
  "use strict";
  const App = window.App; if (!App) return;
  const $ = App.$, store = App.store;
  const USERS_KEY = "todo_users_v1", SESSION_KEY = "todo_session_v1";

  let authMode = "signin";
  let afterAuth = null;          // function to run once the user is signed in
  let editPhotoVal = "";

  const toView = (u) => ({ name: u.name, nick: u.nick || "", email: u.email, created: u.created, photo: u.photo || "" });

  App.displayName = (u) => { u = u || App.user; if (!u) return ""; return (u.nick && u.nick.trim()) || u.name.split(" ")[0]; };
  App.initials = (name) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  };
  App.paintAvatar = (el, name, photo) => {
    if (photo) { el.style.backgroundImage = 'url("' + photo + '")'; el.classList.add("has-photo"); el.textContent = ""; }
    else { el.style.backgroundImage = ""; el.classList.remove("has-photo"); el.textContent = App.initials(name); }
  };

  async function hashPassword(pass, email) {
    const text = email + ":" + pass;
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch (e) {}
    return btoa(unescape(encodeURIComponent(text)));
  }

  App.processPhoto = (file) => new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Could not read that image."));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read that image."));
      img.onload = () => {
        try {
          const S = 160, side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
          const c = document.createElement("canvas");
          c.width = c.height = S;
          c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, S, S);
          resolve(c.toDataURL("image/jpeg", 0.85));
        } catch (e) { reject(new Error("Could not process that image.")); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

  function setUser(u) {
    App.user = u ? toView(u) : null;
    if (u) store.write(SESSION_KEY, u.email); else store.remove(SESSION_KEY);
    App.emit("auth", App.user);
  }

  function patchUser(patch) {
    const users = store.read(USERS_KEY, {});
    const u = App.user && users[App.user.email];
    if (!u) return false;
    Object.assign(u, patch);
    if (!store.write(USERS_KEY, users)) return false;
    App.user = toView(u);
    App.emit("profile", App.user);
    return true;
  }

  /* ---------- sign in / sign up popup ---------- */
  function setError(msg, fields) {
    $("authErr").textContent = msg;
    ["nameInput", "emailInput", "passInput"].forEach((id) => $(id).classList.remove("bad"));
    (fields || []).forEach((id) => $(id).classList.add("bad"));
  }

  function setMode(mode, msg) {
    authMode = mode;
    const signup = mode === "signup";
    document.querySelectorAll("#authTabs button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    $("nameField").style.display = signup ? "block" : "none";
    $("nickField").style.display = signup ? "block" : "none";
    $("authTitle").textContent = signup ? "Create account" : "Welcome back";
    $("authSub").textContent = msg
      ? (signup ? "Sign up to continue. " + msg : "Sign in to continue. " + msg)
      : (signup ? "Join to keep your tasks, notes and scores safe." : "Sign in to use your tasks and notes.");
    $("authSubmit").textContent = signup ? "Create account" : "Sign in";
    $("passInput").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    $("switchBtn").textContent = signup ? "Sign in" : "Create an account";
    $("authSwitch").firstChild.textContent = signup ? "Already have an account? " : "New here? ";
    setError("");
  }

  let authMsg = "";
  function openAuth(mode) {
    $("authForm").reset();
    $("passInput").type = "password";
    $("eyeBtn").innerHTML = App.icon("eye", 18);
    setMode(mode || "signin", authMsg);
    App.openOverlay("authOverlay");
    setTimeout(() => { (authMode === "signup" ? $("nameInput") : $("emailInput")).focus(); }, 60);
  }

  /* run `cb` now if signed in, otherwise ask the user to sign in first */
  function require(cb, msg) {
    if (App.user) { cb(); return; }
    afterAuth = cb; authMsg = msg || "";
    openAuth("signin");
  }

  App.on("overlay:close", (id) => { if (id === "authOverlay") { afterAuth = null; authMsg = ""; } });

  $("authTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode, authMsg); });
  $("switchBtn").addEventListener("click", () => setMode(authMode === "signin" ? "signup" : "signin", authMsg));
  $("authClose").addEventListener("click", () => App.closeOverlay("authOverlay"));
  $("eyeBtn").addEventListener("click", () => {
    const show = $("passInput").type === "password";
    $("passInput").type = show ? "text" : "password";
    $("eyeBtn").innerHTML = App.icon(show ? "eyeOff" : "eye", 18);
  });

  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("nameInput").value.trim();
    const nick = $("nickInput").value.trim();
    const email = $("emailInput").value.trim().toLowerCase();
    const pass = $("passInput").value;
    const signup = authMode === "signup";

    if (signup && name.length < 2) return setError("Please enter your full name.", ["nameInput"]);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Please enter a valid email address.", ["emailInput"]);
    if (pass.length < 6) return setError("Password must be at least 6 characters.", ["passInput"]);

    $("authSubmit").disabled = true;
    try {
      const users = store.read(USERS_KEY, {});
      const hash = await hashPassword(pass, email);
      let u;
      if (signup) {
        if (users[email]) return setError("An account with this email already exists. Try signing in.", ["emailInput"]);
        u = users[email] = { name: name, nick: nick, email: email, hash: hash, created: Date.now(), photo: "" };
        if (!store.write(USERS_KEY, users)) return setError("Could not save your account (storage is full or blocked).");
      } else {
        u = users[email];
        if (!u) return setError("No account found with this email. Please sign up.", ["emailInput"]);
        if (u.hash !== hash) return setError("Incorrect password. Please try again.", ["passInput"]);
      }
      const cb = afterAuth; afterAuth = null; authMsg = "";
      $("authOverlay").classList.remove("open");
      setUser(u);
      App.toast(signup ? "Account created 🎉" : "Welcome back, " + App.displayName() + "!");
      if (cb) setTimeout(cb, 0);
    } finally {
      $("authSubmit").disabled = false;
    }
  });

  /* ---------- profile popup ---------- */
  function fillProfile() {
    const u = App.user; if (!u) return;
    const ts = App.tasksStats ? App.tasksStats() : { total: 0, done: 0, overdue: 0 };
    App.paintAvatar($("pAvatar"), u.name, u.photo);
    $("pName").textContent = u.name;
    $("pEmail").textContent = u.email;
    $("iName").textContent = u.name;
    $("iNick").textContent = u.nick || "Not set";
    $("iEmail").textContent = u.email;
    try { $("iSince").textContent = new Date(u.created).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch (e) { $("iSince").textContent = ""; }
    $("iVer").textContent = isNaN(App.version) ? "dev" : "v" + App.version;
    $("sTotal").textContent = ts.total;
    $("sDone").textContent = ts.done;
    $("sNotes").textContent = App.notesCount ? App.notesCount() : 0;
    $("sOverdue").textContent = ts.overdue;
    $("pPhotoBtn").textContent = u.photo ? "Change profile photo" : "Upload profile photo";
  }
  function showProfileView() {
    $("profileEdit").style.display = "none";
    $("profileView").style.display = "block";
    fillProfile();
  }
  function setEditErr(msg, fields) {
    $("editErr").textContent = msg;
    ["eName", "ePassCur", "ePassNew"].forEach((id) => $(id).classList.remove("bad"));
    (fields || []).forEach((id) => $(id).classList.add("bad"));
  }
  function showProfileEdit() {
    const u = App.user;
    editPhotoVal = u.photo || "";
    $("eName").value = u.name;
    $("eNick").value = u.nick || "";
    $("eEmail").value = u.email;
    $("ePassCur").value = ""; $("ePassNew").value = ""; $("photoInput").value = "";
    setEditErr("");
    App.paintAvatar($("eAvatar"), u.name, editPhotoVal);
    $("profileView").style.display = "none";
    $("profileEdit").style.display = "block";
  }
  function openProfile() {
    if (!App.user) { require(() => {}, ""); return; }
    showProfileView();
    App.openOverlay("profileOverlay");
  }

  $("profileClose").addEventListener("click", () => App.closeOverlay("profileOverlay"));
  $("editProfileBtn").addEventListener("click", showProfileEdit);
  $("editCancel").addEventListener("click", showProfileView);
  $("pPhotoBtn").addEventListener("click", () => $("pPhotoInput").click());
  $("pCam").innerHTML = App.icon("camera", 16);

  $("pPhotoInput").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const data = await App.processPhoto(file);
      if (patchUser({ photo: data })) { App.toast("Profile photo updated"); fillProfile(); }
      else App.toast("Could not save the photo (storage full)");
    } catch (err) { App.toast(err.message); }
    e.target.value = "";
  });

  $("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      editPhotoVal = await App.processPhoto(file);
      App.paintAvatar($("eAvatar"), $("eName").value || App.user.name, editPhotoVal);
      setEditErr("");
    } catch (err) { setEditErr(err.message); }
    e.target.value = "";
  });
  $("removePhotoBtn").addEventListener("click", () => { editPhotoVal = ""; App.paintAvatar($("eAvatar"), $("eName").value || App.user.name, ""); });
  $("eName").addEventListener("input", () => { if (!editPhotoVal) App.paintAvatar($("eAvatar"), $("eName").value, ""); });

  $("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("eName").value.trim();
    const nick = $("eNick").value.trim();
    const cur = $("ePassCur").value, np = $("ePassNew").value;
    if (name.length < 2) return setEditErr("Please enter your full name.", ["eName"]);

    $("profileSave").disabled = true;
    try {
      const users = store.read(USERS_KEY, {});
      const u = users[App.user.email];
      if (!u) return setEditErr("Account not found. Please log in again.");
      if (cur || np) {
        if (!cur) return setEditErr("Enter your current password to change it.", ["ePassCur"]);
        if ((await hashPassword(cur, u.email)) !== u.hash) return setEditErr("Current password is incorrect.", ["ePassCur"]);
        if (np.length < 6) return setEditErr("New password must be at least 6 characters.", ["ePassNew"]);
        u.hash = await hashPassword(np, u.email);
      }
      u.name = name; u.nick = nick; u.photo = editPhotoVal;
      if (!store.write(USERS_KEY, users)) return setEditErr("Could not save (storage full). Try a smaller photo.");
      App.user = toView(u);
      App.emit("profile", App.user);
      showProfileView();
      App.toast(np ? "Profile and password updated" : "Profile updated");
    } finally {
      $("profileSave").disabled = false;
    }
  });

  async function logout() {
    const ok = await App.confirm({ title: "Log out?", text: "Your tasks, notes and scores stay saved on this device.", ok: "Log out", cancel: "Stay", danger: true });
    if (!ok) return;
    App.closeOverlay("profileOverlay");
    setUser(null);
    App.toast("Logged out");
  }
  $("logoutBtn").addEventListener("click", logout);

  /* ---------- restore session ---------- */
  function restore() {
    const email = store.read(SESSION_KEY, null);
    const users = store.read(USERS_KEY, {});
    if (email && users[email]) App.user = toView(users[email]);
  }

  App.auth = { open: openAuth, require: require, logout: logout, openProfile: openProfile, restore: restore, fillProfile: fillProfile };
})();
