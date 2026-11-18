// Tombol Send global untuk perangkat sentuh.
// Muncul di pojok kanan bawah viewport (di atas keyboard) saat input teks apa pun difokus.
// Menekannya = menekan Enter di field itu. Pasang sekali, berlaku untuk semua form.
//
// Opt-out per field / form: tambahkan atribut  data-no-send
// Opt-in untuk <textarea> (default dilewati karena Enter = baris baru): data-send

const SIZE = 36;
const M = 12;
const TEXT_TYPES = new Set(["text", "search", "password", "email", "tel", "url", "number"]);

type Field = HTMLInputElement | HTMLTextAreaElement;

function isTarget(el: EventTarget | null): el is Field {
  if (el instanceof HTMLInputElement) {
    if (!TEXT_TYPES.has(el.type)) return false;
  } else if (el instanceof HTMLTextAreaElement) {
    if (!el.closest("[data-send]")) return false;
  } else {
    return false;
  }
  if (el.readOnly || el.disabled) return false;
  if (el.closest("[data-no-send]")) return false;
  return true;
}

let started = false;

export function initMobileSendButton(): () => void {
  if (started || !window.matchMedia("(pointer: coarse)").matches) return () => {};
  started = true;

  const ac = new AbortController();
  const { signal } = ac;
  let btn: HTMLButtonElement | null = null;
  let field: Field | null = null;
  let raf = 0;

  /** tombol Send milik VirtualKeyMapping (.vkm-send) sedang tampil? maka jangan dobel */
  const vkmSendVisible = (): boolean => {
    const el = document.querySelector<HTMLElement>(".vkm-send");
    return !!el && getComputedStyle(el).display !== "none";
  };

  const hide = (): void => {
    if (btn) btn.style.display = "none";
    field = null;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const place = (): void => {
    if (!btn || !field) return;
    if (!field.isConnected) { hide(); return; }
    if (vkmSendVisible()) { btn.style.visibility = "hidden"; raf = requestAnimationFrame(place); return; }
    btn.style.visibility = "visible";
    const vv = window.visualViewport;
    const right = (vv ? vv.offsetLeft + vv.width : window.innerWidth) - M;
    const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - M;
    btn.style.left = `${right - SIZE}px`;
    btn.style.top = `${bottom - SIZE}px`;
    raf = requestAnimationFrame(place); // ikut keyboard / rotasi / animasi
  };

  /** sama seperti menekan Enter di field */
  const press = (): void => {
    const f = field;
    if (!f) return;
    const before = f.value;
    for (const type of ["keydown", "keypress", "keyup"]) {
      const ev = new KeyboardEvent(type, { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
      Object.defineProperty(ev, "keyCode", { get: () => 13 });
      Object.defineProperty(ev, "which", { get: () => 13 });
      f.dispatchEvent(ev);
    }
    // fallback untuk <form> tanpa handler key; hanya jika teks belum berubah (cegah kirim ganda)
    window.setTimeout(() => {
      if (!f.isConnected || !f.form || !before.trim() || f.value !== before) return;
      try { f.form.requestSubmit(); } catch { /* abaikan */ }
    }, 90);
  };

  const create = (): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.tabIndex = -1;
    b.setAttribute("aria-label", "Kirim");
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none">' +
      '<path d="M21 3L10.500 13.500M21 3l-6.500 18-4-7.500L3 9.500z"/></svg>';
    b.style.cssText =
      `position:fixed;left:0;top:0;display:none;align-items:center;justify-content:center;width:${SIZE}px;height:${SIZE}px;` +
      "padding:0;margin:0;color:#fff;border:1.5px solid rgba(255,255,255,.55);border-radius:50%;" +
      "background:linear-gradient(160deg,#35d9f2,#0b8fb0);box-shadow:0 6px 18px rgba(0,0,0,.4),0 0 14px rgba(34,211,238,.45);" +
      "touch-action:none;cursor:pointer;z-index:2147483000;";

    // tap tombol tidak boleh mencuri fokus dari field (keyboard akan menutup)
    const keepFocus = (e: Event): void => e.preventDefault();
    b.addEventListener("mousedown", keepFocus);
    b.addEventListener("touchstart", keepFocus, { passive: false });

    let pid: number | null = null;
    b.addEventListener("pointerdown", (e) => {
      if (pid !== null) return;
      e.preventDefault(); e.stopPropagation();
      pid = e.pointerId;
      b.style.transform = "scale(.92)";
    });
    b.addEventListener("pointerup", (e) => {
      if (e.pointerId !== pid) return;
      e.preventDefault();
      pid = null;
      b.style.transform = "";
      press();
    });
    const cancel = (e: PointerEvent): void => {
      if (e.pointerId !== pid) return;
      pid = null;
      b.style.transform = "";
    };
    b.addEventListener("pointercancel", cancel);
    b.addEventListener("pointerleave", cancel);

    document.body.appendChild(b);
    return b;
  };

  document.addEventListener("focusin", (e) => {
    if (!isTarget(e.target)) return;
    field = e.target;
    btn ??= create();
    btn.style.display = "flex";
    cancelAnimationFrame(raf);
    place();
  }, { signal });

  document.addEventListener("focusout", (e) => {
    if (e.target === field) hide();
  }, { signal });

  return () => {
    ac.abort();
    cancelAnimationFrame(raf);
    btn?.remove();
    btn = null;
    field = null;
    started = false;
  };
}