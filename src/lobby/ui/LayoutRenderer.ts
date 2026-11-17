import type { Caption, Control, SceneJson } from "./format.ts";
import type { LoadedSheet } from "./assets.ts";
import { ensureUiFont, FONTS } from "./assets.ts";
import { INTERACTIVE, buildSkin, wireStates, type SkinHandle } from "./Skin.ts";

const CSS = `
.pbui-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.pbui-stage input,
.pbui-stage textarea {
  user-select: text;
  -webkit-user-select: text;
}

.pbui-design {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  overflow: hidden;
  will-change: transform;
}

.pbui-scene,
.pbui-ctl {
  position: absolute;
}

.pbui-ctl {
  box-sizing: border-box;
}

.pbui-skin,
.pbui-state {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pbui-piece {
  position: absolute;
  background-repeat: no-repeat;
}

.pbui-missing {
  background: rgba(255,0,200,.28);
  outline: 1px solid rgba(255,0,200,.85);
  outline-offset: -1px;
}

.pbui-caption {
  position: absolute;
  inset: 0;
  display: flex;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  font-family: ${FONTS.lobby};
  font-weight: bold;
  line-height: 1;
}

.pbui-ctl[data-cls="i3UIRadio"] > .pbui-caption {
  left: 21px;
}

.pbui-int {
  cursor: pointer;
  touch-action: manipulation;
}

.pbui-disabled {
  cursor: default;
}

/* Orientation / fullscreen gate (mobile only, see Stage.forceLandscape) */
.pbui-rotate {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 24px;
  border: 0;
  overflow: hidden;
  background: #000;
  color: #fff;
  text-align: center;
  font: 700 18px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  touch-action: manipulation;
}

.pbui-rotate.pbui-show {
  display: flex;
}

.pbui-rotate svg {
  width: 64px;
  height: 64px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pbui-rotate .pbui-ico-turn {
  animation: pbui-rotate 2.2s ease-in-out infinite;
}

.pbui-rotate[data-mode="portrait"] .pbui-ico-fs,
.pbui-rotate[data-mode="fullscreen"] .pbui-ico-turn {
  display: none;
}

.pbui-rotate-sub {
  max-width: 340px;
  font-size: 13px;
  font-weight: 500;
  opacity: .75;
}

.pbui-rotate-btn {
  margin-top: 8px;
  padding: 13px 30px;
  color: #fff;
  font: 800 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  letter-spacing: .04em;
  background: linear-gradient(160deg, #35d9f2, #0b8fb0);
  border: 1.5px solid rgba(255,255,255,.55);
  border-radius: 999px;
  box-shadow: 0 6px 18px rgba(0,0,0,.45), 0 0 14px rgba(34,211,238,.4);
  cursor: pointer;
  touch-action: manipulation;
}

.pbui-rotate-btn:active {
  transform: scale(.96);
}

@keyframes pbui-rotate {
  0%, 25% { transform: rotate(0deg); }
  70%, 100% { transform: rotate(-90deg); }
}

@media (max-width: 600px) {
  .pbui-caption {
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
  }
}
`;

