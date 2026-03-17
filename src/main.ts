import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Project } from './data/projects';
import { projects } from './data/projects';
import { Text } from 'troika-three-text';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';
import { CSSPlugin } from 'gsap/CSSPlugin';

gsap.registerPlugin(ScrollTrigger, CSSPlugin);

class ProjectCard {
  public mesh: THREE.Group;
  private texture: THREE.Texture;
  private material: THREE.MeshBasicMaterial;
  private titleText: any;

  constructor(project: Project, scene: THREE.Scene) {
    this.mesh = new THREE.Group();
    
    // Card Plane
    const geometry = new THREE.PlaneGeometry(3, 1.8);
    const loader = new THREE.TextureLoader();
    this.texture = loader.load(`/thumbnails/${project.slug}.png`);
    this.material = new THREE.MeshBasicMaterial({ 
      map: this.texture,
      transparent: true,
      opacity: 0,
    });
    
    const cardMesh = new THREE.Mesh(geometry, this.material);
    this.mesh.add(cardMesh);

    // Title on Card
    this.titleText = new Text();
    this.titleText.text = project.title;
    this.titleText.fontSize = 0.15;
    this.titleText.color = 0xffffff;
    this.titleText.font = '/fonts/Standard.ttf';
    this.titleText.position.set(-1.3, -0.7, 0.01);
    this.titleText.fillOpacity = 0;
    this.mesh.add(this.titleText);
    this.titleText.sync();

    scene.add(this.mesh);
  }

  public update(position: THREE.Vector3, lookAt: THREE.Vector3, opacity: number) {
    this.mesh.position.copy(position);
    this.mesh.lookAt(lookAt);
    this.material.opacity = opacity;
    this.titleText.fillOpacity = opacity;
  }
}

