import Phaser from 'phaser';

export interface MobileControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  shoot: boolean;
}

type ControlKey = keyof MobileControlState;

interface TrackedButton {
  button: Phaser.GameObjects.Text;
  key: ControlKey;
  pointerId: number | null;
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
    crouch: false,
    shoot: false,
  };

  private readonly scene: Phaser.Scene;
  private readonly buttons: TrackedButton[] = [];
  private readonly orientationOverlay: HTMLDivElement;
  private readonly fullscreenButton: HTMLButtonElement;
  private readonly resizeHandler: () => void;
  private readonly orientationHandler: () => void;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.orientationOverlay = this.createOrientationOverlay();
    this.fullscreenButton = this.createFullscreenButton();
    this.resizeHandler = () => this.positionButtons();
    this.orientationHandler = () => this.updateOrientationOverlay();

    this.addButton('◀', 'left');
    this.addButton('▶', 'right');
    this.addButton('▲', 'jump');
    this.addButton('▼', 'crouch');
    this.addButton('●', 'shoot');
    this.positionButtons();
    this.updateOrientationOverlay();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    scene.input.on('pointerup', this.releasePointer, this);
    scene.input.on('pointercancel', this.releasePointer, this);
    window.addEventListener('blur', this.releaseAllButtons);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('resize', this.orientationHandler, { passive: true });
    window.addEventListener('orientationchange', this.orientationHandler, { passive: true });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  public containsPointer(pointer: Phaser.Input.Pointer): boolean {
    return this.buttons.some(({ button }) => button.getBounds().contains(pointer.x, pointer.y));
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
      .setInteractive({ useHandCursor: false });

    const tracked: TrackedButton = { button, key, pointerId: null };
    this.buttons.push(tracked);
    button.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Event) => {
      event.stopPropagation();
      if (tracked.pointerId !== null) return;
      tracked.pointerId = pointer.id;
      this.state[key] = true;
      button.setStyle({ backgroundColor: '#8f2424cc' });
    });

    const release = (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event?: Event): void => {
      event?.stopPropagation();
      if (tracked.pointerId !== pointer.id) return;
      tracked.pointerId = null;
      this.state[key] = false;
      button.setStyle({ backgroundColor: '#222222cc' });
    };
    button.on('pointerup', release);
    button.on('pointercancel', release);
  }

  private positionButtons(): void {
    const { width, height } = this.scene.scale;
    const sideInset = Math.max(90, Math.min(140, width * 0.1));
    const bottom = height - 80;
    const verticalGap = 116;
    this.buttons.find((entry) => entry.key === 'left')?.button.setPosition(sideInset, bottom);
    this.buttons.find((entry) => entry.key === 'right')?.button.setPosition(sideInset + 155, bottom);
    this.buttons.find((entry) => entry.key === 'jump')?.button.setPosition(width - sideInset - 155, bottom);
    this.buttons.find((entry) => entry.key === 'crouch')?.button.setPosition(width - sideInset, bottom);
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

  private releasePointer(pointer: Phaser.Input.Pointer): void {
    this.buttons.forEach((tracked) => {
      if (tracked.pointerId !== pointer.id) return;
      tracked.pointerId = null;
      this.state[tracked.key] = false;
      tracked.button.setStyle({ backgroundColor: '#222222cc' });
    });
  }

  private releaseAllButtons(): void {
    this.buttons.forEach((tracked) => {
      tracked.pointerId = null;
      this.state[tracked.key] = false;
      tracked.button.setStyle({ backgroundColor: '#222222cc' });
    });
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.releaseAllButtons();
  };

  private destroy(): void {
    this.releaseAllButtons();
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.scene.input.off('pointerup', this.releasePointer, this);
    this.scene.input.off('pointercancel', this.releasePointer, this);
    window.removeEventListener('blur', this.releaseAllButtons);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('resize', this.orientationHandler);
    window.removeEventListener('orientationchange', this.orientationHandler);
    this.orientationOverlay.remove();
    this.fullscreenButton.remove();
    this.buttons.forEach(({ button }) => button.destroy());
  }
}
