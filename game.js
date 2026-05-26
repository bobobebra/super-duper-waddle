// game.js - Core 2D Game Engine & Dev Menu Control Bindings
(function () {
  // 1. Setup Canvas and Display System
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const V_WIDTH = 1280;
  const V_HEIGHT = 720;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // 2. Game Variables & Level State Definitions
  let hue = 0;
  const searchParams = new URLSearchParams(window.location.search);
  const currentLevelId = parseInt(searchParams.get('level') || '1', 10);

  // Generate unique, reproducible procedural layouts per level ID
  function generateLevelObstacles(levelId) {
    const obstacles = [];
    let currentX = 600;
    const spacing = 300 + (levelId * 15) % 200;
    
    for (let i = 0; i < 40; i++) {
      const typeNum = (Math.sin(i + levelId) * 1000) % 3;
      let type = 'spike';
      if (typeNum > 1) type = 'block';
      if (typeNum > 1.8) type = 'portal';

      obstacles.push({
        x: currentX,
        y: type === 'block' ? 440 : 490,
        w: type === 'block' ? 60 : 50,
        h: type === 'block' ? 60 : 50,
        type: type,
        passed: false
      });
      currentX += spacing + (i % 3) * 60;
    }
    
    // Level end portal
    obstacles.push({
      x: currentX + 400,
      y: 400,
      w: 80,
      h: 140,
      type: 'end_portal',
      passed: false
    });
    return obstacles;
  }

  // 3. Engine Object Architecture Match for Dev Menu Interoperability
  class GameScene {
    constructor() {
      this._audio = window.GD_AudioSystem;
      this._levelWon = false;
      this._endPortalGameY = 240;
      this._level = { _endPortalGameY: 240 };
      
      this._state = {
        gravityFlipped: false,
        isFlying: false
      };

      this._cameraX = 0;
      this._groundY = 540;

      this._player = {
        x: 200,
        y: 490,
        w: 50,
        h: 50,
        vx: 7,
        vy: 0,
        rotation: 0,
        onGround: true,
        
        _applyGravityPortal: (flip) => {
          this._state.gravityFlipped = flip;
        },
        enterShipMode: () => {
          this._state.isFlying = true;
          this._player.h = 40;
        },
        exitShipMode: () => {
          this._state.isFlying = false;
          this._player.h = 50;
        }
      };

      this._obstacles = generateLevelObstacles(currentLevelId);
      this._inputActive = false;
      this.initControls();
    }

    initControls() {
      const triggerJump = () => { this._inputActive = true; };
      const releaseJump = () => { this._inputActive = false; };

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') triggerJump();
        // Manual Gravity Flip Hotkey Mode
        if (e.code === 'KeyG' && window.gKeyEnabled) {
          this._state.gravityFlipped = !this._state.gravityFlipped;
        }
      });
      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp') releaseJump();
      });
      window.addEventListener('touchstart', triggerJump);
      window.addEventListener('touchend', releaseJump);
      window.addEventListener('mousedown', triggerJump);
      window.addEventListener('mouseup', releaseJump);
    }

    _triggerEndPortal() {
      this._levelWon = true;
      setTimeout(() => {
        alert("Level Completed! Returning to menu.");
        this._restartLevel();
      }, 2000);
    }

    _restartLevel() {
      this._levelWon = false;
      this._cameraX = 0;
      this._player.x = 200;
      this._player.y = 490;
      this._player.vy = 0;
      this._player.rotation = 0;
      this._state.gravityFlipped = false;
      this._state.isFlying = false;
      this._player.h = 50;
      this._obstacles = generateLevelObstacles(currentLevelId);
    }

    update() {
      // Pull dynamic run-time configs safely managed by UI
      const effectiveSpeed = (window.gameSpeed !== undefined) ? window.gameSpeed : 1.0;
      const jumpMult = (window.jumpMultiplier !== undefined) ? window.jumpMultiplier : 1.0;
      const gravMult = (window.gravityMultiplier !== undefined) ? window.gravityMultiplier : 1.0;

      if (this._levelWon) {
        this._player.x += this._player.vx * effectiveSpeed * 0.5;
        this._cameraX = this._player.x - 200;
        return;
      }

      // Progression movement
      this._player.x += this._player.vx * effectiveSpeed;
      this._cameraX = this._player.x - 200;

      // Gravity Calculation Logic
      let gravityBase = 1.4 * gravMult;
      let gravity = this._state.gravityFlipped ? -gravityBase : gravityBase;

      if (this._state.isFlying) {
        // Ship Mode mechanics
        if (this._inputActive) {
          this._player.vy += this._state.gravityFlipped ? 0.9 : -0.9;
        } else {
          this._player.vy += this._state.gravityFlipped ? -0.5 : 0.5;
        }
        // Speed dampening terminal velocity
        this._player.vy = Math.max(-8, Math.min(8, this._player.vy));
        this._player.y += this._player.vy * effectiveSpeed;
        this._player.rotation = this._player.vy * 0.05;
      } else {
        // Classic Cube Mode mechanics
        this._player.vy += gravity * effectiveSpeed;
        this._player.y += this._player.vy * effectiveSpeed;

        // Ground Snapping check
        if (!this._state.gravityFlipped) {
          if (this._player.y + this._player.h >= this._groundY) {
            this._player.y = this._groundY - this._player.h;
            this._player.vy = 0;
            this._player.onGround = true;
          } else {
            this._player.onGround = false;
          }
        } else {
          // Ceiling / Inverted ground check
          if (this._player.y <= 100) {
            this._player.y = 100;
            this._player.vy = 0;
            this._player.onGround = true;
          } else {
            this._player.onGround = false;
          }
        }

        // Jump processing
        if (this._inputActive && this._player.onGround) {
          const jumpImpulse = 21 * jumpMult;
          this._player.vy = this._state.gravityFlipped ? jumpImpulse : -jumpImpulse;
          this._player.onGround = false;
        }

        if (!this._player.onGround) {
          this._player.rotation += (this._state.gravityFlipped ? -0.08 : 0.08) * effectiveSpeed;
        } else {
          // Snap rotation alignment on ground
          this._player.rotation = Math.round(this._player.rotation / (Math.PI / 2)) * (Math.PI / 2);
        }
      }

      // Collisions & Hazards Engine Loop
      for (let obs of this._obstacles) {
        // Simple AABB Box Collision Check
        if (
          this._player.x < obs.x + obs.w &&
          this._player.x + this._player.w > obs.x &&
          this._player.y < obs.y + obs.h &&
          this._player.y + this._player.w > obs.y
        ) {
          if (obs.type === 'end_portal') {
            this._triggerEndPortal();
            break;
          } else if (obs.type === 'portal') {
            this._state.isFlying = !this._state.isFlying;
            obs.y = -9999; // Consume portal element
          } else {
            // Noclip protection mechanics
            if (window.noclipEnabled) {
              if (obs.type === 'block') {
                if (!this._state.gravityFlipped && this._player.vy > 0 && this._player.y + this._player.h - this._player.vy <= obs.y + 12) {
                  this._player.y = obs.y - this._player.h;
                  this._player.vy = 0;
                  this._player.onGround = true;
                } else if (this._state.gravityFlipped && this._player.vy < 0 && this._player.y - this._player.vy >= obs.y + obs.h - 12) {
                  this._player.y = obs.y + obs.h;
                  this._player.vy = 0;
                  this._player.onGround = true;
                }
              }
            } else {
              // Direct impact fatality
              this._restartLevel();
            }
          }
        }
      }

      // Fail-safe boundary rules (preventing falling through bottom or flying past top)
      if (this._player.y + this._player.h > this._groundY) {
        this._player.y = this._groundY - this._player.h;
      }
      if (this._player.y < 50) {
        this._player.y = 50;
      }
    }

    render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Coordinate scaling Matrix transform setup
      ctx.save();
      const scale = Math.min(canvas.width / V_WIDTH, canvas.height / V_HEIGHT);
      const offsetX = (canvas.width - V_WIDTH * scale) / 2;
      const offsetY = (canvas.height - V_HEIGHT * scale) / 2;
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      // Draw Parallax Ambient Backdrop
      const grad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
      grad.addColorStop(0, '#0a0f24');
      grad.addColorStop(1, '#182747');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      // Camera Offset Applied Section
      ctx.save();
      ctx.translate(-this._cameraX, 0);

      // Draw Level Ground Framework
      ctx.fillStyle = '#0d1b3a';
      ctx.fillRect(-1000, this._groundY, this._cameraX + V_WIDTH + 2000, V_HEIGHT - this._groundY);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-1000, this._groundY);
      ctx.lineTo(this._cameraX + V_WIDTH + 2000, this._groundY);
      ctx.stroke();

      // Render Level Elements
      for (let obs of this._obstacles) {
        if (obs.type === 'spike') {
          ctx.fillStyle = '#ff3366';
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y + obs.h);
          ctx.lineTo(obs.x + obs.w / 2, obs.y);
          ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
          ctx.closePath();
          ctx.fill();
        } else if (obs.type === 'block') {
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 2;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.type === 'portal' || obs.type === 'end_portal') {
          ctx.fillStyle = obs.type === 'portal' ? '#10b981' : '#a855f7';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        }

        // Hitbox visualizer injection feature
        if (window.showHitboxesEnabled) {
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        }
      }

      // Draw Game Character Sprite Object
      ctx.save();
      ctx.translate(this._player.x + this._player.w / 2, this._player.y + this._player.h / 2);
      ctx.rotate(this._player.rotation);

      // Rainbow Dynamic Mod Tint calculations
      if (window.rainbowTintEnabled) {
        hue = (hue + 2) % 360;
        ctx.fillStyle = `hsl(${hue}, 95%, 60%)`;
      } else {
        ctx.fillStyle = '#00ffff';
      }

      ctx.fillRect(-this._player.w / 2, -this._player.h / 2, this._player.w, this._player.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(-this._player.w / 2, -this._player.h / 2, this._player.w, this._player.h);

      // Inner icon visual detailing
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12, -12, 8, 8);
      ctx.fillRect(4, -12, 8, 8);
      ctx.fillRect(-12, 4, 24, 4);

      ctx.restore();

      // Show Player Hitbox Overlay
      if (window.showHitboxesEnabled) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(this._player.x, this._player.y, this._player.w, this._player.h);
      }

      ctx.restore();
      ctx.restore();
    }
  }

  // Instantiate and run context engine
  const scene = new GameScene();
  window.activeGameScene = scene;

  function mainLoop() {
    scene.update();
    scene.render();
    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);
})();