class App {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private particles!: THREE.Points;
  private immersiveText!: any;
  private clock: THREE.Clock;
  private isDisposed = false;
  private mouseX = 0;
  private mouseY = 0;
  private projectCards: ProjectCard[] = [];
  private vortexPath!: THREE.CatmullRomCurve3;
  private scrollProgress = 0;
  private logoMesh!: THREE.Mesh;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private selectedProject: Project | null = null;
  private virtualScroll = 0;
  private targetVirtualScroll = 0;
  private readonly scrollSensitivity = 0.001;
  private readonly scrollLerp = 0.05;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.init();
    this.createParticles();
    this.createImmersiveText();
    this.createVortexPath();
    this.createLogo();
    this.createProjectCards();
    this.setupEvents();
    this.render();
    this.initAnimations();
    this.initCustomCursor();
  }

  private init() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    document.body.appendChild(this.renderer.domElement);
    
    this.camera.position.z = 5;

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, // strength
      0.4, // radius
      0.85 // threshold
    );
    this.composer.addPass(bloomPass);
  }

  private createParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 15;
      positions[i + 1] = (Math.random() - 0.5) * 15;
      positions[i + 2] = (Math.random() - 0.5) * 15;

      colors[i] = Math.random();
      colors[i + 1] = Math.random();
      colors[i + 2] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  private createImmersiveText() {
    this.immersiveText = new Text();
    
    // Set properties
    this.immersiveText.text = 'What are you looking for?';
    this.immersiveText.fontSize = 0.5; // High end, smaller look
    this.immersiveText.color = 0xffffff;
    this.immersiveText.anchorX = 'center';
    this.immersiveText.anchorY = 'middle';
    this.immersiveText.position.set(0, 0, 1); // Move forward to be visible
    this.immersiveText.outlineWidth = 0.01;
    this.immersiveText.outlineColor = 0x000000;
    this.immersiveText.fillOpacity = 0;
    
    // Use a standard font source that is more likely to load
    // Use a reliable local font source
    this.immersiveText.font = '/fonts/Standard.ttf';
    
    this.scene.add(this.immersiveText);
    this.immersiveText.sync();

    // Fade in animation
    gsap.to(this.immersiveText, {
      fillOpacity: 0.6,
      duration: 4,
      delay: 2,
      ease: 'power2.inOut'
    });

    // Floating parallax
    gsap.to(this.immersiveText.position, {
      y: 0.1,
      duration: 3,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  }

  private createVortexPath() {
    this.vortexPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 10),
      new THREE.Vector3(5, 2, 5),
      new THREE.Vector3(2, -2, 0),
      new THREE.Vector3(-3, 1, -5),
      new THREE.Vector3(0, 0, -10),
    ]);
  }

  private createLogo() {
    const geometry = new THREE.PlaneGeometry(2, 2);
    const loader = new THREE.TextureLoader();
    const texture = loader.load('/logo.png');
    const material = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      opacity: 0
    });
    this.logoMesh = new THREE.Mesh(geometry, material);
    this.logoMesh.position.set(0, 0, 2);
    this.scene.add(this.logoMesh);

    gsap.to(this.logoMesh.material, {
      opacity: 1,
      duration: 3,
      delay: 1,
      ease: 'power2.inOut'
    });
  }

  private createProjectCards() {
    projects.forEach((project) => {
      const card = new ProjectCard(project, this.scene);
      this.projectCards.push(card);
    });
  }
  private setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth) - 0.5;
      this.mouseY = (e.clientY / window.innerHeight) - 0.5;
      
      gsap.to('#cursor', {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: 'power2.out'
      });
      
      gsap.to('#cursor-follower', {
        x: e.clientX,
        y: e.clientY,
        duration: 0.3,
        ease: 'power2.out'
      });

      // Update raycaster mouse coords
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.checkHover();
    });

    window.addEventListener('click', () => {
      this.checkIntersection();
    });

    // Virtual Scroll (Wheel)
    window.addEventListener('wheel', (e) => {
      if (this.selectedProject) return;
      this.targetVirtualScroll += e.deltaY * this.scrollSensitivity;
      this.targetVirtualScroll = Math.max(0, Math.min(this.targetVirtualScroll, 1));
      
      // Update scrollbar opacity
      document.documentElement.style.setProperty('--baropacity', '0.9');
      if ((this as any).scrollTimeout) clearTimeout((this as any).scrollTimeout);
      (this as any).scrollTimeout = setTimeout(() => {
        gsap.to(document.documentElement, {
          '--baropacity': 0,
          duration: 1,
          ease: 'power2.out'
        });
      }, 1000);
    }, { passive: false });

    // Touch Scroll
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.selectedProject) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      this.targetVirtualScroll += deltaY * this.scrollSensitivity * 2;
      this.targetVirtualScroll = Math.max(0, Math.min(this.targetVirtualScroll, 1));
      touchStartY = touchY;
    }, { passive: true });
  }

  private render() {
    if (this.isDisposed) return;
    const elapsedTime = this.clock.getElapsedTime();

    this.particles.rotation.y = elapsedTime * 0.05;
    this.particles.rotation.x = Math.sin(elapsedTime * 0.1) * 0.1;

    this.virtualScroll += (this.targetVirtualScroll - this.virtualScroll) * this.scrollLerp;
    this.scrollProgress = this.virtualScroll;

    this.updateProjectCards();

    // Parallax effect
    this.camera.position.x += (this.mouseX * 1 - this.camera.position.x) * 0.05;
    this.camera.position.y += (-this.mouseY * 1 - this.camera.position.y) * 0.05;
    this.camera.lookAt(this.scene.position);

    if (this.logoMesh) {
      this.logoMesh.rotation.y = elapsedTime * 0.5;
      this.logoMesh.rotation.z = Math.sin(elapsedTime * 0.2) * 0.1;
    }

    this.composer.render();
    requestAnimationFrame(() => this.render());
  }

  private updateProjectCards() {
    const time = this.clock.getElapsedTime() * 0.1;
    this.projectCards.forEach((card, index) => {
      const t = (index / this.projectCards.length + time + this.scrollProgress) % 1;
      const position = this.vortexPath.getPoint(t);
      const lookAt = this.vortexPath.getPoint((t + 0.01) % 1);
      
      // Calculate opacity based on distance to camera
      const distance = position.distanceTo(this.camera.position);
      const opacity = Math.max(0, 1 - distance / 15);
      
      card.update(position, lookAt, opacity);
    });
  }

  public dispose() {
    this.isDisposed = true;
    this.renderer.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(m => m.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    if (this.immersiveText) {
      this.immersiveText.dispose();
    }
  }

  private initAnimations() {
    // Hero Text Fade-in
    gsap.to('#hero-text', {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 2,
      delay: 0.5,
      ease: 'expo.out'
    });

    // Subtle Glow Pulse
    gsap.to('#hero-text', {
      textShadow: '0 0 20px rgba(0, 255, 255, 0.5)',
      repeat: -1,
      yoyo: true,
      duration: 2,
      ease: 'sine.inOut'
    });

    // Glitch Effect (occasional flicker)
    const glitchElement = () => {
      if (Math.random() > 0.95) {
        gsap.to('#hero-text', {
          opacity: 0.8,
          x: (Math.random() - 0.5) * 10,
          duration: 0.05,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            gsap.set('#hero-text', { opacity: 1, x: 0 });
          }
        });
      }
      setTimeout(glitchElement, Math.random() * 2000 + 500);
    };
    glitchElement();
  }

  private checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.projectCards.map(c => c.mesh), true);
    
    if (intersects.length > 0) {
      document.body.style.cursor = 'pointer';
      gsap.to('#cursor', { scale: 1.5, borderColor: '#00ffff', duration: 0.3 });
    } else {
      document.body.style.cursor = 'default';
      gsap.to('#cursor', { scale: 1, borderColor: 'white', duration: 0.3 });
    }
  }

  private checkIntersection() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.projectCards.map(c => c.mesh), true);

    if (intersects.length > 0) {
      const object = intersects[0].object;
      // Find the card that owns this mesh
      const card = this.projectCards.find(c => c.mesh.children.includes(object as any));
      if (card) {
        // Find project data
        const title = (card as any).titleText.text;
        const project = projects.find(p => p.title === title);
        if (project) this.openProjectDetail(project, card);
      }
    }
  }

  private openProjectDetail(project: Project, card: ProjectCard) {
    if (this.selectedProject) return;
    this.selectedProject = project;

    // Zoom camera to card
    const targetPos = card.mesh.position.clone().add(new THREE.Vector3(0, 0, 2));
    gsap.to(this.camera.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 1.5,
      ease: 'expo.inOut'
    });

    // Fade out logo and other text
    if (this.logoMesh) gsap.to(this.logoMesh.material, { opacity: 0, duration: 1 });
    if (this.immersiveText) gsap.to(this.immersiveText, { fillOpacity: 0, duration: 1 });

    // Show Detail Overlay (DOM)
    this.showDetailOverlay(project);
  }

  private showDetailOverlay(project: Project) {
    const overlay = document.createElement('div');
    overlay.id = 'project-detail-overlay';
    overlay.innerHTML = `
      <div class="detail-sidebar">
        <button class="close-detail">CLOSE [X]</button>
        <div class="detail-meta">
          <div class="meta-item"><span>YEAR</span> 2024</div>
          <div class="meta-item"><span>CLIENT</span> FRONTIERS</div>
          <div class="meta-item"><span>TAGS</span> ${project.tags?.join(', ') || ''}</div>
        </div>
        <h1>${project.title}</h1>
        <p>${project.description || 'Explore the boundaries of digital space and immersive interactions.'}</p>
        <a href="#" class="visit-btn">VISIT SITE -></a>
      </div>
    `;
    document.body.appendChild(overlay);

    gsap.from('.detail-sidebar', {
      x: -100,
      opacity: 0,
      duration: 1,
      delay: 0.5,
      ease: 'expo.out'
    });

    overlay.querySelector('.close-detail')?.addEventListener('click', () => {
      this.closeProjectDetail();
    });
  }

  private closeProjectDetail() {
    this.selectedProject = null;
    const overlay = document.getElementById('project-detail-overlay');
    
    gsap.to('.detail-sidebar', {
      x: -100,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => overlay?.remove()
    });

    gsap.to(this.camera.position, {
      z: 5,
      x: 0,
      y: 0,
      duration: 1.5,
      ease: 'expo.inOut'
    });

    if (this.logoMesh) gsap.to(this.logoMesh.material, { opacity: 1, duration: 1 });
    if (this.immersiveText) gsap.to(this.immersiveText, { fillOpacity: 0.6, duration: 1 });
  }

  private initCustomCursor() {
    gsap.set('#cursor', { xPercent: -50, yPercent: -50 });
    gsap.set('#cursor-follower', { xPercent: -50, yPercent: -50 });
  }
}

new App();
