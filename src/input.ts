export class Input {
  keys = new Set<string>();
  mouseX = 240;
  mouseY = 135;
  mouseDown = false;
  rightDown = false;
  /** 触屏虚拟摇杆向量（-1..1） */
  stickX = 0;
  stickY = 0;
  /** 是否处于触屏模式 */
  touchMode = false;
  /** 触屏自动索敌：非 null 时角色朝向由它决定（最近敌人方向） */
  aimOverride: number | null = null;

  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (this.touchMode) {
      x = this.stickX;
      y = this.stickY;
    }
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
