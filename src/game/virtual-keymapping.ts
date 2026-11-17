import type { Input } from "./input";
import { PB_KEYS } from "./keymap";

/**
 * Touchscreen controls for the PB web client.
 *
 * Design goals
 * - Mobile gaming layout: floating joystick (left), look-by-drag (right), big FIRE/AIM/JUMP cluster.
 * - NEVER blocks the game UI under it: the root is pointer-events:none, there is no full-screen
 *   "look area" element. Look / joystick gestures are read from document-level pointer events and
 *   they are ignored whenever the finger lands on a real UI element (button, link, input,
 *   cursor:pointer, [data-vkm-ignore]) outside the controls.
 * - Mobile never gets Pointer Lock, so while playing we switch Input into touch-lock mode
 *   (input.setTouchLock) – the game gates look / fire / chat on `input.locked`.
 * - Menu button opens the game's ESC menu, "LANJUT" closes it.
 */

export interface VirtualKeyMappingOptions {
  sensitivityX?: number;
  sensitivityY?: number;
  invertY?: boolean;
  /** Joystick base diameter in px (before scale). */
  joystickSize?: number;
  /** 0..1: stick travel below this is ignored. */
  deadzone?: number;
  /** 0..1: per-axis threshold to press W/A/S/D. */
  directionThreshold?: number;
  showRadio?: boolean;
  showControls?: boolean;
  /** Button opacity 0.25..1 (default 0.8). */
  opacity?: number;
  /** UI scale 0.7..1.5 (default 1). */
  scale?: number;
  /** Vibrate on button press where supported (default true). */
  haptics?: boolean;
  /**
   * Hide game HUD widgets that sit under the on-screen buttons (default FALSE).
   * Off by default: it also hides the minimap / score when a button covers them.
   * When enabled, add `data-vkm-keep` to an HUD element to never hide it.
   */
  hideHudUnderControls?: boolean;
  /** CSS selector of the game HUD root (default "#pbhud"). */
  hudSelector?: string;
}

interface ButtonConfig {
  /** aria-label */
  label: string;
  /** Inner HTML (icon + tiny caption). */
  html: string;
  className?: string;
  key?: string;
  mouse?: number;
  /** Keep the key / button down while the finger is down. Default: short tap. */
  hold?: boolean;
  /** Dragging this button also moves the camera (FIRE). */
  look?: boolean;
  /** Works even while paused / collapsed (MENU). */
  always?: boolean;
  onTap?: () => void;
  /** Offset from bottom-right in px (before scale). */
  br?: { x: number; y: number; size: number };
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const TAP_MS = 70;

type PopoverElement = HTMLElement & {
  showPopover?: () => void;
  hidePopover?: () => void;
};

const svg = (d: string, extra = "") =>
  `<svg viewBox="0 0 24 24"${extra}>${d}</svg>`;

const ICON = {
  // movement / combat
  jump: svg('<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>'),
  crouch: svg('<path d="M6 5l6 6 6-6M6 11l6 6 6-6"/>'),
  reload: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/>'),
  fire: svg('<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  aim: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7v10M7 12h10"/>'),
  walk: svg('<path d="M8.5 3.5c1.8 0 2.8 1.8 2.8 3.8S10.300 11 8.500 11 5.700 9.300 5.700 7.300 6.700 3.500 8.500 3.500zM7 13.500h3.500V15a1.750 1.750 0 0 1-3.500 0zM15.500 10c1.800 0 2.800 1.800 2.800 3.800s-1 3.700-2.800 3.700-2.800-1.700-2.800-3.700 1-3.800 2.800-3.800zM14 19.500h3.500V21H14z"/>'),
  action: svg('<path d="M9 11V5.500a1.500 1.500 0 0 1 3 0V10M12 9.500a1.500 1.500 0 0 1 3 0V11M15 10.500a1.500 1.500 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a5.500 5.500 0 0 1-4.600-2.500L4.500 14.500a1.600 1.600 0 0 1 2.600-1.800L9 15"/>'),

  // utility keys
  swap: svg('<path d="M5 8h13l-3-3M19 16H6l3 3"/>'),
  drop: svg('<path d="M12 4v11M7.500 11l4.500 4.500L16.500 11M5 20h14"/>'),
  laser: svg('<circle cx="12" cy="12" r="2.200"/><path d="M3 12h5M16 12h5M12 3v5M12 16v5"/>'),
  dual: svg('<rect x="3.500" y="7" width="7" height="10" rx="1.500"/><rect x="13.500" y="7" width="7" height="10" rx="1.500"/>'),

  // weapon slots 1-6
  rifle: svg('<path d="M2 12.500h13l2-2h5v3h-6l-1.500 2H10l-1 3.500H6l1-3.500H2z"/>'),
  pistol: svg('<path d="M4 8.500h14.500v4.500H12v6.500H8.500V13H4z"/>'),
  knife: svg('<path d="M4 20L17.500 6.500 20 4l-.5 4.500L13 15l-3 .5L8 18z"/>'),
  grenade: svg('<circle cx="12" cy="14.500" r="6"/><path d="M10 8.500V5h4.500M14.500 5l2.500 1.500"/>'),
  special: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.700 5.700l2.800 2.800M15.500 15.500l2.800 2.800M18.300 5.700l-2.800 2.800M8.500 15.500l-2.800 2.800"/>'),

  // interface
  menu: svg('<path d="M5 7h14M5 12h14M5 17h14"/>'),
  score: svg('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M9.500 10v9"/>'),
  chat: svg('<path d="M4 5.500h16V16H9.500L5 19.500V16H4z"/>'),
  send: svg('<path d="M21 3L10.500 13.500M21 3l-6.500 18-4-7.500L3 9.500z"/>'),
};

const SLOT_ICONS = [
  ICON.rifle,
  ICON.pistol,
  ICON.knife,
  ICON.grenade,
  ICON.special,
  "",
];

const cap = (icon: string, text: string) =>
  `${icon}<span class="vkm-cap">${text}</span>`;

/** Elements a finger must never "steal" from the page. */
const INTERACTIVE =
  'button, a, input, select, textarea, label, summary, [role="button"], [contenteditable="true"], [data-vkm-ignore]';

export class VirtualKeyMapping {
  private root: HTMLDivElement | null = null;
  private style: HTMLStyleElement | null = null;
  private hud: HTMLDivElement | null = null;
  private ghost: HTMLDivElement | null = null;
  private joy: HTMLDivElement | null = null;
  private stick: HTMLDivElement | null = null;
  private sendBtn: HTMLButtonElement | null = null;

  private abort: AbortController | null = null;
  private chatTimer = 0;

  // Gesture tracking (document level)
  private joyPointer: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private lookPointers = new Map<number, { x: number; y: number }>();

  // Anything that must be released on blur / pause / destroy
  private releasers = new Set<() => void>();

