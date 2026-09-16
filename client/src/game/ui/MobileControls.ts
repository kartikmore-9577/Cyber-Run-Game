import Phaser from 'phaser';

export interface MobileControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
  shoot: boolean;
}

type ControlKey = keyof MobileControlState;

interface TrackedButton {
  button: Phaser.GameObjects.Text;
  key: ControlKey;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export class MobileControls {
  public readonly state: MobileControlState = {
    left: false,
    right: false,
    jump: false,
    shoot: false,
  };

  private readonly scene: Phaser.Scene;
  private readonly buttons: TrackedButton[] = [];
  private readonly touchControls = new Map<number, ControlKey>();
  private readonly orientationOverlay: HTMLDivElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly debugOverlay: HTMLDivElement;
  private readonly resizeHandler: () => void;
  private readonly orientationHandler: () => void;
  private readonly touchTarget: HTMLCanvasElement;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.orientationOverlay = this.createOrientationOverlay();
    this.fullscreenButton = this.createFullscreenButton();
    this.debugOverlay = this.createDebugOverlay();
    this.touchTarget = scene.game.canvas;
    this.resizeHandler = () => this.positionButtons();
    this.orientationHandler = () => this.updateOrientationOverlay();

    this.addButton('◀', 'left');
    this.addButton('▶', 'right');
    this.addButton('▲', 'jump');
    this.addButton('●', 'shoot');
    this.positionButtons();
    this.updateOrientationOverlay();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    window.addEventListener('blur', this.releaseAllButtons);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.touchTarget.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.touchTarget.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.touchTarget.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.touchTarget.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
    window.addEventListener('resize', this.orientationHandler, { passive: true });
    window.addEventListener('orientationchange', this.orientationHandler, { passive: true });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateDebugOverlay, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private addButton(label: string, key: ControlKey): void {
    const button = this.scene.add.text(0, 0, label, {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '34px',
      backgroundColor: '#222222cc',
      align: 'center',
    })
      .setOrigin(0.5)
      .setFixedSize(140, 108)
      .setScrollFactor(0)
      .setDepth(20)
      .disableInteractive();

    const tracked: TrackedButton = { button, key };
    this.buttons.push(tracked);
  }

  private positionButtons(): void {
    const { width, height } = this.scene.scale;
    const sideInset = Math.max(90, Math.min(140, width * 0.1));
    const bottom = height - 80;
    const verticalGap = 116;
    this.buttons.find((entry) => entry.key === 'left')?.button.setPosition(sideInset, bottom);
    this.buttons.find((entry) => entry.key === 'right')?.button.setPosition(sideInset + 155, bottom);
    this.buttons.find((entry) => entry.key === 'jump')?.button.setPosition(width - sideInset, bottom);
    this.buttons.find((entry) => entry.key === 'shoot')?.button.setPosition(width - sideInset, bottom - verticalGap);
  }

  private createOrientationOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'orientation-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<strong>PLEASE ROTATE YOUR PHONE</strong><span>Rotate your device to landscape mode to play Cyber Run.</span>';
    document.body.appendChild(overlay);
    return overlay;
  }

  private createDebugOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'touch-debug-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    return overlay;
  }

  private createFullscreenButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'fullscreen-button';
    button.type = 'button';
    button.textContent = '⛶';
    button.setAttribute('aria-label', 'Toggle fullscreen');
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', () => {
      void this.toggleFullscreen();
    });
    document.body.appendChild(button);
    return button;
  }

  private updateOrientationOverlay(): void {
    const isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    const showOverlay = isTouchDevice && isPortrait;
    this.orientationOverlay.classList.toggle('is-visible', showOverlay);
    this.orientationOverlay.setAttribute('aria-hidden', String(!showOverlay));
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      const fullscreenDocument = document as FullscreenDocument;
      const activeFullscreen = document.fullscreenElement || fullscreenDocument.webkitFullscreenElement;
      if (activeFullscreen) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else fullscreenDocument.webkitExitFullscreen?.();
        return;
      }

      const container = document.getElementById('game-container') as FullscreenElement | null;
      if (!container) return;
      if (container.requestFullscreen) await container.requestFullscreen();
      else if (container.webkitRequestFullscreen) await container.webkitRequestFullscreen();
      else return;

      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: 'landscape') => Promise<void>;
      };
      await orientation.lock?.('landscape');
    } catch {
      // Orientation locking is optional and restricted by some browsers.
    }
  }

  private releaseTouch(touchId: number): void {
    const key = this.touchControls.get(touchId);
    if (!key) return;
    this.touchControls.delete(touchId);
    const tracked = this.buttons.find((entry) => entry.key === key);
    if (!tracked) return;
    this.state[key] = false;
    tracked.button.setStyle({ backgroundColor: '#222222cc' });
  }

  private releaseAllButtons(): void {
    this.touchControls.clear();
    this.buttons.forEach((tracked) => {
      this.state[tracked.key] = false;
      tracked.button.setStyle({ backgroundColor: '#222222cc' });
    });
  }

  private getControlAtTouch(touch: Touch): ControlKey | null {
    const rect = this.touchTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = (touch.clientX - rect.left) * this.scene.scale.width / rect.width;
    const y = (touch.clientY - rect.top) * this.scene.scale.height / rect.height;
    return this.buttons.find((entry) => entry.button.getBounds().contains(x, y))?.key ?? null;
  }

  private handleTouchStart = (event: TouchEvent): void => {
    event.preventDefault();
    Array.from(event.changedTouches).forEach((touch) => {
      if (this.touchControls.has(touch.identifier)) return;
      const key = this.getControlAtTouch(touch);
      if (!key || Array.from(this.touchControls.values()).includes(key)) return;
      this.touchControls.set(touch.identifier, key);
      this.state[key] = true;
      this.buttons.find((entry) => entry.key === key)?.button.setStyle({ backgroundColor: '#8f2424cc' });
    });
  };

  private handleTouchMove = (event: TouchEvent): void => {
    event.preventDefault();
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    event.preventDefault();
    Array.from(event.changedTouches).forEach((touch) => this.releaseTouch(touch.identifier));
  };

  private updateDebugOverlay(): void {
    const mappings = Array.from(this.touchControls.entries())
      .map(([touchId, key]) => `Touch ${touchId} → ${key.toUpperCase()}`)
      .join('<br>');
    this.debugOverlay.innerHTML = `ACTIVE TOUCHES: ${this.touchControls.size}<br>${mappings || 'No button touches'}`;
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.releaseAllButtons();
  };

  private destroy(): void {
    this.releaseAllButtons();
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateDebugOverlay, this);
    this.touchTarget.removeEventListener('touchstart', this.handleTouchStart);
    this.touchTarget.removeEventListener('touchmove', this.handleTouchMove);
    this.touchTarget.removeEventListener('touchend', this.handleTouchEnd);
    this.touchTarget.removeEventListener('touchcancel', this.handleTouchEnd);
    window.removeEventListener('blur', this.releaseAllButtons);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('resize', this.orientationHandler);
    window.removeEventListener('orientationchange', this.orientationHandler);
    this.orientationOverlay.remove();
    this.fullscreenButton.remove();
    this.debugOverlay.remove();
    this.buttons.forEach(({ button }) => button.destroy());
  }
}