function ensureCss(): void {
  if (document.getElementById("pbui-css")) return;

  const st = document.createElement("style");
  st.id = "pbui-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

const WARM: Record<string, [number, number, number]> = {
  "82,177,235": [255, 196, 96],
  "160,209,255": [255, 224, 170],
  "103,135,167": [196, 170, 124],
  "21,151,232": [255, 159, 21],
};

const rgba = (c: [number, number, number, number]) => {
  const w = WARM[`${c[0]},${c[1]},${c[2]}`];
  return `rgba(${w ? w.join(",") : `${c[0]},${c[1]},${c[2]}`},${c[3]})`;
};

const FLEX = ["flex-start", "center", "flex-end"];

export const fontPx = (size: number) =>
  Math.round(size * 96 / 72 * 10) / 10;

const isButton = (cls?: string) =>
  !!cls && cls.startsWith("i3UIButton");

export function applyCaption(
  el: HTMLElement,
  cap: Caption,
  text?: string,
  cls?: string
): HTMLElement {
  let span = el.querySelector<HTMLElement>(":scope > .pbui-caption");

  if (!span) {
    span = document.createElement("div");
    span.className = "pbui-caption";
    el.appendChild(span);
  }

  span.style.fontSize = `${fontPx(cap.size || 10)}px`;
  span.style.color = rgba(cap.color);

  if (cap.shadow[3] > 0) {
    span.style.textShadow = `1px 1px 0 ${rgba(cap.shadow)}`;
  }

  span.style.justifyContent = FLEX[cap.alignX] ?? "flex-start";
  span.style.alignItems =
    isButton(cls) ? "center" : FLEX[cap.alignY] ?? "center";

  span.textContent = text ?? cap.text;

  return span;
}

export interface RenderOptions {
  captions?: boolean;
  texts?: Record<string, string>;
  hidden?: string[];
}

export class RenderedScene {
  readonly root: HTMLElement;
  readonly byName = new Map<string, HTMLElement>();
  readonly byId = new Map<number, HTMLElement>();
  readonly skins = new Map<number, SkinHandle>();
  readonly untranslated: string[] = [];

  private disposers: (() => void)[] = [];

  constructor(
    readonly scene: SceneJson,
    readonly sheet: LoadedSheet,
    opts: RenderOptions = {}
  ) {
    ensureCss();
    ensureUiFont();

    const root = document.createElement("div");
    root.className = "pbui-scene";
    root.dataset.scene = scene.name;

    root.style.cssText =
      `left:0;top:0;width:${scene.design.w}px;height:${scene.design.h}px`;

    this.root = root;

    const hidden = new Set(opts.hidden ?? []);
    const ids = new Set(scene.controls.map(c => c.id));

    // Create controls first.
    for (const c of scene.controls) {
      if (!c.noLayout) {
        this.byId.set(c.id, this.makeControl(c, opts, hidden));
      }
    }

    // Attach controls to their parents.
    for (const c of scene.controls) {
      const el = this.byId.get(c.id);
      if (!el) continue;

      const parent =
        c.parent !== null && ids.has(c.parent)
          ? this.byId.get(c.parent)
          : undefined;

      (parent ?? root).appendChild(el);
    }
  }

  private makeControl(
    c: Control,
    opts: RenderOptions,
    hidden: Set<string>
  ): HTMLElement {
    const el = document.createElement("div");

    el.className = "pbui-ctl";
    el.dataset.name = c.name;
    el.dataset.cls = c.cls;

    el.style.cssText =
      `left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px`;

    if (c.color && c.color[3] !== 1) {
      el.style.opacity = String(c.color[3]);
    }

    if (hidden.has(c.name)) {
      el.hidden = true;
    }

    const tpl = c.template
      ? this.scene.templates[c.template]
      : undefined;

    if (tpl) {
      const skin = buildSkin(tpl, c.w, c.h, this.sheet);

      el.appendChild(skin.el);
      this.skins.set(c.id, skin);

      if (INTERACTIVE.has(c.cls)) {
        el.classList.add("pbui-int");
        this.disposers.push(wireStates(el, skin));
      }
    }

    if (c.caption && opts.captions !== false) {
      const t = opts.texts?.[c.name];

      if (t === undefined && c.caption.text) {
        this.untranslated.push(c.name);
      }

      if (t !== undefined || c.caption.text) {
        applyCaption(el, c.caption, t, c.cls);
      }
    }

    if (!this.byName.has(c.name)) {
      this.byName.set(c.name, el);
    }

    return el;
  }

  get(name: string): HTMLElement | undefined {
    return this.byName.get(name);
  }

  control(name: string): Control | undefined {
    return this.scene.controls.find(c => c.name === name);
  }

  setText(name: string, text: string): void {
    const c = this.control(name);
    const el = this.byName.get(name);

    if (c?.caption && el) {
      applyCaption(el, c.caption, text, c.cls);
    } else if (el) {
      const d = document.createElement("div");
      d.className = "pbui-caption";
      d.textContent = text;
      el.appendChild(d);
    }
  }

  setEnabled(name: string, on: boolean): void {
    const el = this.byName.get(name);
    const c = this.control(name);

    if (!el || !c) return;

    el.classList.toggle("pbui-disabled", !on);
    this.skins.get(c.id)?.setState(on ? 0 : 3);
  }

  bind(
    handlers: Record<
      string,
      (ev: MouseEvent, el: HTMLElement) => void
    >
  ): () => void {
    const offs: (() => void)[] = [];

    for (const [name, fn] of Object.entries(handlers)) {
      const el = this.byName.get(name);

      if (!el) {
        console.warn(
          `[pbui] ${this.scene.name}: no control named ${name}`
        );
        continue;
      }

      const h = (ev: MouseEvent) => {
        if (!el.classList.contains("pbui-disabled")) {
          fn(ev, el);
        }
      };

      el.addEventListener("click", h);
      offs.push(() => el.removeEventListener("click", h));
    }

    this.disposers.push(...offs);

    return () => offs.forEach(f => f());
  }

  missingFrames(): string[] {
    return [
      ...new Set(
        [...this.skins.values()].flatMap(s => s.missing)
      )
    ];
  }

  destroy(): void {
    this.disposers.forEach(f => f());
    this.disposers = [];
    this.root.remove();
  }
}

/* ==========================================
   RESPONSIVE STAGE
========================================== */

const STRETCH_MAX_ASPECT = 16 / 9;
const STRETCH_MIN_ASPECT = 4 / 3;

export class Stage {
  readonly el: HTMLElement;
  readonly design: HTMLElement;

  private ro: ResizeObserver | null = null;

  scale = 1;
  scaleY = 1;

  private readonly handleResize = () => {
    this.fit();
  };

  constructor(
    readonly host: HTMLElement,
    readonly dw = 1024,
    readonly dh = 768,
    readonly stretch: boolean | "px" = false,
    /**
     * Mobile only: force landscape + fullscreen (default ON). `false` disables it,
     * "always" also applies it on desktop (handy for testing). A `?forceLandscape=1`
     * query string does the same.
     */
    readonly forceLandscape: boolean | "always" = true
  ) {
    ensureCss();

    this.el = document.createElement("div");
    this.el.className = "pbui-stage";

    this.design = document.createElement("div");
    this.design.className = "pbui-design";

    this.design.style.width = `${dw}px`;
    this.design.style.height = `${dh}px`;

    this.el.appendChild(this.design);
    this.host.appendChild(this.el);

    this.fit();

    this.ro = new ResizeObserver(this.handleResize);
    this.ro.observe(this.el);

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("orientationchange", this.handleResize);

    if (screen.orientation) {
      screen.orientation.addEventListener(
        "change",
        this.handleResize
      );
    }

    if (forceLandscape) this.setupForce();
  }

  /* ---------- force fullscreen + landscape (mobile only) ---------- */

  private forceAbort: AbortController | null = null;
  private gate: (HTMLElement & {
    showPopover?: () => void;
    hidePopover?: () => void;
  }) | null = null;
  private gateTitle: HTMLElement | null = null;
  private gateSub: HTMLElement | null = null;
  private gateBtn: HTMLButtonElement | null = null;
  private forcing = false;

  /**
   * Mobile / touch-first device only (coarse primary pointer, or a phone / tablet UA with
   * touch). Evaluated on every use, so switching device mode takes effect immediately.
   */
  private get isMobile(): boolean {
    if (
      this.forceLandscape === "always" ||
      /[?&]forceLandscape=1\b/.test(location.search)
    ) {
      return true;
    }

    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const ua = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);

    return coarse || (ua && navigator.maxTouchPoints > 0);
  }

  private get isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  private get isFullscreen(): boolean {
    return !!(
      document.fullscreenElement ||
      (document as unknown as { webkitFullscreenElement?: Element })
        .webkitFullscreenElement
    );
  }

  /** iPhone Safari has no Fullscreen API for pages: then only the rotate notice applies. */
  private get fullscreenSupported(): boolean {
    const d = document as unknown as { webkitFullscreenEnabled?: boolean };

    return !!(document.fullscreenEnabled || d.webkitFullscreenEnabled);
  }

  private setupForce(): void {
    const ac = new AbortController();
    const { signal } = ac;

    this.forceAbort = ac;

    this.buildGate();

    // Browsers only allow fullscreen from a user gesture: any tap enters (and re-enters
    // after the user leaves fullscreen).
    const kick = () => void this.enterFullscreenLandscape();

    for (const type of ["pointerup", "touchend", "click", "keydown"]) {
      document.addEventListener(type, kick, { capture: true, signal });
    }

    // Rotated by the user (or by our lock): try fullscreen right away. It works while the
    // last tap is still "active"; otherwise the gate asks for one tap.
    const turned = () => {
      this.updateGate();
      this.fit();

      if (this.isMobile && !this.isPortrait && !this.isFullscreen) {
        void this.enterFullscreenLandscape();
      }
    };

    const fsChanged = () => {
      void this.lockLandscape();
      this.updateGate();
      this.fit();

      // other top-layer UI (touch controls) re-attaches itself after a fullscreen change:
      // come back on top of it
      window.setTimeout(() => this.reshowGate(), 600);
    };

    window.addEventListener("resize", turned, { signal });
    window.addEventListener("orientationchange", turned, { signal });
    screen.orientation?.addEventListener("change", turned, { signal });
    document.addEventListener("fullscreenchange", fsChanged, { signal });
    document.addEventListener("webkitfullscreenchange", fsChanged, { signal });

    this.updateGate();
    void this.lockLandscape();
  }

  private buildGate(): void {
    const g = document.createElement("div") as NonNullable<Stage["gate"]>;

    g.className = "pbui-rotate";
    g.setAttribute("popover", "manual"); // top layer: above the game and touch controls

    g.innerHTML =
      '<svg class="pbui-ico-turn" viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2"/>' +
      '<path d="M11 18.5h2"/></svg>' +
      '<svg class="pbui-ico-fs" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>' +
      '<div class="pbui-rotate-title"></div>' +
      '<div class="pbui-rotate-sub"></div>' +
      '<button type="button" class="pbui-rotate-btn"></button>';

    this.gateTitle = g.querySelector(".pbui-rotate-title");
    this.gateSub = g.querySelector(".pbui-rotate-sub");
    this.gateBtn = g.querySelector(".pbui-rotate-btn");

    this.gateBtn!.addEventListener("click", () => {
      void this.enterFullscreenLandscape();
    });

    document.body.appendChild(g);
    this.gate = g;
  }

  /** Enter fullscreen (needs a user gesture) and lock landscape. */
  private async enterFullscreenLandscape(): Promise<void> {
    if (this.forcing || !this.isMobile) return;

    this.forcing = true;

    try {
      if (!this.isFullscreen && this.fullscreenSupported) {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        };

        try {
          if (el.requestFullscreen) {
            await el.requestFullscreen({ navigationUI: "hide" });
          } else if (el.webkitRequestFullscreen) {
            await el.webkitRequestFullscreen();
          }
        } catch {
          // refused (no gesture yet): the gate keeps asking for a tap
        }
      }

      await this.lockLandscape();
    } finally {
      this.forcing = false;
      this.updateGate();
    }
  }

  /** Android Chrome / Firefox only accept the lock while the page is fullscreen. */
  private async lockLandscape(): Promise<void> {
    if (!this.isMobile) return;

    const o = screen.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;

    if (!o?.lock) return;

    try {
      await o.lock("landscape");
    } catch {
      // not fullscreen yet / unsupported
    }
  }

  /**
   * Portrait            -> "Please rotate your device" + [Landscape mode]
   * Landscape, windowed -> "Tap to continue"           + [Enter fullscreen]
   * Landscape, fullscreen (or not a mobile device) -> hidden
   */
  private updateGate(): void {
    const g = this.gate;

    if (!g) return;

    let mode: "portrait" | "fullscreen" | null = null;

    if (this.isMobile) {
      if (this.isPortrait) mode = "portrait";
      else if (this.fullscreenSupported && !this.isFullscreen) mode = "fullscreen";
    }

    if (!mode) {
      this.setGateShown(false);
      return;
    }

    g.dataset.mode = mode;

    if (mode === "portrait") {
      this.gateTitle!.textContent = "Please rotate your device";
      this.gateSub!.textContent =
        "This game is played in landscape mode. If the screen does not rotate, " +
        "turn off rotation lock and turn your phone sideways.";
      this.gateBtn!.textContent = "LANDSCAPE MODE";
    } else {
      this.gateTitle!.textContent = "Tap to continue";
      this.gateSub!.textContent = "The game runs in fullscreen.";
      this.gateBtn!.textContent = "ENTER FULLSCREEN";
    }

    this.setGateShown(true);
  }

  private setGateShown(on: boolean): void {
    const g = this.gate;

    if (!g) return;

    g.classList.toggle("pbui-show", on);

    try {
      const open = g.matches(":popover-open");

      if (on && !open) g.showPopover?.();
      else if (!on && open) g.hidePopover?.();
    } catch {
      // no Popover API: the fixed-position overlay is enough
    }
  }

  /** Move the gate back to the top of the top layer. */
  private reshowGate(): void {
    const g = this.gate;

    if (!g || !g.classList.contains("pbui-show")) return;

    try {
      if (g.matches(":popover-open")) g.hidePopover?.();
      g.showPopover?.();
    } catch {
      // ignore
    }
  }

  private teardownForce(): void {
    this.forceAbort?.abort();
    this.forceAbort = null;

    this.gate?.remove();
    this.gate = null;

    try {
      screen.orientation?.unlock?.();
    } catch {
      // ignore
    }
  }

  fit(): void {
    const W =
      this.el.clientWidth || window.innerWidth;

    const H =
      this.el.clientHeight || window.innerHeight;

    // Original pixel mode.
    if (this.stretch === "px") {
      this.scale = 1;
      this.scaleY = 1;
      this.design.style.transform = "none";
      return;
    }

    // Original stretch mode.
    if (this.stretch) {
      const ww = Math.min(
        W,
        H * STRETCH_MAX_ASPECT
      );

      const hh = Math.min(
        H,
        W / STRETCH_MIN_ASPECT
      );

      this.scale = ww / this.dw;
      this.scaleY = hh / this.dh;

      const ox = (W - ww) / 2;
      const oy = (H - hh) / 2;

      this.design.style.transform =
        `translate(${ox}px,${oy}px) ` +
        `scale(${this.scale},${this.scaleY})`;

      return;
    }

    // Maintain original aspect ratio in both portrait and landscape.
    const scaleX = W / this.dw;
    const scaleY = H / this.dh;

    this.scale = Math.min(scaleX, scaleY);
    this.scaleY = this.scale;

    const scaledW = this.dw * this.scale;
    const scaledH = this.dh * this.scale;

    const ox = (W - scaledW) / 2;
    const oy = (H - scaledH) / 2;

    this.design.style.transform =
      `translate(${ox}px,${oy}px) scale(${this.scale})`;
  }

  /**
   * Window coordinates -> original design coordinates.
   */
  toDesign(
    clientX: number,
    clientY: number
  ): { x: number; y: number } {
    const r = this.design.getBoundingClientRect();

    return {
      x: (clientX - r.left) / this.scale,
      y: (clientY - r.top) /
        (this.stretch ? this.scaleY : this.scale)
    };
  }

  /**
   * Touch coordinates -> original design coordinates.
   */
  toDesignTouch(
    ev: TouchEvent
  ): { x: number; y: number } {
    const touch =
      ev.touches[0] ?? ev.changedTouches[0];

    if (!touch) {
      return { x: 0, y: 0 };
    }

    return this.toDesign(
      touch.clientX,
      touch.clientY
    );
  }

  destroy(): void {
    this.ro?.disconnect();

    window.removeEventListener(
      "resize",
      this.handleResize
    );

    window.removeEventListener(
      "orientationchange",
      this.handleResize
    );

    screen.orientation?.removeEventListener(
      "change",
      this.handleResize
    );

    this.teardownForce();

    this.el.remove();
  }
}