  private enabled = false;
  private destroyed = false;
  private playing = false;
  private paused = false;
  private collapsed = false;

  private sensitivityX: number;
  private sensitivityY: number;
  private invertY: boolean;
  private joystickSize: number;
  private deadzone: number;
  private directionThreshold: number;
  private showRadio: boolean;
  private showControls: boolean;
  private opacity: number;
  private uiScale: number;
  private haptics: boolean;
  private hideHudUnderControls: boolean;
  private hudSelector: string;

  /** Fallback menu state when window.__pb is not available. */
  private localMenu = false;

  private hudHidden = new Set<Element>();
  private hudTick = 0;
  private stateSig = "";
  private wasActive = false;
  private joyCaptured = false;
  private origRequestLock: ((...args: unknown[]) => unknown) | null = null;
  /** Until this time the game's menu state may lag behind our own open / close request. */
  private menuIntentUntil = 0;

  private readonly keys = {
    forward: PB_KEYS.forward[0],
    back: PB_KEYS.back[0],
    left: PB_KEYS.left[0],
    right: PB_KEYS.right[0],
    jump: PB_KEYS.jump[0],
    crouch: PB_KEYS.crouch[0],
    walk: PB_KEYS.walk[0],
    reload: PB_KEYS.reload[0],
    lastWeapon: PB_KEYS.lastWeapon[0],
    drop: PB_KEYS.drop[0],
    action: PB_KEYS.action[0],
    extension: PB_KEYS.extension[0],
    extension2: PB_KEYS.extension2[0],
    scoreboard: PB_KEYS.scoreboard[0],
  };

  constructor(
    private readonly input: Input,
    options: VirtualKeyMappingOptions = {},
  ) {
    this.sensitivityX = options.sensitivityX ?? 1.15;
    this.sensitivityY = options.sensitivityY ?? 0.95;
    this.invertY = options.invertY ?? false;

    this.joystickSize = options.joystickSize ?? 135;
    this.deadzone = clamp(options.deadzone ?? 0.16, 0, 0.9);
    this.directionThreshold = clamp(options.directionThreshold ?? 0.3, 0.05, 0.95);

    this.showRadio = options.showRadio ?? false;
    this.showControls = options.showControls ?? true;

    this.opacity = clamp(options.opacity ?? 0.8, 0.25, 1);
    this.uiScale = clamp(options.scale ?? 1, 0.7, 1.5);
    this.haptics = options.haptics ?? true;
    this.hideHudUnderControls = options.hideHudUnderControls ?? false;
    this.hudSelector = options.hudSelector ?? "#pbhud";
  }

  // ==========================================================
  // PUBLIC API
  // ==========================================================

  mount(): void {
    if (this.root || this.destroyed) return;

    this.abort = new AbortController();

    this.blockPointerLock();

    this.createStyle();
    this.createUI();
    this.applyVars();
    this.bindGlobalEvents();

    this.enabled = true;

    // Touch has no Pointer Lock: the "Click to Play" blocker is dismissed by our own tap.
    const blocker = document.getElementById("blocker");
    if (!blocker || blocker.classList.contains("hidden")) {
      this.startPlay();
    } else {
      this.syncState();
    }

    this.chatTimer = window.setInterval(() => {
      this.syncState();
      this.syncWithGame();

      this.watchdog();

      // HUD can be rebuilt by the game: rescan about every 640 ms
      if (++this.hudTick % 8 === 0) this.scanHud();
    }, 80);
  }

  destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;
    this.enabled = false;
    this.playing = false;

    window.clearInterval(this.chatTimer);
    this.abort?.abort();
    this.abort = null;

    this.releaseAll();
    this.input.setTouchLock(false);
    this.clearHud();
    this.restorePointerLock();

    document.documentElement.style.touchAction = "";
    document.documentElement.style.overscrollBehavior = "";

    this.root?.remove();
    this.style?.remove();

    this.root = null;
    this.style = null;
    this.hud = null;
    this.ghost = null;
    this.joy = null;
    this.stick = null;
    this.sendBtn = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.releaseAll();
    }

