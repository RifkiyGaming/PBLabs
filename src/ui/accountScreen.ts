import { registerAccount, loginAccount, tokenToBytes, AccountApiError } from "../net/accountApi.js";
import { Stage } from "../lobby/ui/LayoutRenderer.ts";

export interface AccountSession {
  token: Uint8Array;
  username: string;
}

const STYLE_ID = "pb-modern-account-screen-style";
const LOGIN_ART = "/assets/ui/cross/brand/login-bg.jpg"; // Gambar background original Point Blank

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;700&family=Rajdhani:wght@500;600;700&display=swap');

    .pb-modern-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: #000 url(${LOGIN_ART}) no-repeat center center;
      background-size: cover;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Rajdhani', sans-serif;
      overflow-y: auto;
      padding: 12px;
      box-sizing: border-box;
    }

    /* Dark vignette overlay */
    .pb-modern-overlay::before {
      content: '';
      position: fixed;
      inset: 0;
      background: radial-gradient(circle, rgba(8, 10, 14, 0.4) 0%, rgba(5, 7, 10, 0.88) 100%);
      pointer-events: none;
    }

    /* Main Container Card (Compact & Modern Tactical Glassmorphism) */
    .pb-auth-card {
      position: relative;
      width: 100%;
      max-width: 380px; /* Diperkecil agar lebih compact */
      background: rgba(13, 17, 23, 0.92);
      border: 1px solid rgba(255, 140, 0, 0.4);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9), inset 0 0 20px rgba(255, 140, 0, 0.08);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 30px 25px; /* Padding lebih ramping */
      box-sizing: border-box;
      clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
      animation: cardEntrance 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      margin: auto;
    }

    @keyframes cardEntrance {
      from { opacity: 0; transform: translateY(15px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header Brand */
    .pb-auth-header {
      text-align: center;
      margin-bottom: 22px;
    }

    .pb-auth-title {
      font-family: 'Teko', sans-serif;
      font-size: 32px; /* Ukuran judul disesuaikan */
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0;
      line-height: 1;
      text-shadow: 0 2px 10px rgba(255, 140, 0, 0.5);
    }

    .pb-auth-subtitle {
      font-size: 11px;
      color: #8b9bb4;
      letter-spacing: 2.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }

    /* Form Groups */
    .pb-auth-group {
      margin-bottom: 15px; /* Jarak antar input lebih rapat */
      position: relative;
    }

    .pb-auth-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #a0aec0;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .pb-auth-input-wrapper {
      position: relative;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid #2a3447;
      transition: all 0.3s ease;
    }

    .pb-auth-input-wrapper:focus-within {
      border-color: #ff8c00;
      box-shadow: 0 0 8px rgba(255, 140, 0, 0.3);
    }

    .pb-account-input {
      width: 100%;
      box-sizing: border-box;
      height: 40px; /* Tinggi input lebih compact */
      padding: 0 12px;
      background: transparent;
      border: none;
      outline: none;
      color: #ffffff;
      font-family: 'Rajdhani', sans-serif;
      font-size: 16px; /* Wajib 16px agar tidak auto-zoom di HP */
      font-weight: 600;
      letter-spacing: 0.5px;
      caret-color: #ff8c00;
    }

    .pb-account-input:-webkit-autofill,
    .pb-account-input:-webkit-autofill:hover,
    .pb-account-input:-webkit-autofill:focus {
      -webkit-text-fill-color: #fff !important;
      -webkit-box-shadow: 0 0 0px 1000px #0d1117 inset !important;
      transition: background-color 5000s ease-in-out 0s;
    }

    /* Action Buttons */
    .pb-auth-actions {
      margin-top: 22px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .pb-account-btn {
      width: 100%;
      height: 42px; /* Tinggi tombol lebih compact */
      border: none;
      font-family: 'Teko', sans-serif;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .pb-btn-primary {
      background: linear-gradient(135deg, #ff8c00 0%, #e07000 100%);
      color: #0c0f16;
      box-shadow: 0 4px 12px rgba(255, 140, 0, 0.35);
      clip-path: polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%);
    }

    .pb-btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #ffa333, #f08000);
      box-shadow: 0 5px 16px rgba(255, 140, 0, 0.55);
      transform: translateY(-1px);
    }

    .pb-btn-secondary {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid #2a3447;
      color: #a0aec0;
    }

    .pb-btn-secondary:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.09);
      border-color: #4a5568;
      color: #ffffff;
    }

    .pb-account-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Error Message Box */
    .pb-account-error {
      margin-top: 12px;
      padding: 8px 10px;
      background: rgba(255, 75, 75, 0.12);
      border-left: 3px solid #ff4b4b;
      color: #ff9d9d;
      font-size: 12px;
      font-weight: 600;
      display: none;
      animation: shake 0.3s ease-in-out;
    }

    .pb-account-error.visible {
      display: block;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }

    /* Penyesuaian Ekstra untuk Layar Sangat Kecil / HP Portrait */
    @media (max-width: 480px) {
      .pb-modern-overlay {
        padding: 8px;
      }
      .pb-auth-card {
        padding: 20px 16px;
        max-width: 100%;
      }
      .pb-auth-title {
        font-size: 28px;
      }
      .pb-auth-header {
        margin-bottom: 16px;
      }
      .pb-auth-group {
        margin-bottom: 12px;
      }
      .pb-account-input {
        height: 38px;
      }
      .pb-account-btn {
        height: 38px;
        font-size: 18px;
      }
    }
  `;
  document.head.appendChild(style);
}

export function showAccountScreen(): Promise<AccountSession> {
  ensureStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pb-modern-overlay";
    
    overlay.innerHTML = `
      <div class="pb-auth-card">
        <div class="pb-auth-header">
          <h1 class="pb-auth-title" id="pb-auth-main-title">PB LABS</h1>
          <div class="pb-auth-subtitle" id="pb-auth-sub-title">Enter your operative ID</div>
        </div>

        <div class="pb-auth-group">
          <label class="pb-auth-label" for="pb-acc-username">Username</label>
          <div class="pb-auth-input-wrapper">
            <input class="pb-account-input" id="pb-acc-username" type="text" autocomplete="username" maxlength="16" placeholder="Enter username..." />
          </div>
        </div>

        <div class="pb-auth-group" id="pb-acc-email-group" hidden>
          <label class="pb-auth-label" for="pb-acc-email">Email</label>
          <div class="pb-auth-input-wrapper">
            <input class="pb-account-input" id="pb-acc-email" type="email" autocomplete="email" maxlength="255" placeholder="Enter email..." />
          </div>
        </div>

        <div class="pb-auth-group">
          <label class="pb-auth-label" for="pb-acc-password">Password</label>
          <div class="pb-auth-input-wrapper">
            <input class="pb-account-input" id="pb-acc-password" type="password" autocomplete="current-password" maxlength="64" placeholder="••••••••••••" />
          </div>
        </div>

        <div class="pb-auth-actions">
          <button class="pb-account-btn pb-btn-primary" id="pb-acc-submit" type="button">LOGIN</button>
          <button class="pb-account-btn pb-btn-secondary" id="pb-acc-mode" type="button">CREATE ACCOUNT</button>
        </div>

        <div class="pb-account-error" id="pb-acc-error"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Suppress the browser context menu only while the account screen is open.
    // This does not block mouse button events used by game controls elsewhere.
    const protectionController = new AbortController();

    overlay.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
      },
      { capture: true, signal: protectionController.signal }
    );

    // Discourage common DevTools / view-source shortcuts while this screen is active.
    // Browser-level menus and external DevTools access cannot be disabled by page code.
    window.addEventListener(
      "keydown",
      (event) => {
        const key = event.key.toLowerCase();
        const devtoolsShortcut =
          event.key === "F12" ||
          (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
          (event.ctrlKey && key === "u");

        if (devtoolsShortcut) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true, signal: protectionController.signal }
    );

    let mode: "login" | "register" = "login";
    const modeBtn = overlay.querySelector<HTMLButtonElement>("#pb-acc-mode")!;
    const submitBtn = overlay.querySelector<HTMLButtonElement>("#pb-acc-submit")!;
    const usernameInput = overlay.querySelector<HTMLInputElement>("#pb-acc-username")!;
    const emailGroup = overlay.querySelector<HTMLElement>("#pb-acc-email-group")!;
    const emailInput = overlay.querySelector<HTMLInputElement>("#pb-acc-email")!;
    const passwordInput = overlay.querySelector<HTMLInputElement>("#pb-acc-password")!;
    const errorBox = overlay.querySelector<HTMLElement>("#pb-acc-error")!;
    const mainTitle = overlay.querySelector<HTMLElement>("#pb-auth-main-title")!;
    const subTitle = overlay.querySelector<HTMLElement>("#pb-auth-sub-title")!;

    function setMode(next: "login" | "register"): void {
      mode = next;
      mainTitle.textContent = next === "login" ? "PB LABS" : "CREATE ACCOUNT";
      subTitle.textContent = next === "login" ? "Enter your operative ID" : "Register new operative credentials";
      modeBtn.textContent = next === "login" ? "CREATE ACCOUNT" : "BACK TO LOGIN";
      submitBtn.textContent = next === "login" ? "LOGIN" : "REGISTER";
      passwordInput.autocomplete = next === "login" ? "current-password" : "new-password";
      emailGroup.hidden = next === "login";
      if (next === "login") emailInput.value = "";
      hideError();
    }

    function showError(message: string): void {
      errorBox.textContent = message;
      errorBox.classList.add("visible");
    }

    function hideError(): void {
      errorBox.classList.remove("visible");
    }

    modeBtn.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

    async function submit(): Promise<void> {
      hideError();
      const username = usernameInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!/^[a-zA-Z0-9_]{4,16}$/.test(username)) {
        showError("Username must be 4-16 characters (letters, numbers, _)");
        return;
      }
      if (password.length < 6) {
        showError("Password must be at least 6 characters long");
        return;
      }
      if (mode === "register" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError("Please enter a valid email address");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "AUTHENTICATING...";
      
      try {
        const result = mode === "login"
          ? await loginAccount(username, password)
          : await registerAccount(username, password, email);

        protectionController.abort();
        overlay.remove();
        resolve({ token: tokenToBytes(result.token), username: result.nickname });
      } catch (err) {
        const message = err instanceof AccountApiError ? err.message : "Connection failed with the authentication server.";
        showError(message);
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "login" ? "LOGIN" : "REGISTER";
      }
    }

    submitBtn.addEventListener("click", () => void submit());
    for (const input of [usernameInput, emailInput, passwordInput]) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") void submit();
      });
    }

    setTimeout(() => usernameInput.focus(), 100);
  });
}