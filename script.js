// --- INITIAL SETUP ---
const canvas = document.getElementById('nightSkyCanvas');
const ctx = canvas.getContext('2d');

const pauseButton = document.getElementById('pauseButton');
const restartButton = document.getElementById('restartButton');

let animationFrameId;
let isPaused = false;
let lastTime = 0;

let background, moon, stars, fireflies, grass, flowers;

// --- CUSTOMIZABLE MESSAGE ---
const customMessageText = "yoshi";

let allFlowersGrown = false;
let messageAlpha = 0;

let wind = {
    angle: 0,
    speed: 0.0003, // Speed of wind change
    force: 15      // Max horizontal displacement by wind
};

// --- EASING FUNCTIONS ---
const Easing = {
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    // The elasticOut function is kept in case it's needed for other things, but it's no longer used for petals.
    elasticOut: t => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
};

// --- FLOWER BLUEPRINTS ---
const flowerBlueprints = {
    daisy: {
        petalCount: 16, petalLength: 60, petalWidth: 15, centerRadius: 15,
        baseColor: 'rgba(255, 255, 255, 0.8)', tipColor: 'rgba(240, 240, 255, 0.2)',
        centerColor: '#D4AC0D', glowColor: 'rgba(255, 255, 220, 0.3)',
        drawPetal: (ctx, scale, length, width, wind) => {
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(width * scale / 2 + wind, -length * scale * 0.5, 0 + wind, -length * scale);
            ctx.quadraticCurveTo(-width * scale / 2 + wind, -length * scale * 0.5, 0, 0);
        }
    },
    tulip: {
        petalCount: 6, petalLength: 55, petalWidth: 35, centerRadius: 5,
        baseColor: 'rgba(255, 192, 203, 0.8)', tipColor: 'rgba(255, 105, 180, 0.3)',
        centerColor: '#F1C40F', glowColor: 'rgba(255, 182, 193, 0.4)',
        drawPetal: (ctx, scale, length, width, wind, index) => {
            const angleOffset = (index % 2 === 0) ? -0.1 : 0.1;
            const zOffset = (index % 2 === 0) ? length * 0.2 : 0;
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(
                (width * scale * angleOffset) + wind, -length * scale * 0.3,
                (width * scale * 0.5) + wind, -length * scale * 0.7,
                0 + wind, -length * scale + zOffset * scale
            );
            ctx.bezierCurveTo(
                (-width * scale * 0.5) + wind, -length * scale * 0.7,
                (-width * scale * angleOffset) + wind, -length * scale * 0.3,
                0, 0
            );
        }
    },
    lily: {
        petalCount: 6, petalLength: 70, petalWidth: 25, centerRadius: 8,
        baseColor: 'rgba(255, 255, 224, 0.8)', tipColor: 'rgba(255, 255, 0, 0.3)',
        centerColor: '#AF601A', glowColor: 'rgba(255, 255, 180, 0.4)',
        drawPetal: (ctx, scale, length, width, wind) => {
            const tipBend = -width * scale * 0.8;
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(
                width * scale + wind, -length * scale * 0.5,
                tipBend + wind, -length * scale * 0.9,
                0 + wind, -length * scale
            );
            ctx.bezierCurveTo(
                -tipBend + wind, -length * scale * 0.9,
                -width * scale + wind, -length * scale * 0.5,
                0, 0
            );
        }
    }
};

// --- UTILITY FUNCTIONS ---
function getPointOnQuadraticBezier(p0, p1, p2, t) {
    const x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
    const y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;
    return { x, y };
}