    this.input.setTouchLock(enabled && this.playing && !this.paused);
    this.syncState();
  }

  setSensitivity(x: number, y = x): void {
    this.sensitivityX = clamp(x, 0.1, 4);
    this.sensitivityY = clamp(y, 0.1, 4);
  }

  setInvertY(value: boolean): void {
    this.invertY = value;
  }

  setOpacity(value: number): void {
    this.opacity = clamp(value, 0.25, 1);
    this.applyVars();
  }

  setScale(value: number): void {
    this.uiScale = clamp(value, 0.7, 1.5);
    this.applyVars();
  }

  /** Hide / show every on-screen button (joystick + look keep working). */
  setCollapsed(value: boolean): void {
    this.collapsed = value;
    this.syncState();
  }

  /**
   * MENU button = the Escape key. Closed -> opens the game's ESC menu,
   * open -> closes it. No separate "resume" button.
   */
  toggleMenu(): void {
    if (!this.playing || this.destroyed) return;

    this.hardReset();

    if (this.paused) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  /** Open the game's ESC menu (touch equivalent of leaving Pointer Lock). */
  pause(): void {
    if (this.playing && !this.paused) this.openMenu();
  }

  /** Close the game's ESC menu. */
  resume(): void {
    if (this.playing && this.paused) this.closeMenu();
  }

  private openMenu(): void {
    this.localMenu = true;
    this.menuIntentUntil = performance.now() + 500;
    this.setMenuOpen(true);

    // game.ts listens to pointerlockchange and opens the ESC menu when the pointer is free
    document.dispatchEvent(new Event("pointerlockchange"));
  }

  private closeMenu(): void {
    this.localMenu = false;
    this.menuIntentUntil = performance.now() + 500;

    // 1) the game's own "locked again while the ESC menu is up -> close it" path
    this.fakePointerLockChange();

    // 2) fallback: the game's Escape handler. Skipped when step 1 already closed the menu,
    //    otherwise a toggle-style Escape handler would re-open it right away.
    const g = this.game();
    if (!g?.escMenu || g.escMenu.isOpen) this.tapKeyEvent("Escape");

    this.setMenuOpen(false);

    // 3) last resort: still open after the events -> close it directly
    window.setTimeout(() => {
      const g = this.game();

      if (this.destroyed || !g?.escMenu?.isOpen) return;

      try {
        g.escMenu.close();
      } catch {
        // ignore
      }
    }, 150);
  }

  /** Controls follow the menu: hidden + touch-lock off while it is open. */
  private setMenuOpen(open: boolean): void {
    this.paused = open;

    this.releaseAll();
    this.input.setTouchLock(this.enabled && this.playing && !open);
    this.syncState();

    // The game's menu may live in the top layer too: be the LAST layer so MENU stays reachable
    if (open) {
      window.setTimeout(() => {
        if (!this.destroyed && this.paused) this.attachRoot(true);
      }, 80);
    }
  }

  /**
   * Touch mode never uses the real Pointer Lock. If the game (menu "LANJUT", chat, a click on
   * the canvas...) asks for it anyway, the browser freezes clientX / clientY and shows
   * "... has control of your pointer": the joystick and every button then stop matching the
   * finger. While the controls are enabled, requestPointerLock becomes a harmless no-op.
   */
  private blockPointerLock(): void {
    const proto = Element.prototype as unknown as {
      requestPointerLock?: (...args: unknown[]) => unknown;
    };

    if (typeof proto.requestPointerLock !== "function" || this.origRequestLock) return;

    const orig = proto.requestPointerLock;
    const self = this;

    this.origRequestLock = orig;

    proto.requestPointerLock = function (this: Element, ...args: unknown[]) {
      if (self.enabled && !self.destroyed) return Promise.resolve();
      return orig.apply(this, args);
    };

    // A lock that is already active (taken before mount) is released once, quietly.
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // ignore
      }
    }
  }

  private restorePointerLock(): void {
    if (!this.origRequestLock) return;

    (Element.prototype as unknown as {
      requestPointerLock?: (...args: unknown[]) => unknown;
    }).requestPointerLock = this.origRequestLock;

    this.origRequestLock = null;
  }

  /** Self-heal: a joystick whose finger is gone (lost pointerup) never stays stuck. */
  private watchdog(): void {
    if (this.joyPointer === null || !this.joyCaptured || !this.ghost) return;

    let held = false;

    try {
      held = this.ghost.hasPointerCapture(this.joyPointer);
    } catch {
      // ignore
    }

    if (!held) this.resetJoystick();
  }

  /** The Game instance exposed by main.ts (window.__pb), if any. */
  private game(): any {
    return (window as unknown as { __pb?: any }).__pb;
  }

  private fakePointerLockChange(): void {
    try {
      Object.defineProperty(document, "pointerLockElement", {
        configurable: true,
        get: () => document.body,
      });

      document.dispatchEvent(new Event("pointerlockchange"));
    } finally {
      // restore the real (prototype) getter
      delete (document as unknown as Record<string, unknown>).pointerLockElement;
    }
  }

  /**
   * Follow the game's REAL menu state, however it changed (MENU button, the menu's own
   * buttons, a keyboard Esc...), so the controls can never disagree with the game.
   */
  private syncWithGame(): void {
    if (!this.playing || !this.enabled) return;

    const g = this.game();
    const open = g?.escMenu ? !!g.escMenu.isOpen : this.localMenu;

    if (open === this.paused) return;

    // Our own open / close request is still travelling through the game: do not let the
    // lagging game state flip us back (that flapping reset the analog over and over).
    if (performance.now() < this.menuIntentUntil) return;

    this.setMenuOpen(open);
  }

  /** Drop every held key / pointer and every visual "pressed" state. */
  private hardReset(): void {
    this.releaseAll();

    this.root
      ?.querySelectorAll(".vkm-on")
      .forEach((el) => el.classList.remove("vkm-on"));

    this.attachRoot();
    this.applyVars();
  }

  // ==========================================================
  // STATE
  // ==========================================================

  private get active(): boolean {
    return (
      this.enabled &&
      this.playing &&
      !this.paused &&
      !this.destroyed &&
      !this.input.chatOpen
    );
  }

  private startPlay(): void {
    if (this.playing) return;

    this.playing = true;
    this.paused = false;

    document.getElementById("blocker")?.classList.add("hidden");

    this.input.setTouchLock(true);
    this.syncState();
  }

  /**
   * Chat / menu opened or closed (by our buttons, the game, or the keyboard): every transition
   * starts from a clean slate, so no stale pointer, key or "pressed" look survives into the next
   * state and the analog never follows a dead finger. Also called right before a touch is
   * handled, so a transition the 150 ms timer has not seen yet can never wipe a fresh touch.
   */
  private syncTransition(): void {
    const nowActive = this.active;

    if (nowActive === this.wasActive) return;

    this.wasActive = nowActive;

    this.releaseAll();

    this.root
      ?.querySelectorAll(".vkm-on")
      .forEach((el) => el.classList.remove("vkm-on"));
  }

  private syncState(): void {
    const root = this.root;
    if (!root) return;

    root.classList.toggle("vkm-off", !this.enabled);
    root.classList.toggle("vkm-idle", !this.playing);
    root.classList.toggle("vkm-paused", this.playing && this.paused);
    root.classList.toggle("vkm-collapsed", this.collapsed);
    root.classList.toggle("vkm-chat", this.input.chatOpen);

    this.syncTransition();

    if (this.input.chatOpen) this.positionSend();

    // The game may bring "Click to Play" back after the menu closes: it would swallow every touch
    if (this.playing && !this.paused) {
      document.getElementById("blocker")?.classList.add("hidden");
    }

    // Controls shown / hidden -> HUD under them hides / comes back right away
    const sig = [
      this.enabled,
      this.playing,
      this.paused,
      this.collapsed,
      this.input.chatOpen,
    ].join();

    if (sig !== this.stateSig) {
      this.stateSig = sig;
      this.scanHud();
    }
  }

  // ==========================================================
  // HUD UNDER THE CONTROLS
  // ==========================================================

  private clearHud(): void {
    for (const el of this.hudHidden) el.classList.remove("vkm-under");
    this.hudHidden.clear();
  }

  /**
   * Hide HUD widgets that are (mostly) covered by an on-screen button, so the game HUD
   * does not show through / clutter behind the controls. Big containers are walked into,
   * small widgets are hidden whole when >= 25% of them is covered.
   */
  private scanHud(): void {
    const root = this.root;

    if (!root) return;

    if (!this.hideHudUnderControls) {
      this.clearHud();
      return;
    }

    const hudRoot = document.querySelector(this.hudSelector);
    const showing =
      this.enabled &&
      this.playing &&
      !this.paused &&
      !this.collapsed &&
      !this.input.chatOpen;

    if (!hudRoot || !showing) {
      this.clearHud();
      return;
    }

    const rects: DOMRect[] = [];

    root.querySelectorAll(".vkm-btn").forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push(r);
    });

    const W = window.innerWidth;
    const H = window.innerHeight;
    const pad = 4;
    const next = new Set<Element>();

    const visit = (el: Element, depth: number): void => {
      if (depth > 6 || el.hasAttribute("data-vkm-keep")) return;

      const r = el.getBoundingClientRect();
      const kids = () => {
        for (const c of Array.from(el.children)) visit(c, depth + 1);
      };

      // zero-size wrapper (position:fixed children) or a big layout container: look inside
      if (r.width < 1 || r.height < 1 || r.width >= W * 0.6 || r.height >= H * 0.6) {
        kids();
        return;
      }

      let covered = 0;

      for (const b of rects) {
        const w = Math.min(r.right, b.right + pad) - Math.max(r.left, b.left - pad);
        const h = Math.min(r.bottom, b.bottom + pad) - Math.max(r.top, b.top - pad);
        if (w > 0 && h > 0) covered += w * h;
      }

      if (covered / (r.width * r.height) >= 0.25) {
        next.add(el);
      } else if (covered > 0) {
        kids(); // partly covered container: only hide the child widgets that are covered
      }
    };

    for (const c of Array.from(hudRoot.children)) visit(c, 0);

    for (const el of this.hudHidden) {
      if (!next.has(el)) el.classList.remove("vkm-under");
    }

    for (const el of next) el.classList.add("vkm-under");

    this.hudHidden = next;
  }

  private applyVars(): void {
    if (!this.root) return;

    const size = this.joystickSize * this.uiScale;

    this.root.style.setProperty("--vkm-s", String(this.uiScale));
    this.root.style.setProperty("--vkm-o", String(this.opacity));
    this.root.style.setProperty("--vkm-size", `${size}px`);
  }

  private buzz(): void {
    if (!this.haptics) return;

    try {
      navigator.vibrate?.(8);
    } catch {
      // not supported
    }
  }

  /** KeyboardEvent that also carries keyCode / which (many handlers still read them). */
  private makeKeyEvent(type: string, code: string): KeyboardEvent {
    const keyCode = code === "Escape" ? 27 : code === "Enter" ? 13 : 0;

    const ev = new KeyboardEvent(type, {
      code,
      key: code,
      bubbles: true,
      cancelable: true,
    });

    for (const prop of ["keyCode", "which", "charCode"] as const) {
      try {
        Object.defineProperty(ev, prop, {
          get: () => (prop === "charCode" && type !== "keypress" ? 0 : keyCode),
        });
      } catch {
        // ignore
      }
    }

    return ev;
  }

  /** Synthetic key for the game's own keydown listeners (Esc, Enter). */
  private tapKeyEvent(code: string, target: EventTarget = document.body): void {
    target.dispatchEvent(this.makeKeyEvent("keydown", code));

    if (code === "Enter") {
      target.dispatchEvent(this.makeKeyEvent("keypress", code));
    }

    window.setTimeout(
      () => target.dispatchEvent(this.makeKeyEvent("keyup", code)),
      30,
    );
  }

  // ==========================================================
  // STYLE
  // ==========================================================

  private createStyle(): void {
    this.style = document.createElement("style");

    this.style.textContent = `
      .vkm-root {
        --vkm-s: 1;
        --vkm-o: .8;
        --vkm-size: 135px;
        --vkm-l: max(18px, env(safe-area-inset-left));
        --vkm-r: max(18px, env(safe-area-inset-right));
        --vkm-t: max(10px, env(safe-area-inset-top));
        --vkm-b: max(14px, env(safe-area-inset-bottom));
        --vkm-accent: #22d3ee;
        --vkm-fire: #fb4a3a;

        position: fixed;
        inset: 0;
        z-index: 9999;
        overflow: hidden;
        /* Transparent to touches: everything under the controls keeps working. */
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        color: #fff;
      }

      /* Popover (top layer) resets: the UA centres / pads / borders popovers */
      .vkm-root[popover] {
        position: fixed;
        inset: 0;
        margin: 0;
        padding: 0;
        border: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        background: transparent;
        overflow: hidden;
        color: #fff;
      }

      .vkm-root * {
        box-sizing: border-box;
        -webkit-tap-highlight-color: transparent;
      }

      .vkm-root.vkm-off { display: none; }

      /* Chat open: every control goes away (nothing can steal the keyboard's touches),
         only the Send button stays. The root itself never takes touches. */
      .vkm-root.vkm-chat .vkm-hud,
      .vkm-root.vkm-chat .vkm-ghost,
      .vkm-root.vkm-chat .vkm-joy,
      .vkm-root.vkm-chat .vkm-rotate { display: none; }

      /* Before "Click to Play": nothing but the page itself */
      .vkm-root.vkm-idle .vkm-hud,
      .vkm-root.vkm-idle .vkm-ghost { display: none; }

      /* Game HUD widgets covered by the controls (class added to elements outside the root) */
      .vkm-under {
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* ---------- Buttons ---------- */
      .vkm-btn {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding: 0;
        margin: 0;
        color: #e8f7ff;
        font: 800 calc(11px * var(--vkm-s)) / 1 system-ui, sans-serif;
        letter-spacing: .04em;
        background:
          linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,0) 45%),
          rgba(10, 16, 28, .62);
        border: 1.5px solid rgba(255,255,255,.22);
        border-radius: 16px;
        box-shadow:
          0 6px 18px rgba(0,0,0,.35),
          inset 0 0 0 1px rgba(34,211,238,.10);
        opacity: var(--vkm-o);
        pointer-events: auto;
        touch-action: none;
        cursor: pointer;
        transition: transform .08s ease, background .08s ease,
                    border-color .08s ease, box-shadow .08s ease, opacity .08s ease;
      }

      .vkm-btn:focus { outline: none; }

      .vkm-btn svg {
        width: 46%;
        height: 46%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }

      /* icon-only small buttons: bigger glyph + slot number badge */
      .vkm-num svg { width: 58%; height: 58%; stroke-width: 2; }
      .vkm-badge {
        position: absolute;
        left: 4px;
        top: 2px;
        font-size: calc(8px * var(--vkm-s));
        font-weight: 800;
        line-height: 1;
        opacity: .85;
        pointer-events: none;
      }
      .vkm-slotnum { font-size: calc(14px * var(--vkm-s)); }

      .vkm-cap {
        font-size: calc(8px * var(--vkm-s));
        font-weight: 700;
        opacity: .75;
        pointer-events: none;
      }

      .vkm-btn.vkm-on {
        opacity: 1;
        transform: scale(.9);
        border-color: var(--vkm-accent);
        background:
          linear-gradient(160deg, rgba(34,211,238,.55), rgba(34,211,238,.18)),
          rgba(8, 40, 56, .85);
        box-shadow: 0 0 18px rgba(34,211,238,.65), inset 0 0 12px rgba(34,211,238,.35);
      }

      .vkm-round { border-radius: 50%; }

      .vkm-fire {
        color: #fff;
        border-color: rgba(255,255,255,.55);
        background:
          radial-gradient(circle at 35% 30%, rgba(255,160,140,.55), rgba(255,255,255,0) 55%),
          linear-gradient(160deg, #ff6a55, #c4281b);
        box-shadow: 0 8px 26px rgba(251,74,58,.45), inset 0 0 14px rgba(255,255,255,.18);
      }
      .vkm-fire.vkm-on {
        border-color: #fff;
        background: linear-gradient(160deg, #ff8a78, #e0301f);
        box-shadow: 0 0 30px rgba(251,74,58,.9), inset 0 0 16px rgba(255,255,255,.35);
      }

      .vkm-num {
        font-size: calc(13px * var(--vkm-s));
        border-radius: 10px;
      }

      /* ---------- Chat send button ---------- */
      .vkm-send {
        position: absolute;
        left: 0;
        top: 0;
        display: none;
        align-items: center;
        justify-content: center;
        width: calc(46px * var(--vkm-s));
        height: calc(46px * var(--vkm-s));
        padding: 0;
        margin: 0;
        color: #fff;
        border: 1.5px solid rgba(255,255,255,.55);
        border-radius: 50%;
        background: linear-gradient(160deg, #35d9f2, #0b8fb0);
        box-shadow: 0 6px 18px rgba(0,0,0,.4), 0 0 14px rgba(34,211,238,.45);
        pointer-events: auto;
        touch-action: none;
        cursor: pointer;
        z-index: 8;
      }
      .vkm-send:focus { outline: none; }
      .vkm-send svg {
        width: 52%;
        height: 52%;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }
      .vkm-send.vkm-on { transform: scale(.92); filter: brightness(1.15); }
      .vkm-root.vkm-chat .vkm-send { display: flex; }
      .vkm-root.vkm-idle .vkm-send { display: none; }

      /* ---------- Top bars ---------- */
      .vkm-top {
        position: absolute;
        top: var(--vkm-t);
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: calc(6px * var(--vkm-s));
        pointer-events: none;
        z-index: 4;
      }
      .vkm-top .vkm-btn {
        position: relative;
        width: calc(36px * var(--vkm-s));
        height: calc(32px * var(--vkm-s));
        border-radius: 10px;
      }

      .vkm-row {
        position: absolute;
        display: flex;
        gap: calc(6px * var(--vkm-s));
        pointer-events: none;
      }
      .vkm-row .vkm-btn {
        position: relative;
        width: calc(36px * var(--vkm-s));
        height: calc(36px * var(--vkm-s));
        border-radius: 10px;
      }
      .vkm-util  { left: var(--vkm-l); top: calc(var(--vkm-t) + 4px); }
      .vkm-radio { left: var(--vkm-l); top: calc(var(--vkm-t) + 4px + 44px * var(--vkm-s)); }
      .vkm-weap  { right: var(--vkm-r); top: var(--vkm-t); }
      .vkm-weap .vkm-btn {
        width: calc(34px * var(--vkm-s));
        height: calc(34px * var(--vkm-s));
      }

      /* ---------- Joystick ---------- */
      .vkm-ghost,
      .vkm-joy {
        position: absolute;
        width: var(--vkm-size);
        height: var(--vkm-size);
        border-radius: 50%;
        pointer-events: none;
        border: 2px solid rgba(255,255,255,.22);
        background: radial-gradient(circle, rgba(34,211,238,.10), rgba(10,16,28,.40) 72%);
        box-shadow: 0 8px 28px rgba(0,0,0,.35), inset 0 0 22px rgba(34,211,238,.12);
      }
      .vkm-ghost {
        left: var(--vkm-l);
        bottom: var(--vkm-b);
        opacity: var(--vkm-o);
        /* the fixed base owns its touch (like a button): no document-level guessing */
        pointer-events: auto;
        touch-action: none;
      }
      /* larger invisible grab area around the base */
      .vkm-ghost::before {
        content: "";
        position: absolute;
        inset: -20%;
        border-radius: 50%;
      }
      .vkm-ghost.vkm-show {
        border-color: var(--vkm-accent);
        box-shadow: 0 8px 28px rgba(0,0,0,.35), 0 0 18px rgba(34,211,238,.45),
                    inset 0 0 22px rgba(34,211,238,.25);
      }
      .vkm-ghost::after,
      .vkm-joy::after {
        content: "";
        position: absolute;
        inset: 22%;
        border-radius: 50%;
        border: 1px dashed rgba(255,255,255,.20);
      }
      .vkm-joy {
        display: none;
        left: 0;
        top: 0;
        opacity: var(--vkm-o);
        will-change: transform;
      }
      .vkm-joy.vkm-show { display: block; }

      .vkm-stick {
        position: absolute;
        left: 29%;
        top: 29%;
        width: 42%;
        height: 42%;
        border-radius: 50%;
        background:
          radial-gradient(circle at 35% 30%, #fff, rgba(190,235,255,.75) 55%, rgba(34,211,238,.6));
        border: 2px solid rgba(255,255,255,.9);
        box-shadow: 0 0 16px rgba(34,211,238,.55), 0 4px 10px rgba(0,0,0,.4);
        will-change: transform;
      }

      /* ---------- ESC menu open: only the MENU button stays ---------- */
      .vkm-root.vkm-paused .vkm-hud > :not(.vkm-top),
      .vkm-root.vkm-paused .vkm-ghost,
      .vkm-root.vkm-paused .vkm-top .vkm-btn:not(.vkm-menu-btn) { display: none; }
      .vkm-root.vkm-paused .vkm-menu-btn {
        opacity: 1;
        border-color: var(--vkm-accent);
        box-shadow: 0 0 16px rgba(34,211,238,.6);
      }

      /* ---------- Collapsed (setCollapsed API) ---------- */
      .vkm-root.vkm-collapsed .vkm-hud > :not(.vkm-top) { display: none; }
      .vkm-root.vkm-collapsed .vkm-top .vkm-btn:not(.vkm-keep) { display: none; }

      /* ---------- Portrait hint (never blocks touches) ---------- */
      .vkm-rotate { display: none; }
      @media (orientation: portrait) {
        .vkm-rotate {
          display: block;
          position: absolute;
          left: 50%;
          top: calc(var(--vkm-t) + 48px);
          transform: translateX(-50%);
          padding: 8px 14px;
          font: 700 12px system-ui, sans-serif;
          text-align: center;
          color: #fff;
          background: rgba(10,16,28,.85);
          border: 1px solid rgba(34,211,238,.5);
          border-radius: 999px;
          pointer-events: none;
          white-space: nowrap;
        }
        .vkm-root.vkm-idle .vkm-rotate { display: none; }
      }
    `;

    document.head.appendChild(this.style);
  }

  // ==========================================================
  // UI
  // ==========================================================

  private createUI(): void {
    const root = document.createElement("div");
    // `pb-virtual-controls`: main.ts ignores clicks coming from this class (no pointer lock request)
    root.className = "vkm-root pb-virtual-controls vkm-idle";
    this.root = root;

    // Joystick ghost (hint) + dynamic base
    this.ghost = document.createElement("div");
    this.ghost.className = "vkm-ghost";
    root.appendChild(this.ghost);

    // Fixed joystick: the base never moves, the stick lives inside it.
    this.joy = this.ghost;
    this.stick = document.createElement("div");
    this.stick.className = "vkm-stick";
    this.ghost.appendChild(this.stick);
    this.bindJoystick(this.ghost);

    // Everything else lives in the HUD group
    this.hud = document.createElement("div");
    this.hud.className = "vkm-hud";
    root.appendChild(this.hud);

    this.createTopBar();

    if (this.showControls) {
      this.createUtilityButtons();
      this.createWeaponButtons();
      if (this.showRadio) this.createRadioButtons();
      this.createActionButtons();
    }

    this.createSendButton();

    const rotate = document.createElement("div");
    rotate.className = "vkm-rotate";
    rotate.textContent = "Putar ke landscape untuk bermain";
    root.appendChild(rotate);

    this.attachRoot();
  }

  /**
   * Keep the controls on top of the page, also in fullscreen.
   *
   * The root always lives in <body> and is shown as a manual popover: that puts it in the
   * browser TOP LAYER, positioned against the viewport, above ANY fullscreen element
   * (<html>, <body>, #app, a canvas...) and unaffected by transforms / overflow / contain of
   * the page. Re-parenting into the fullscreen element (what this used to do) broke the
   * positions and the touch mapping whenever that element was transformed, sized differently
   * from the viewport, or could not hold children (canvas).
   *
   * Browsers without the Popover API fall back to re-parenting, only into containers that
   * can hold children.
   */
  private attachRoot(force = false): void {
    const root = this.root as PopoverElement | null;
    if (!root) return;

    if (root.parentElement !== document.body) {
      document.body.appendChild(root);
    }

    if (typeof root.showPopover === "function") {
      root.setAttribute("popover", "manual");

      // Already on top: leave it alone (hide + show would cancel the touch in progress)
      if (!force && root.matches(":popover-open")) return;

      try {
        // show again so the root is the LAST element of the top layer (above a new fullscreen)
        if (root.matches(":popover-open")) root.hidePopover?.();
        root.showPopover();
        return;
      } catch {
        // fall through to the re-parent fallback
      }
    }

    const fs = document.fullscreenElement;

    if (
      fs instanceof HTMLElement &&
      fs !== document.documentElement &&
      fs !== document.body &&
      !fs.matches("canvas, video, img, iframe, embed, object") &&
      root.parentElement !== fs
    ) {
      fs.appendChild(root);
    }
  }

  private createTopBar(): void {
    const bar = document.createElement("div");
    bar.className = "vkm-top";

    this.makeButton(bar, {
      label: "Menu",
      html: ICON.menu,
      className: "vkm-keep vkm-menu-btn",
      always: true,
      onTap: () => this.toggleMenu(),
    });

    this.makeButton(bar, {
      label: "Scoreboard",
      html: ICON.score,
      key: this.keys.scoreboard,
      hold: true,
    });

    this.makeButton(bar, {
      label: "Chat",
      html: ICON.chat,
      onTap: () => this.tapKeyEvent("Enter"),
    });

    this.hud!.appendChild(bar);
  }

  private createUtilityButtons(): void {
    const row = document.createElement("div");
    row.className = "vkm-row vkm-util";

    const items: Array<[string, string, string, string]> = [
      [cap(ICON.swap, "Q"), this.keys.lastWeapon, "Senjata terakhir", ""],
      [cap(ICON.drop, "G"), this.keys.drop, "Buang senjata", ""],
      [cap(ICON.laser, "B"), this.keys.extension, "Laser", ""],
      [cap(ICON.dual, "F"), this.keys.extension2, "Dual", ""],
    ];

    for (const [html, key, label] of items) {
      this.makeButton(row, { label, html, key, className: "vkm-num" });
    }

    this.hud!.appendChild(row);
  }

  private createWeaponButtons(): void {
    const row = document.createElement("div");
    row.className = "vkm-row vkm-weap";

    PB_KEYS.slots.forEach((code, index) => {
      this.makeButton(row, {
        label: `Senjata ${index + 1}`,
        html: SLOT_ICONS[index]
          ? `${SLOT_ICONS[index]}<span class="vkm-badge">${index + 1}</span>`
          : String(index + 1),
        key: code,
        className: SLOT_ICONS[index] ? "vkm-num" : "vkm-num vkm-slotnum",
      });
    });

    this.hud!.appendChild(row);
  }

  private createRadioButtons(): void {
    const row = document.createElement("div");
    row.className = "vkm-row vkm-radio";

    PB_KEYS.radio.forEach((code, index) => {
      this.makeButton(row, {
        label: `Radio ${index + 1}`,
        html: ["Z", "X", "C"][index],
        key: code,
        className: "vkm-num",
      });
    });

    this.hud!.appendChild(row);
  }

  private createActionButtons(): void {
    const hud = this.hud!;

    this.makeButton(hud, {
      label: "Tembak",
      html: ICON.fire,
      className: "vkm-round vkm-fire",
      mouse: 0,
      hold: true,
      look: true,
      br: { x: 0, y: 0, size: 96 },
    });

    this.makeButton(hud, {
      label: "Bidik",
      html: ICON.aim,
      className: "vkm-round",
      mouse: 2,
      hold: true,
      look: true,
      br: { x: 108, y: 8, size: 60 },
    });

    this.makeButton(hud, {
      label: "Lompat",
      html: cap(ICON.jump, "JUMP"),
      className: "vkm-round",
      key: this.keys.jump,
      br: { x: 14, y: 108, size: 62 },
    });

    this.makeButton(hud, {
      label: "Jongkok",
      html: cap(ICON.crouch, "CROUCH"),
      className: "vkm-round",
      key: this.keys.crouch,
      hold: true,
      br: { x: 14, y: 182, size: 52 },
    });

    this.makeButton(hud, {
      label: "Reload",
      html: cap(ICON.reload, "R"),
      className: "vkm-round",
      key: this.keys.reload,
      br: { x: 112, y: 76, size: 52 },
    });

    this.makeButton(hud, {
      label: "Aksi",
      html: cap(ICON.action, "E"),
      className: "vkm-round",
      key: this.keys.action,
      hold: true,
      br: { x: 84, y: 146, size: 50 },
    });

    this.makeButton(hud, {
      label: "Jalan pelan",
      html: cap(ICON.walk, "WALK"),
      className: "vkm-round",
      key: this.keys.walk,
      hold: true,
      br: { x: 172, y: 22, size: 46 },
    });
  }

  // ==========================================================
  // BUTTON FACTORY
  // ==========================================================

  private makeButton(
    parent: HTMLElement,
    cfg: ButtonConfig,
  ): HTMLButtonElement {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `vkm-btn ${cfg.className ?? ""}`;
    button.innerHTML = cfg.html;
    button.setAttribute("aria-label", cfg.label);

    if (cfg.br) {
      const { x, y, size } = cfg.br;
      const s = "var(--vkm-s)";

      button.style.right = `calc(var(--vkm-r) + ${x}px * ${s})`;
      button.style.bottom = `calc(var(--vkm-b) + ${y}px * ${s})`;
      button.style.width = `calc(${size}px * ${s})`;
      button.style.height = `calc(${size}px * ${s})`;
    }

    let pid: number | null = null;
    let last = { x: 0, y: 0 };
    let timer = 0;

    const setDown = (down: boolean) => {
      if (cfg.key) this.input.setVirtualKey(cfg.key, down);
      if (cfg.mouse !== undefined) this.input.setVirtualButton(cfg.mouse, down);
    };

    const finish = () => {
      window.clearTimeout(timer);
      this.releasers.delete(finish);

      pid = null;
      setDown(false);
      button.classList.remove("vkm-on");
    };

    button.addEventListener("pointerdown", (e) => {
      if (pid !== null) return;

      this.syncTransition();

      const allowed = cfg.always
        ? this.enabled && this.playing && !this.input.chatOpen
        : this.active;

      if (!allowed) return;

      e.preventDefault();
      e.stopPropagation();

      pid = e.pointerId;
      last = { x: e.clientX, y: e.clientY };

      try {
        button.setPointerCapture(e.pointerId);
      } catch {
        // optional
      }

      button.classList.add("vkm-on");
      this.buzz();

      cfg.onTap?.();
      setDown(true);

      if (cfg.hold) {
        this.releasers.add(finish);
      } else {
        // Short tap: key stays down a few ms so both held() and pressed() style reads see it.
        this.releasers.add(finish);
        timer = window.setTimeout(finish, TAP_MS);
      }
    });

    button.addEventListener("pointermove", (e) => {
      if (!cfg.look || e.pointerId !== pid || !this.active) return;

      e.preventDefault();

      this.addLook(e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
    });

    const end = (e: PointerEvent) => {
      if (e.pointerId !== pid || !cfg.hold) return;

      e.preventDefault();
      finish();
    };

    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("lostpointercapture", end);

    parent.appendChild(button);

    return button;
  }

  // ==========================================================
  // GLOBAL (document-level) GESTURES: joystick + look
  // They never cover the page, so nothing underneath is blocked.
  // ==========================================================

  private bindGlobalEvents(): void {
    const signal = this.abort!.signal;

    document.documentElement.style.touchAction = "none";
    document.documentElement.style.overscrollBehavior = "none";

    // Capture: we only observe, never stop the event, so the page still gets its click.
    document.addEventListener("pointerdown", this.onPointerDown, {
      capture: true,
      signal,
    });
    document.addEventListener("pointermove", this.onPointerMove, { signal });
    document.addEventListener("pointerup", this.onPointerEnd, { signal });
    document.addEventListener("pointercancel", this.onPointerEnd, { signal });

    // "Click to Play" on touch: dismiss the blocker, start touch play.
    document.addEventListener(
      "click",
      (e) => {
        if (this.playing) return;

        const target = e.target as Element | null;

        if (target?.closest("#blocker .ov-play, #blocker")) {
          if (target.closest("#pbleave")) return; // Leave Match keeps its own handler
          this.startPlay();
        }
      },
      { signal },
    );

    window.addEventListener("blur", this.handleBlur, { signal });
    document.addEventListener("visibilitychange", this.handleVisibility, {
      signal,
    });
    window.addEventListener("orientationchange", () => this.onFullscreenChange(), {
      signal,
    });

    window.addEventListener(
      "resize",
      () => {
        // The on-screen keyboard / browser bars also fire resize: never cut a held joystick.
        if (this.joyPointer === null) this.resetJoystick();
        window.setTimeout(() => this.scanHud(), 200);
        this.positionSend();
      },
      { signal },
    );

    // Keep the Send button next to the chat field while the keyboard moves the viewport.
    window.visualViewport?.addEventListener("resize", () => this.positionSend(), {
      signal,
    });
    window.visualViewport?.addEventListener("scroll", () => this.positionSend(), {
      signal,
    });
    document.addEventListener("focusin", () => this.positionSend(), { signal });

    // Fullscreen: keep the controls in the top layer, above the fullscreen element.
    document.addEventListener(
      "fullscreenchange",
      () => this.onFullscreenChange(),
      { signal },
    );
  }

  /**
   * Entering / leaving fullscreen (and the rotation that usually comes with it) cancels the
   * touches in progress and resizes the viewport a moment later. Drop everything held, put the
   * controls back on top of the new top layer, then re-check once the new size has settled.
   */
  private onFullscreenChange(): void {
    this.hardReset();
    this.attachRoot(true);

    for (const delay of [120, 400]) {
      window.setTimeout(() => {
        if (this.destroyed) return;

        this.resetJoystick();
        this.attachRoot(true);
        this.applyVars();
        this.scanHud();
      }, delay);
    }
  }

  private isInteractive(start: Element | null): boolean {
    let el: Element | null = start;

    for (let depth = 0; el && depth < 8; depth++, el = el.parentElement) {
      if (el === document.body || el === document.documentElement) break;
      if (el.matches(INTERACTIVE)) return true;

      try {
        if (getComputedStyle(el).cursor === "pointer") return true;
      } catch {
        // ignore
      }
    }

    return false;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === "mouse") return;

    this.syncTransition();

    // A primary touch means no other finger is down. Anything still tracked is stale
    // (a pointerup / pointercancel was lost while chat / menu / fullscreen swapped the UI),
    // so drop it now instead of leaving the analog or a button dead.
    if (e.isPrimary) {
      this.resetJoystick();
      this.lookPointers.clear();

      for (const release of [...this.releasers]) release();
    }

    if (!this.active) return;

    const target = e.target as Element | null;

    // Our own buttons handle themselves; real page UI (HUD buttons, menus…) keeps its touch.
    if (!target || this.root?.contains(target)) return;
    if (this.isInteractive(target)) return;

    const leftZone = e.clientX < window.innerWidth * 0.42;

    // Left side belongs to the fixed joystick base (it handles its own touch).
    if (!leftZone) {
      this.lookPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const prev = this.lookPointers.get(e.pointerId);
    if (!prev || !this.active) return;

    this.addLook(e.clientX - prev.x, e.clientY - prev.y);

    prev.x = e.clientX;
    prev.y = e.clientY;
  };

  private onPointerEnd = (e: PointerEvent): void => {
    this.lookPointers.delete(e.pointerId);
  };

  private addLook(dx: number, dy: number): void {
    const scale = clamp(window.innerWidth / 900, 0.82, 1.25);

    this.input.addVirtualLook(
      dx * this.sensitivityX * scale,
      dy * this.sensitivityY * scale * (this.invertY ? -1 : 1),
    );
  }

  // ==========================================================
  // CHAT SEND BUTTON
  // ==========================================================

  private createSendButton(): void {
    const btn = document.createElement("button");

    btn.type = "button";
    btn.tabIndex = -1;
    btn.className = "vkm-send";
    btn.innerHTML = ICON.send;
    btn.setAttribute("aria-label", "Kirim chat");

    // Never let the tap steal focus from the chat field (that would close the keyboard / chat).
    const keepFocus = (e: Event) => e.preventDefault();

    btn.addEventListener("mousedown", keepFocus);
    btn.addEventListener("touchstart", keepFocus, { passive: false });

    let pid: number | null = null;

    btn.addEventListener("pointerdown", (e) => {
      if (pid !== null || !this.input.chatOpen) return;

      e.preventDefault();
      e.stopPropagation();

      pid = e.pointerId;
      btn.classList.add("vkm-on");
    });

    btn.addEventListener("pointerup", (e) => {
      if (e.pointerId !== pid) return;

      e.preventDefault();

      pid = null;
      btn.classList.remove("vkm-on");

      this.sendChat();
    });

    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;

      pid = null;
      btn.classList.remove("vkm-on");
    };

    btn.addEventListener("pointercancel", cancel);
    btn.addEventListener("pointerleave", cancel);

    this.sendBtn = btn;
    this.root!.appendChild(btn);
  }

  /** The chat text field: the focused field, else the first chat-looking one on the page. */
  private chatField(): HTMLInputElement | HTMLTextAreaElement | null {
    const a = document.activeElement;

    if (
      (a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement) &&
      !this.root?.contains(a)
    ) {
      return a;
    }

    return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      '[id*="chat" i] input, [id*="chat" i] textarea, [class*="chat" i] input, [class*="chat" i] textarea',
    );
  }

  /** Same as pressing Enter in the chat field. */
  private sendChat(): void {
    if (!this.input.chatOpen || this.destroyed) return;

    this.buzz();

    const field = this.chatField();
    const before = field?.value ?? "";

    this.tapKeyEvent("Enter", field ?? document.body);

    // Fallback for a field the game submits through a <form> instead of a key handler:
    // only when the chat is still open and the text is untouched (so it cannot send twice).
    window.setTimeout(() => {
      if (this.destroyed || !this.input.chatOpen || !field) return;
      if (!before.trim() || field.value !== before) return;

      try {
        field.form?.requestSubmit();
      } catch {
        // ignore
      }
    }, 90);
  }

  /** Put the Send button next to the chat field, above the on-screen keyboard. */
  private positionSend(): void {
    const btn = this.sendBtn;

    if (!btn || !this.input.chatOpen || this.destroyed) return;

    const size = btn.offsetWidth || 46 * this.uiScale;
    const m = 8;
    const vv = window.visualViewport;
    const bottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - m;

    let left = window.innerWidth - size - m - 10;
    let top = bottom - size;

    const field = this.chatField();
    const r = field?.getBoundingClientRect();

    if (r && r.width > 0 && r.height > 0) {
      // right of the field when there is room, otherwise inside its right end
      left = r.right + m + size <= window.innerWidth - m ? r.right + m : r.right - size - 4;
      top = r.top + r.height / 2 - size / 2;
    }

    btn.style.left = `${clamp(left, m, window.innerWidth - size - m)}px`;
    btn.style.top = `${clamp(top, m, Math.max(m, bottom - size))}px`;
  }

  // ==========================================================
  // JOYSTICK (floating)
  // ==========================================================

  private get joySize(): number {
    return this.joystickSize * this.uiScale;
  }

  /** Centre of the fixed base as it is drawn right now (always matches what the finger sees). */
  private readJoyCenter(): { x: number; y: number; r: number } | null {
    if (!this.ghost) return null;

    const r = this.ghost.getBoundingClientRect();

    if (r.width < 1 || r.height < 1) return null;

    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
  }

  private startJoystick(x: number, y: number): void {
    const c = this.readJoyCenter();

    if (!c || !this.joy) return;

    this.joyCenter = { x: c.x, y: c.y };
    this.joy.classList.add("vkm-show");
    this.moveJoystick(x, y);
  }

  /** The fixed base takes its own touches with pointer capture, exactly like the buttons. */
  private bindJoystick(base: HTMLElement): void {
    base.addEventListener("pointerdown", (e) => {
      this.syncTransition();

      if (!this.active || this.joyPointer !== null) return;

      e.preventDefault();
      e.stopPropagation();

      this.joyPointer = e.pointerId;
      this.joyCaptured = false;

      try {
        base.setPointerCapture(e.pointerId);
        this.joyCaptured = true;
      } catch {
        // optional
      }

      this.startJoystick(e.clientX, e.clientY);
    });

    base.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.joyPointer) return;

      e.preventDefault();
      this.moveJoystick(e.clientX, e.clientY);
    });

    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.joyPointer) return;

      this.resetJoystick();
    };

    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
    base.addEventListener("lostpointercapture", end);
  }

  private moveJoystick(x: number, y: number): void {
    if (!this.stick) return;

    // re-read every move: keyboard / bars / rotation can shift the base under a held finger
    const c = this.readJoyCenter();
    if (c) this.joyCenter = { x: c.x, y: c.y };

    const travel = this.joySize * 0.32;

    let dx = x - this.joyCenter.x;
    let dy = y - this.joyCenter.y;

    const dist = Math.hypot(dx, dy);

    if (dist > travel) {
      const k = travel / dist;
      dx *= k;
      dy *= k;
    }

    this.stick.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    this.applyDirection(dx / travel, dy / travel);
  }

  private applyDirection(x: number, y: number): void {
    const inside = Math.hypot(x, y) >= this.deadzone;
    const t = this.directionThreshold;

    this.input.setVirtualKey(this.keys.left, inside && x <= -t);
    this.input.setVirtualKey(this.keys.right, inside && x >= t);
    this.input.setVirtualKey(this.keys.forward, inside && y <= -t);
    this.input.setVirtualKey(this.keys.back, inside && y >= t);
  }

  private resetJoystick(): void {
    this.joyPointer = null;
    this.joyCaptured = false;

    this.input.setVirtualKey(this.keys.forward, false);
    this.input.setVirtualKey(this.keys.back, false);
    this.input.setVirtualKey(this.keys.left, false);
    this.input.setVirtualKey(this.keys.right, false);

    if (this.stick) this.stick.style.transform = "translate3d(0,0,0)";
    this.joy?.classList.remove("vkm-show");
  }

  // ==========================================================
  // RELEASE
  // ==========================================================

  private handleBlur = (): void => {
    this.releaseAll();
  };

  private handleVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  private releaseAll(): void {
    this.resetJoystick();

    for (const release of [...this.releasers]) {
      release();
    }

    this.releasers.clear();
    this.lookPointers.clear();

    this.input.releaseVirtual();
  }
}