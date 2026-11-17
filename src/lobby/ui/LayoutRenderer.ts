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
    readonly stretch: boolean | "px" = false
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

    this.el.remove();
  }
}