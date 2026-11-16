// 2D overlay on its own canvas (independent of the game HUD):
//  - ESP: box, snapline, "nick [distance]" and HP bar for every other living actor (through walls)
//  - RADAR: a round radar (top-right) with every living actor around you, rotated to your view
import * as THREE from "three";
import type { GmCheatState } from "./gmCheats.ts";

export interface EspActor { name: string; team: number; hp: number; maxHp: number; feet(out: THREE.Vector3): THREE.Vector3; eye(out: THREE.Vector3): THREE.Vector3 }

const RADAR_R = 80, RADAR_RANGE = 60; // px, metres

export class GmEsp {
  private cv = document.createElement("canvas");
  private ctx = this.cv.getContext("2d")!;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private f = new THREE.Vector3();
  private onResize = () => this.fit();

  constructor() {
    this.cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:45;";
    document.body.appendChild(this.cv);
    window.addEventListener("resize", this.onResize);
    this.fit();
  }

  private fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.round(window.innerWidth * dpr); this.cv.height = Math.round(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear(): void { this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }

  update(cam: THREE.Camera, myTeam: number, myPos: THREE.Vector3, actors: EspActor[], o: GmCheatState): void {
    const W = window.innerWidth, H = window.innerHeight, c = this.ctx;
    c.clearRect(0, 0, W, H);
    cam.updateMatrixWorld();
    if (o.esp) this.drawEsp(cam, myTeam, myPos, actors, o, W, H);
    if (o.radar) this.drawRadar(cam, myTeam, myPos, actors, W);
  }

  private drawRadar(cam: THREE.Camera, myTeam: number, myPos: THREE.Vector3, actors: EspActor[], W: number): void {
    const c = this.ctx, cx = W - RADAR_R - 16, cy = RADAR_R + 16;
    cam.getWorldDirection(this.f);
    const fl = Math.hypot(this.f.x, this.f.z) || 1, fx = this.f.x / fl, fz = this.f.z / fl; // view direction on the ground
    const rx = -fz, rz = fx; // its right-hand side
    c.save();
    c.beginPath(); c.arc(cx, cy, RADAR_R, 0, Math.PI * 2); c.fillStyle = "rgba(8,12,18,.6)"; c.fill();
    c.strokeStyle = "rgba(255,140,0,.7)"; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = "rgba(255,255,255,.15)"; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, RADAR_R / 2, 0, Math.PI * 2); c.moveTo(cx - RADAR_R, cy); c.lineTo(cx + RADAR_R, cy); c.moveTo(cx, cy - RADAR_R); c.lineTo(cx, cy + RADAR_R); c.stroke();
    c.beginPath(); c.arc(cx, cy, RADAR_R - 1, 0, Math.PI * 2); c.clip();
    for (const a of actors) {
      const p = a.feet(this.a), dx = p.x - myPos.x, dz = p.z - myPos.z;
      let sx = (dx * rx + dz * rz) / RADAR_RANGE * RADAR_R, sy = -(dx * fx + dz * fz) / RADAR_RANGE * RADAR_R;
      const l = Math.hypot(sx, sy);
      if (l > RADAR_R - 4) { sx *= (RADAR_R - 4) / l; sy *= (RADAR_R - 4) / l; } // off-range: pinned to the rim
      c.fillStyle = a.team !== myTeam ? "#ff4d4d" : "#4da6ff";
      c.beginPath(); c.arc(cx + sx, cy + sy, 3.5, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = "#fff"; c.beginPath(); c.moveTo(cx, cy - 6); c.lineTo(cx + 4, cy + 4); c.lineTo(cx - 4, cy + 4); c.closePath(); c.fill(); // you
    c.restore();
  }

  private drawEsp(cam: THREE.Camera, myTeam: number, myPos: THREE.Vector3, actors: EspActor[], o: GmCheatState, W: number, H: number): void {
    const c = this.ctx;
    c.font = "bold 12px Rajdhani, sans-serif"; c.textAlign = "center"; c.lineWidth = 1.5;
    for (const a of actors) {
      const feet = a.feet(this.a), head = a.eye(this.b);
      head.y += 0.2;
      const dist = feet.distanceTo(myPos);
      const f = feet.clone().project(cam), h = head.clone().project(cam);
      if (f.z > 1 || h.z > 1) continue;
      const fx = (f.x * 0.5 + 0.5) * W, fy = (-f.y * 0.5 + 0.5) * H, hy = (-h.y * 0.5 + 0.5) * H;
      const bh = Math.max(4, fy - hy), bw = bh * 0.45, x = fx - bw / 2;
      const col = a.team !== myTeam ? "#ff4d4d" : "#4da6ff";
      c.strokeStyle = col; c.fillStyle = col;
      if (o.espSnap) { c.beginPath(); c.moveTo(W / 2, H); c.lineTo(fx, fy); c.globalAlpha = 0.55; c.stroke(); c.globalAlpha = 1; }
      if (o.espBox) c.strokeRect(x, hy, bw, bh);
      if (o.espName) {
        c.fillStyle = "#fff"; c.strokeStyle = "#000"; c.lineWidth = 3;
        const t = `${a.name} [${Math.round(dist)}m]`;
        c.strokeText(t, fx, hy - 4); c.fillText(t, fx, hy - 4); c.lineWidth = 1.5;
      }
      if (o.espHp) {
        const p = Math.max(0, Math.min(1, a.hp / Math.max(1, a.maxHp)));
        c.fillStyle = "rgba(0,0,0,.65)"; c.fillRect(x - 6, hy, 4, bh);
        c.fillStyle = `hsl(${p * 120},90%,50%)`; c.fillRect(x - 5, hy + bh * (1 - p), 2, bh * p);
        c.fillStyle = "#fff"; c.textAlign = "right"; c.fillText(String(Math.round(a.hp)), x - 8, hy + 10); c.textAlign = "center";
      }
    }
  }

  dispose(): void { window.removeEventListener("resize", this.onResize); this.cv.remove(); }
}