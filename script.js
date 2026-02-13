import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- UI Elements ---
const msgBox = document.getElementById('msg-box');
const controlsContainer = document.getElementById('animation-controls');
const infoCard = document.getElementById('info-card');

function updateMessage(msg) {
    if (msgBox) msgBox.innerHTML = msg;
}

// 1. Set up the Scene, Camera, and Renderer
const viewport = document.getElementById('viewport') || document.body;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
// Add some fog for depth
scene.fog = new THREE.Fog(0x87CEEB, 50, 500);

// The camera is our "eyes"
const width = viewport.clientWidth || window.innerWidth;
const height = viewport.clientHeight || window.innerHeight;
const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
camera.position.set(0, 40, 100); // High and far back

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.shadowMap.enabled = true; // Enable shadows
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
viewport.appendChild(renderer.domElement);

// 2. Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 400;
controls.maxPolarAngle = Math.PI; // Allow viewing from below

// 3. Add Realistic Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(10, 20, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 50;
sunLight.shadow.bias = -0.0001;
scene.add(sunLight);

// Fill light (blueish from sky)
const fillLight = new THREE.DirectionalLight(0xb0e0ff, 0.5);
fillLight.position.set(-10, 10, -10);
scene.add(fillLight);

// 4. Load Real Model with Fallback
const lionGroup = new THREE.Group();
lionGroup.position.y = 3; // Lift the entire group up significantly
scene.add(lionGroup);

updateMessage("Attempting to load 'stylized_bengal_tiger_with_4_animations.glb'...");

let mixer = null; // Animation mixer
let isWalking = false; // Flag to track if the tiger should move
let moveSpeed = 3.0; // Units per second

const loader = new GLTFLoader();

// Try to load the specified tiger file
loader.load(
    'stylized_bengal_tiger_with_4_animations.glb', 
    (gltf) => {
        updateMessage("Loaded Tiger Model");
        const model = gltf.scene;
        
        // 1. Calculate Initial Bounds (Unscaled)
        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        // 2. Determine Scale Factor to fit in 10-unit box
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 10 / maxDim;
        model.scale.setScalar(scaleFactor);

        // 3. Center the Model
        // We must move the model opposite to its center * scale
        model.position.x = -center.x * scaleFactor;
        // Add even more height to be safe
        model.position.y = (-bbox.min.y * scaleFactor) + 5.0; // Lifted 5 units
        model.position.z = -center.z * scaleFactor;

        // Also ensure the group itself is lifted
        lionGroup.position.y = 5.0; // Another 5 units (total 10 units up!)
        
        lionGroup.add(model);
        
        // 4. Adjust Camera to fit
        const fitOffset = 15.0; // Increased multiplier for normal view (zoomed out)
        const fitHeight = 4.0; // Slightly higher camera angle
        const boxSize = 10; // Target size
        
        const dist = boxSize * fitOffset;
        const height = boxSize * fitHeight;

        camera.position.set(0, height, dist);
        camera.lookAt(0, boxSize / 2, 0); // Look at center
        controls.target.set(0, boxSize / 2, 0);
        controls.update();

        // Animation Setup
        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(model);
            
            // Clear existing buttons if any
            if(controlsContainer) controlsContainer.innerHTML = '';

            let currentAction = null;

            gltf.animations.forEach((clip, index) => {
                const btn = document.createElement('button');
                btn.innerText = clip.name || `Anim ${index + 1}`;
                
                btn.onclick = () => {
                    // Update active state logic if desired
                    Array.from(controlsContainer.children).forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    if (currentAction) currentAction.fadeOut(0.5);
                    const action = mixer.clipAction(clip);
                    action.reset().fadeIn(0.5).play();
                    currentAction = action;
                    
                    // Determine movement status
                    const animName = (clip.name || '').toLowerCase();
                    const moveKeywords = ['walk', 'run', 'strut', 'trot', 'move', 'sneak'];
                    const isMoveAnim = moveKeywords.some(kw => animName.includes(kw));

                    if (isMoveAnim) {
                        isWalking = true;
                        moveSpeed = animName.includes('run') ? 8.0 : 3.0; // Faster if running
                        updateMessage(`Playing: ${btn.innerText} (Moving)`);
                    } else {
                        isWalking = false;
                        updateMessage(`Playing: ${btn.innerText} (Idle)`);
                    }
                };
                
                if (controlsContainer) controlsContainer.appendChild(btn);
            });

            // Play first animation by default
            const firstClip = gltf.animations[0];
            currentAction = mixer.clipAction(firstClip);
            currentAction.play();
            
            // Initial check for first animation
            const firstName = (firstClip.name || '').toLowerCase();
            const moveKeywords = ['walk', 'run', 'strut', 'trot', 'move', 'sneak'];
            if (moveKeywords.some(kw => firstName.includes(kw))) {
                isWalking = true;
                updateMessage(`Loaded Tiger. Playing: ${firstClip.name} (Moving)`);
            } else {
                 updateMessage(`Loaded Tiger. Playing: ${firstClip.name}`);
            }

            // Set first button active
            if(controlsContainer && controlsContainer.children.length > 0) {
                controlsContainer.children[0].classList.add('active');
            }

        } else {
            updateMessage("Loaded Tiger Model (No Animations Found)");
        }
    }, 
    undefined, 
    (error) => {
        console.warn('Tiger model not found or load error', error);
        updateMessage("Error loading 'stylized_bengal_tiger_with_4_animations.glb'.<br>1. Check file exists in folder.<br>2. If using Chrome/Edge, you must run a local server (e.g. VS Code Live Server) due to security.<br>Falling back to procedural lion.");
        createProceduralLion();
    }
);