// --- CLASSES ---
class Background {
    draw() {
        const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.5);
        gradient.addColorStop(0, '#0a0a20');
        gradient.addColorStop(1, '#000010');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const vignetteGradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width / 3, canvas.width / 2, canvas.height / 2, canvas.width / 1.5);
        vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
        vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * (canvas.height - 150);
        this.radius = Math.random() * 1.5 + 0.5;
        this.alpha = Math.random() * 0.5 + 0.5;
        this.twinkleSpeed = (Math.random() * 4 + 2) * 1000;
        this.twinkleOffset = Math.random() * this.twinkleSpeed;
    }
    update(timestamp) { this.alpha = 0.5 + 0.5 * Math.sin((timestamp + this.twinkleOffset) / this.twinkleSpeed * (2 * Math.PI)); }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 240, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Moon {
    constructor() {
        this.radius = Math.min(canvas.width, canvas.height) * 0.1;
        this.color = '#E0E0E0';
        this.glowColor = 'rgba(240, 240, 255, 0.25)';
        this.angle = Math.PI;
        this.orbitA = canvas.width * 0.6;
        this.orbitB = canvas.height * 0.6;
        this.speed = (2 * Math.PI) / 30000;
        this.craters = [];
        for (let i = 0; i < 15; i++) {
            const r = Math.random() * this.radius * 0.2 + this.radius * 0.05;
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * this.radius * 0.8;
            this.craters.push({
                x: d * Math.cos(a),
                y: d * Math.sin(a),
                radius: r,
                alpha: Math.random() * 0.3 + 0.1
            });
        }
    }
    update(timestamp) {
        this.angle = (timestamp * this.speed) % (2 * Math.PI);
        this.x = (canvas.width / 2) + this.orbitA * Math.cos(this.angle);
        this.y = canvas.height + this.orbitB * Math.sin(this.angle);
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 80;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Draw Craters
        this.craters.forEach(crater => {
            ctx.fillStyle = `rgba(0, 0, 0, ${crater.alpha})`;
            ctx.beginPath();
            ctx.arc(crater.x, crater.y, crater.radius, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = `rgba(255, 255, 255, ${crater.alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(crater.x + crater.radius * 0.2, crater.y + crater.radius * 0.2, crater.radius * 0.9, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
}

class Firefly {
    constructor(groundLevel) {
        this.groundLevel = groundLevel;
        const FLOWER_ZONE_HEIGHT = 300;
        this.x = Math.random() * canvas.width;
        this.y = groundLevel - (Math.random() * FLOWER_ZONE_HEIGHT + 50);
        this.radius = Math.random() * 2 + 1;
        this.alpha = 0.2;
        this.speedX = (Math.random() - 0.5) * 1.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.angle = Math.random() * Math.PI * 2;
        this.angleSpeed = (Math.random() - 0.5) * 0.1;
        this.blinkDuration = 1000;
        this.blinkDelay = Math.random() * 5000 + 2000;
        this.lastBlinkTime = 0;
    }
    update(timestamp) {
        this.x += this.speedX + Math.sin(this.angle) * 0.5;
        this.y += this.speedY + Math.cos(this.angle) * 0.5;
        this.angle += this.angleSpeed;
        if (this.x > canvas.width + this.radius) this.x = -this.radius;
        if (this.x < -this.radius) this.x = canvas.width + this.radius;

        if (timestamp > this.lastBlinkTime + this.blinkDelay) {
            const timeInBlink = timestamp - (this.lastBlinkTime + this.blinkDelay);
            if (timeInBlink < this.blinkDuration) {
                this.alpha = timeInBlink < this.blinkDuration / 2 ?
                    0.2 + 0.8 * (timeInBlink / (this.blinkDuration / 2)) :
                    1.0 - 0.8 * ((timeInBlink - this.blinkDuration / 2) / (this.blinkDuration / 2));
            } else {
                this.alpha = 0.2;
                this.lastBlinkTime = timestamp;
            }
        }
    }
    draw() {
        ctx.save();
        ctx.shadowColor = `rgba(255, 255, 153, 0.8)`;
        ctx.shadowBlur = 20 * this.alpha;
        ctx.fillStyle = `rgba(255, 255, 153, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Grass {
    constructor(groundLevel, bladeCount) {
        this.groundLevel = groundLevel;
        this.blades = [];
        for (let i = 0; i < bladeCount; i++) {
            this.blades.push({
                x: Math.random() * canvas.width,
                height: Math.random() * 40 + 60,
                width: Math.random() * 3 + 2,
                color1: `rgba(34, 68, 34, 0.9)`,
                color2: `rgba(51, 102, 68, 0.1)`
            });
        }
    }
    draw() {
        ctx.save();
        this.blades.forEach(blade => {
            const windInfluence = (Math.sin(wind.angle + blade.x * 0.05) * wind.force) * (blade.height / 100);
            const grad = ctx.createLinearGradient(blade.x, this.groundLevel, blade.x + windInfluence, this.groundLevel - blade.height);
            grad.addColorStop(0, blade.color1);
            grad.addColorStop(1, blade.color2);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(blade.x - blade.width / 2, this.groundLevel);
            ctx.quadraticCurveTo(blade.x, this.groundLevel - blade.height / 2, blade.x + windInfluence, this.groundLevel - blade.height);
            ctx.quadraticCurveTo(blade.x, this.groundLevel - blade.height / 2, blade.x + blade.width / 2, this.groundLevel);
            ctx.closePath();
            ctx.fill();
        });
        ctx.restore();
    }
}

class Flower {
    constructor(groundLevel, x, type, delay) {
        this.groundLevel = groundLevel;
        this.x = x;
        this.startTime = 0;
        this.delay = delay;
        this.blueprint = flowerBlueprints[type];

        this.growthDuration = 10000;
        this.stemGrowthDuration = 7000;
        this.leafGrowthStart = 2000;
        this.leafGrowthDuration = 5000;
        this.petalGrowthStart = 5000;
        this.petalGrowthDuration = 5000;
        this.maxStemHeight = 200 + Math.random() * 100;
        this.stemBaseWidth = 10; // Thicker stem

        this.leaves = [
            { pos: 0.4, side: -1, size: 1.2 + Math.random() * 0.4 },
            { pos: 0.7, side: 1, size: 1.3 + Math.random() * 0.2 }
        ];
    }
    update(timestamp) {
        if (this.startTime === 0) this.startTime = timestamp + this.delay;
        this.elapsedTime = timestamp - this.startTime;
    }
    draw() {
        if (this.elapsedTime < 0) return;
        ctx.save();
        ctx.translate(this.x, this.groundLevel);

        let stemProgress = Math.min(this.elapsedTime / this.stemGrowthDuration, 1);
        let currentStemHeight = this.maxStemHeight * Easing.easeOutCubic(stemProgress);

        const p0 = { x: 0, y: 0 };
        const p1 = { x: Math.sin(wind.angle + this.x * 0.1) * wind.force, y: -currentStemHeight / 2 };
        const p2 = { x: Math.sin(wind.angle * 1.2 + this.x * 0.1) * wind.force * 1.5, y: -currentStemHeight };

        if (currentStemHeight > 0) {
            const stemGrad = ctx.createLinearGradient(0, p0.y, 0, p2.y);
            stemGrad.addColorStop(0, 'rgba(51, 136, 68, 0.9)');
            stemGrad.addColorStop(1, 'rgba(80, 160, 100, 0.2)');
            ctx.fillStyle = stemGrad;

            const stemWidth = this.stemBaseWidth * (1 - stemProgress * 0.5);
            ctx.beginPath();
            ctx.moveTo(p0.x - stemWidth / 2, p0.y);
            ctx.quadraticCurveTo(p1.x, p1.y, p2.x - 1, p2.y);
            ctx.quadraticCurveTo(p1.x, p1.y, p0.x + stemWidth / 2, p0.y);
            ctx.closePath();
            ctx.fill();
        }

        // Draw Leaves
        if (this.elapsedTime > this.leafGrowthStart) {
            let leafProgress = Math.min((this.elapsedTime - this.leafGrowthStart) / this.leafGrowthDuration, 1);
            this.leaves.forEach(leaf => {
                const leafPos = getPointOnQuadraticBezier(p0, p1, p2, leaf.pos);
                ctx.save();
                ctx.translate(leafPos.x, leafPos.y);

                const leafAngle = Math.PI / 5 * leaf.side;
                const leafWind = Math.sin(wind.angle * 1.3 + this.x * 0.2 + leaf.pos) * wind.force * 0.5 + Math.cos(wind.angle * 0.8 + leaf.pos) * wind.force * 0.2;
                ctx.rotate(leafAngle);

                const leafLength = 60 * leaf.size * leafProgress;
                const leafWidth = 25 * leaf.size * leafProgress;

                const leafGrad = ctx.createLinearGradient(0, 0, leafWind, -leafLength);
                leafGrad.addColorStop(0, 'rgba(51, 136, 68, 0.9)');
                leafGrad.addColorStop(1, 'rgba(80, 160, 100, 0.3)');
                ctx.fillStyle = leafGrad;

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(leafWidth * leaf.side, -leafLength * 0.5, leafWind, -leafLength);
                ctx.quadraticCurveTo(leafWidth * leaf.side * 0.5, -leafLength * 0.5, 0, 0);
                ctx.fill();
                ctx.restore();
            });
        }

        ctx.translate(p2.x, p2.y);

        if (this.elapsedTime > this.petalGrowthStart) {
            let petalProgress = Math.min((this.elapsedTime - this.petalGrowthStart) / this.petalGrowthDuration, 1);
            // CHANGED: Replaced elasticOut with easeOutCubic for smooth, non-bouncing growth.
            let currentPetalScale = Easing.easeOutCubic(petalProgress);

            const { petalCount, petalLength, petalWidth, baseColor, tipColor, centerRadius, centerColor, glowColor, drawPetal } = this.blueprint;

            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 35 * currentPetalScale;

            for (let i = 0; i < petalCount; i++) {
                const angle = (i / petalCount) * (Math.PI * 2);
                ctx.save();
                ctx.rotate(angle);

                const petalGradient = ctx.createLinearGradient(0, 0, 0, -petalLength * currentPetalScale);
                petalGradient.addColorStop(0, baseColor);
                petalGradient.addColorStop(1, tipColor);
                ctx.fillStyle = petalGradient;

                const petalWind = Math.sin(wind.angle * 1.5 + i * 0.5) * wind.force * 0.55;

                ctx.beginPath();
                drawPetal(ctx, currentPetalScale, petalLength, petalWidth, petalWind, i);
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();

            ctx.fillStyle = centerColor;
            ctx.beginPath();
            ctx.arc(0, 0, centerRadius * currentPetalScale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    isGrown() {
        return this.elapsedTime >= this.growthDuration;
    }
}

// --- SCENE INITIALIZATION & MAIN LOOP ---
function initializeScene() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    allFlowersGrown = false;
    messageAlpha = 0;

    const STAR_DENSITY = 0.00015;
    const FIREFLY_DENSITY = 0.00004;
    const GRASS_DENSITY = 0.5;

    const groundLevel = canvas.height;
    const starCount = Math.floor(canvas.width * canvas.height * STAR_DENSITY);
    const fireflyCount = Math.floor(canvas.width * canvas.height * FIREFLY_DENSITY);
    const grassBladeCount = Math.floor(canvas.width * GRASS_DENSITY);

    background = new Background();
    moon = new Moon();
    stars = Array.from({ length: starCount }, () => new Star());
    fireflies = Array.from({ length: fireflyCount }, () => new Firefly(groundLevel));
    grass = new Grass(groundLevel, grassBladeCount);

    flowers = [];
    const flowerTypes = Object.keys(flowerBlueprints);
    const numFlowers = 3;
    for (let i = 0; i < numFlowers; i++) {
        const type = flowerTypes[i % flowerTypes.length];
        const xPos = canvas.width / 2 + (i - (numFlowers - 1) / 2) * 90;
        const delay = i * 600;
        flowers.push(new Flower(groundLevel, xPos, type, delay));
    }

    lastTime = 0;
    if (isPaused) requestAnimationFrame(drawStaticFrame);
}

function drawStaticFrame(timestamp = 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.draw();
    stars.forEach(star => star.draw());
    moon.draw();
    grass.draw();
    flowers.forEach(f => f.draw());
    fireflies.forEach(fly => fly.draw());
    if (allFlowersGrown) drawCompletionMessage(1);
}

function drawCompletionMessage(alpha) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.shadowColor = `rgba(255, 255, 220, ${alpha * 0.7})`;
    ctx.shadowBlur = 15;

    ctx.font = 'bold 48px "Trebuchet MS", sans-serif';
    ctx.fillText(`¡Feliz día, ${customMessageText}!`, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

function animate(timestamp) {
    if (isPaused) return;
    animationFrameId = requestAnimationFrame(animate);

    if (lastTime === 0) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    wind.angle += wind.speed * deltaTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    background.draw();
    stars.forEach(star => star.update(timestamp));
    stars.forEach(star => star.draw());
    moon.update(timestamp);
    moon.draw();
    grass.draw();
    flowers.forEach(f => f.update(timestamp));
    flowers.forEach(f => f.draw());
    fireflies.forEach(fly => fly.update(timestamp));
    fireflies.forEach(fly => fly.draw());

    if (!allFlowersGrown) {
        allFlowersGrown = flowers.every(f => f.isGrown());
    }

    if (allFlowersGrown && messageAlpha < 1) {
        messageAlpha = Math.min(1, messageAlpha + 0.01);
    }

    if (messageAlpha > 0) {
        drawCompletionMessage(messageAlpha);
    }
}

function handleResize() {
    cancelAnimationFrame(animationFrameId);
    initializeScene();
    if (!isPaused) animationFrameId = requestAnimationFrame(animate);
}

pauseButton.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? 'Reanudar' : 'Pausar';
    if (!isPaused) {
        lastTime = performance.now();
        requestAnimationFrame(animate);
    }
});

restartButton.addEventListener('click', () => {
    isPaused = false;
    pauseButton.textContent = 'Pausar';
    handleResize();
});

window.addEventListener('resize', handleResize);
initializeScene();
animationFrameId = requestAnimationFrame(animate);