// Fallback: Highly Detailed Procedural Lion (V3)
function createProceduralLion() {
    const lion = new THREE.Group();

    // Colors
    const furColor = 0xc2a674; // Tawny Gold
    const maneColor = 0x3d2b1f; // Dark Coffee Brown
    const bellyColor = 0xdecba4; // Lighter underbelly
    
    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: furColor, 
        roughness: 0.9,
        metalness: 0.0,
    });
    const bellyMat = new THREE.MeshStandardMaterial({ 
        color: bellyColor, 
        roughness: 1.0,
    });
    const maneMat = new THREE.MeshStandardMaterial({ 
        color: maneColor, 
        roughness: 1.0, 
        flatShading: false 
    });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1 });

    // --- BODY ---
    // Shoulders (Massive)
    const chestGeom = new THREE.SphereGeometry(1.6, 32, 32);
    chestGeom.scale(1, 1.3, 1.4);
    const chest = new THREE.Mesh(chestGeom, bodyMat);
    chest.position.set(0, 3.8, 1.2);
    chest.castShadow = true;
    lion.add(chest);

    // Spine/Belly
    const bellyGeom = new THREE.CylinderGeometry(1.5, 1.4, 3.5, 16);
    const belly = new THREE.Mesh(bellyGeom, bellyMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.set(0, 3.8, -0.8);
    belly.castShadow = true;
    lion.add(belly);

    // Hips (Narrower)
    const hipsGeom = new THREE.SphereGeometry(1.4, 32, 32);
    hipsGeom.scale(1, 1.2, 1.3);
    const hips = new THREE.Mesh(hipsGeom, bodyMat);
    hips.position.set(0, 3.8, -2.8);
    hips.castShadow = true;
    lion.add(hips);

    // --- HEAD ---
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 5.2, 3.8); // Higher and prouder
    lion.add(headGroup);

    // Main Skull
    const skullGeom = new THREE.BoxGeometry(1.8, 2, 2.2); // Boxier skull for lion
    // Smooth it slightly
    const skullModifier = new THREE.Mesh(new THREE.SphereGeometry(1.3, 32, 32), bodyMat);
    skullModifier.scale.set(0.9, 1.1, 1.2);
    headGroup.add(skullModifier);

    // Muzzle (Broad and square)
    const muzzleGeom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.4), bellyMat);
    muzzleGeom.position.set(0, -0.4, 1.2);
    headGroup.add(muzzleGeom);
    
    // Nose Bridge
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.5), bodyMat);
    bridge.position.set(0, 0.4, 1.0);
    bridge.rotation.x = 0.2;
    headGroup.add(bridge);

    // Nose Tip (Wide triangle)
    const nose = new THREE.Mesh(new THREE.BufferGeometry(), noseMat);
    // Custom triangle shape for nose
    const noseShape = new THREE.Shape();
    noseShape.moveTo(-0.4, 0);
    noseShape.lineTo(0.4, 0);
    noseShape.lineTo(0, -0.5);
    noseShape.lineTo(-0.4, 0);
    const noseExtrude = new THREE.ExtrudeGeometry(noseShape, { depth: 0.2, bevelEnabled: false });
    nose.geometry = noseExtrude;
    nose.position.set(0, 0.3, 2.0); // Tip of snout
    nose.rotation.x = -0.2;
    headGroup.add(nose);

    // Chin (Strong)
    const chin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), bellyMat);
    chin.position.set(0, -1.0, 1.0);
    headGroup.add(chin);

    // Eyes (Amber/Golden)
    const eyeGroup = new THREE.Group();
    headGroup.add(eyeGroup);
    const eyeColorMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 }); // Amber
    const pupilGeom = new THREE.SphereGeometry(0.1, 16, 16);
    
    // Brow Ridge (Heavy)
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.8), bodyMat);
    brow.position.set(0, 0.6, 0.8);
    headGroup.add(brow);

    function createEye(x) {
        const eyeWrapper = new THREE.Group();
        eyeWrapper.position.set(x, 0.2, 0.8);
        
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.25), eyeColorMat);
        eyeWrapper.add(ball);
        
        const pupil = new THREE.Mesh(pupilGeom, eyeMat);
        pupil.position.z = 0.22;
        eyeWrapper.add(pupil);
        
        return eyeWrapper;
    }
    eyeGroup.add(createEye(-0.5));
    eyeGroup.add(createEye(0.5));

    // Ears (Rounded, small, on top)
    const earGeom = new THREE.SphereGeometry(0.35, 16, 16);
    earGeom.scale(1, 1, 0.3);
    const leEar = new THREE.Mesh(earGeom, bodyMat);
    leEar.position.set(-0.9, 0.9, -0.2);
    leEar.rotation.set(0, 0.2, 0);
    headGroup.add(leEar);
    
    const reEar = new THREE.Mesh(earGeom, bodyMat);
    reEar.position.set(0.9, 0.9, -0.2);
    reEar.rotation.set(0, -0.2, 0);
    headGroup.add(reEar);

    // --- MANE (The Key Feature) ---
    // A huge cloud of dark hair around neck and chest
    const maneGroup = new THREE.Group();
    headGroup.add(maneGroup);
    
    // 1. Neck ruff (Cylinder/Torus)
    const ruffGeom = new THREE.TorusGeometry(1.6, 0.8, 16, 32);
    const ruff = new THREE.Mesh(ruffGeom, maneMat);
    ruff.rotation.x = Math.PI / 2; // Flat ring
    ruff.scale.set(1, 1, 1.5); // Oval
    ruff.position.set(0, -0.5, -0.5);
    maneGroup.add(ruff);
    
    // 2. Chest hair (Large sphere)
    const chestHair = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 16), maneMat);
    chestHair.position.set(0, -1.5, 0.5);
    chestHair.scale.set(1, 1.5, 1);
    maneGroup.add(chestHair);
    
    // 3. Top knot / Mohawk
    const topHair = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2, 16), maneMat);
    topHair.position.set(0, 1.0, -0.5);
    topHair.rotation.x = -0.5;
    maneGroup.add(topHair);
    
    // 4. Sideburns / Cheeks
    const sideHairGeom = new THREE.SphereGeometry(1.2, 16, 16);
    const lSide = new THREE.Mesh(sideHairGeom, maneMat);
    lSide.position.set(-1.2, -0.5, 0.5);
    maneGroup.add(lSide);
    const rSide = new THREE.Mesh(sideHairGeom, maneMat);
    rSide.position.set(1.2, -0.5, 0.5);
    maneGroup.add(rSide);

    // --- LEGS (Muscular) ---
    function createLeg(x, z, isBack) {
        const group = new THREE.Group();
        group.position.set(x, 2.5, z);
        
        // Upper Thigh
        const thighG = new THREE.SphereGeometry(isBack ? 1.1 : 1.0, 16, 16);
        thighG.scale(1, 1.5, 1);
        const thigh = new THREE.Mesh(thighG, bodyMat);
        thigh.position.y = 0.5;
        group.add(thigh);
        
        // Knee Joint
        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.5), bodyMat);
        knee.position.y = -0.8;
        knee.position.z = 0.3; // Knee forward
        group.add(knee);
        
        // Shin
        const shinG = new THREE.CylinderGeometry(0.35, 0.3, 2.0, 16);
        const shin = new THREE.Mesh(shinG, bodyMat);
        shin.position.y = -1.8;
        group.add(shin);
        
        // Paw (Big)
        const pawG = new THREE.BoxGeometry(0.7, 0.5, 0.9);
        const paw = new THREE.Mesh(pawG, bodyMat);
        paw.position.set(0, -2.8, 0.3);
        group.add(paw);
        
        return group;
    }

    lion.add(createLeg(-1.2, 1.5, false));
    lion.add(createLeg(1.2, 1.5, false));
    lion.add(createLeg(-1.2, -2.5, true));
    lion.add(createLeg(1.2, -2.5, true));

    // --- TAIL ---
    const tailGroup = new THREE.Group();
    tailGroup.name = 'tail';
    tailGroup.position.set(0, 4.0, -3.5);
    lion.add(tailGroup);
    
    const tailLen = 4.5;
    const tailGeo = new THREE.CylinderGeometry(0.15, 0.1, tailLen, 8);
    const tail = new THREE.Mesh(tailGeo, bodyMat);
    tail.position.y = -tailLen/2 + 0.5;
    tail.position.z = -1;
    tail.rotation.x = -0.5; // Hang down and back
    tailGroup.add(tail);

    // Black Tuft
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.4), maneMat);
    tuft.position.set(0, -tailLen/2, 0);
    tail.add(tuft);

    lionGroup.add(lion);
}

// Add a floor (Ground)
const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
const planeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3a5f0b,
    roughness: 1,
}); 
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

// Grass (Simple instances)
const grassGeo = new THREE.ConeGeometry(0.05, 0.3, 3);
const grassMat = new THREE.MeshStandardMaterial({color: 0x4a7f1b});
const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, 2000);
const dummy = new THREE.Object3D();
for(let i=0; i<2000; i++) {
    dummy.position.set((Math.random()-0.5)*40, 0.15, (Math.random()-0.5)*40);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    grassMesh.setMatrixAt(i, dummy.matrix);
}
scene.add(grassMesh);

// 5. Make it Responsive (Handle window resizing)
window.addEventListener('resize', () => {
    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});

// 6. Animation Loop
const clock = new THREE.Clock();

// Random wandering target
const targetPosition = new THREE.Vector3();
function updateTarget() {
    // Pick random point in range -500 to 500
    targetPosition.x = (Math.random() - 0.5) * 1000;
    targetPosition.z = (Math.random() - 0.5) * 1000;
}
updateTarget();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    
    // Camera follows target
    controls.update(); 
    
    if (mixer) {
        mixer.update(delta);
        
        // --- MOVEMENT LOGIC ---
        // We use lionGroup to hold the model.
        if (isWalking && lionGroup.children.length > 0) {
            const tiger = lionGroup.children[0];
            
            // Get World Position for accurate calculation
            const tigerWorldPos = new THREE.Vector3();
            tiger.getWorldPosition(tigerWorldPos);

            // Move towards target (World Space)
            const direction = new THREE.Vector3().subVectors(targetPosition, tigerWorldPos);
            direction.y = 0; // Move on XZ plane
            
            const dist = direction.length();
            
            if (dist < 5) {
                updateTarget();
            } else {
                direction.normalize();
                
                // Smooth Rotation using lookAt (Target is World Space)
                // Look at target at current height to avoid tilting
                tiger.lookAt(targetPosition.x, tigerWorldPos.y, targetPosition.z);
                
                // Move forward
                // Since lionGroup has no rotation, local Z matches world Z
                // We translate in world direction, but apply to local position
                tiger.position.add(direction.multiplyScalar(moveSpeed * delta));
            }
            
            // Update controls to follow the tiger
            controls.target.copy(tigerWorldPos);
            controls.target.y += 2; 
        }
    }

    // Procedural animation fallback
    if (!mixer) {
        const time = Date.now() * 0.001;
        // Animate Tail
        const tail = lionGroup.getObjectByName('tail');
        if (tail) {
            tail.rotation.y = Math.sin(time * 2) * 0.1; 
        }
    }
    
    renderer.render(scene, camera);
}
animate();