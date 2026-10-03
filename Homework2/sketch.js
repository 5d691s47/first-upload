const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;

let engine;
let scene = 'main';
let selectedStage = 0;
let completed = [false, false, false];
let returnAt = 0;
let woodLayer;
let lp;
let dragging = false;
let dragStart = null;
let dragOrigin = null;
let spinning = false;
let lastSpinAngle = 0;
let spinProgress = 0;
let shards = [];
let stageWalls = [];
let lastDragPoint = null;

const stageInfo = [
  { number: '01', name: 'SLIDE', instruction: 'DRAG THE RECORD SIDEWAYS' },
  { number: '02', name: 'CLICK', instruction: 'CLICK THE RECORD ONCE' },
  { number: '03', name: 'SPIN', instruction: 'DRAW A FULL CIRCLE' },
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(pixelDensity(), 2));
  engine = Engine.create();
  // 위에서 내려다보는 플레이어이므로 LP 본체에는 화면 중력을 주지 않는다.
  // 파편에는 별도의 힘을 적용한다.
  engine.gravity.y = 0;
  buildWoodTexture();
  resetRecord();
}

function draw() {
  imageMode(CORNER);
  image(woodLayer, 0, 0, width, height);
  applyShardGravity();
  Engine.update(engine);

  const layout = getLayout();
  drawAmbientLight();
  drawPlayer(layout);

  if (scene === 'main') {
    drawRecord(layout.platterX, layout.platterY, layout.recordR, frameCount * 0.002, 255, 1, 0);
    drawTonearm(layout);
    drawMainControls(layout);
  } else {
    updateStage(layout);
    drawStageRecord(layout);
    drawTonearm(layout);
    drawStagePlate(layout);
    drawShards();

    if (scene === 'complete') {
      drawCompletionStamp(layout);
      if (millis() > returnAt) returnToMain();
    }
  }
}

function buildWoodTexture() {
  woodLayer = createGraphics(width, height);
  const g = woodLayer;
  g.background('#34231d');
  randomSeed(83);

  for (let y = 0; y < height; y += 3) {
    const wave = sin(y * 0.055) * 8;
    g.stroke(72 + wave, 47 + wave * 0.45, 37 + wave * 0.25, random(24, 65));
    g.strokeWeight(random(0.4, 1.6));
    g.line(0, y + random(-1, 1), width, y + random(-1, 1));
  }

  for (let i = 0; i < width * height / 500; i++) {
    const y = random(height);
    const x = random(width);
    g.noFill();
    g.stroke(20, 12, 10, random(8, 25));
    g.ellipse(x, y, random(20, 130), random(2, 12));
  }

  const ctx = g.drawingContext;
  const vignette = ctx.createRadialGradient(
    width / 2, height / 2, min(width, height) * 0.18,
    width / 2, height / 2, max(width, height) * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(8,4,3,0.52)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawAmbientLight() {
  const ctx = drawingContext;
  ctx.save();
  const glow = ctx.createRadialGradient(
    width * 0.42, height * 0.32, 0,
    width * 0.42, height * 0.32, max(width, height) * 0.65,
  );
  glow.addColorStop(0, 'rgba(255,225,170,0.11)');
  glow.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function getLayout() {
  const deckW = min(width * 0.82, 940);
  const deckH = min(height * 0.73, deckW * 0.61);
  const x = width / 2 - deckW / 2;
  const y = height / 2 - deckH / 2 + 12;
  const recordR = min(deckH * 0.34, deckW * 0.225);
  return {
    x,
    y,
    deckW,
    deckH,
    platterX: x + deckW * 0.39,
    platterY: y + deckH * 0.46,
    recordR,
    panelX: x + deckW * 0.77,
  };
}

function drawPlayer(l) {
  push();
  rectMode(CORNER);

  drawingContext.save();
  drawingContext.shadowColor = 'rgba(0,0,0,0.62)';
  drawingContext.shadowBlur = 32;
  drawingContext.shadowOffsetY = 18;
  noStroke();
  fill('#b9a47d');
  rect(l.x, l.y, l.deckW, l.deckH, 18);
  drawingContext.restore();

  // 빈티지 플레이어의 눌리고 긁힌 표면
  fill('#b7a27d');
  stroke(55, 43, 33, 110);
  strokeWeight(1.2);
  rect(l.x, l.y, l.deckW, l.deckH, 18);
  noStroke();
  randomSeed(117);
  for (let i = 0; i < l.deckW * l.deckH / 260; i++) {
    const px = random(l.x + 8, l.x + l.deckW - 8);
    const py = random(l.y + 8, l.y + l.deckH - 8);
    fill(random() > 0.5 ? 255 : 45, random() > 0.5 ? 242 : 32, random() > 0.5 ? 210 : 25, random(2, 10));
    ellipse(px, py, random(0.5, 2.1), random(0.4, 1.5));
  }

  // 플래터와 금속 링
  fill(43, 41, 38);
  stroke(205, 193, 167, 125);
  strokeWeight(3);
  circle(l.platterX, l.platterY, l.recordR * 2.16);
  noFill();
  stroke(12, 12, 11, 150);
  strokeWeight(5);
  circle(l.platterX, l.platterY, l.recordR * 2.04);

  drawHardware(l);
  pop();
}

function drawTonearm(l) {
  const baseX = l.x + l.deckW * 0.82;
  const baseY = l.y + l.deckH * 0.28;
  const endX = l.platterX + l.recordR * 0.58;
  const endY = l.platterY - l.recordR * 0.44;

  noStroke();
  fill(57, 52, 47);
  circle(baseX, baseY, l.recordR * 0.34);
  fill(172, 160, 138);
  circle(baseX, baseY, l.recordR * 0.23);
  fill(48, 44, 40);
  circle(baseX, baseY, l.recordR * 0.10);

  stroke(199, 192, 177);
  strokeWeight(max(5, l.recordR * 0.032));
  line(baseX, baseY, baseX - l.recordR * 0.18, baseY + l.recordR * 0.67);
  line(baseX - l.recordR * 0.18, baseY + l.recordR * 0.67, endX, endY);
  stroke(50, 44, 40);
  strokeWeight(max(9, l.recordR * 0.065));
  line(endX, endY, endX - l.recordR * 0.13, endY + l.recordR * 0.13);
}

function drawHardware(l) {
  // 속도 조절 노브와 전원 표시등
  noStroke();
  fill(65, 58, 49);
  circle(l.panelX, l.y + l.deckH * 0.71, l.recordR * 0.22);
  fill(195, 181, 151);
  circle(l.panelX, l.y + l.deckH * 0.71, l.recordR * 0.14);
  stroke(53, 45, 38);
  strokeWeight(2);
  line(l.panelX, l.y + l.deckH * 0.71, l.panelX, l.y + l.deckH * 0.65);

  noStroke();
  fill(127, 32, 25, 220);
  circle(l.x + l.deckW * 0.91, l.y + l.deckH * 0.86, 9);
  fill(49, 42, 35, 190);
  textFont('Georgia');
  textSize(max(8, l.deckW * 0.011));
  textAlign(CENTER, CENTER);
  text('33 ⅓', l.panelX, l.y + l.deckH * 0.82);
}

function drawRecord(x, y, r, rotation, alpha, scaleAmount, scratchAmount) {
  push();
  translate(x, y);
  rotate(rotation);
  scale(scaleAmount);

  drawingContext.save();
  drawingContext.shadowColor = `rgba(0,0,0,${0.52 * alpha / 255})`;
  drawingContext.shadowBlur = 14;
  drawingContext.shadowOffsetX = 7;
  drawingContext.shadowOffsetY = 9;
  noStroke();
  fill(13, 13, 13, alpha);
  circle(0, 0, r * 2);
  drawingContext.restore();

  const ctx = drawingContext;
  ctx.save();
  const vinyl = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.04, 0, 0, r);
  vinyl.addColorStop(0, `rgba(66,65,62,${alpha / 255})`);
  vinyl.addColorStop(0.34, `rgba(18,18,18,${alpha / 255})`);
  vinyl.addColorStop(0.72, `rgba(6,7,7,${alpha / 255})`);
  vinyl.addColorStop(1, `rgba(27,26,25,${alpha / 255})`);
  ctx.fillStyle = vinyl;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TWO_PI);
  ctx.fill();
  ctx.restore();

  noFill();
  randomSeed(515);
  for (let ring = r * 0.25; ring < r * 0.96; ring += max(2.1, r * 0.015)) {
    stroke(115, 112, 104, alpha * random(0.09, 0.2));
    strokeWeight(0.6);
    circle(0, 0, ring * 2);
  }

  // 비닐 표면의 곡선 반사광
  stroke(255, 250, 226, alpha * 0.13);
  strokeWeight(r * 0.045);
  arc(0, 0, r * 1.55, r * 1.55, -2.45, -1.2);
  strokeWeight(r * 0.015);
  arc(0, 0, r * 1.72, r * 1.72, 0.42, 1.15);

  noStroke();
  fill(133, 50, 40, alpha);
  circle(0, 0, r * 0.48);
  fill(223, 202, 159, alpha);
  circle(0, 0, r * 0.055);
  fill(31, 25, 22, alpha);
  textAlign(CENTER, CENTER);
  textFont('Georgia');
  textStyle(BOLD);
  textSize(r * 0.095);
  text('JANNABI', 0, -r * 0.07);
  textStyle(NORMAL);
  textSize(r * 0.047);
  text('POSTER ARCHIVE', 0, r * 0.07);

  if (scratchAmount > 0) drawRecordScratches(r, scratchAmount, alpha);
  pop();
}

function drawRecordScratches(r, amount, alpha) {
  randomSeed(908);
  const count = floor(8 + amount * 52);
  noFill();
  for (let i = 0; i < count; i++) {
    const radius = random(r * 0.28, r * 0.94);
    const start = random(TWO_PI);
    stroke(225, 220, 205, alpha * random(0.05, 0.25) * amount);
    strokeWeight(random(0.4, 1.3));
    arc(0, 0, radius * 2, radius * 2, start, start + random(0.08, 0.55));
  }
}

function drawMainControls(l) {
  const buttons = getStageButtons(l);
  push();
  textAlign(CENTER, CENTER);
  textFont('Georgia');

  fill(52, 43, 35, 220);
  noStroke();
  textSize(max(12, l.deckW * 0.019));
  textStyle(BOLD);
  text('JANNABI : RECORD ARCHIVE', l.panelX, l.y + l.deckH * 0.42);
  textStyle(NORMAL);
  textSize(max(8, l.deckW * 0.0105));
  fill(65, 54, 43, 175);
  text('SELECT A TRACK', l.panelX, l.y + l.deckH * 0.48);

  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    const hover = pointInRect(mouseX, mouseY, b);
    drawingContext.save();
    drawingContext.shadowColor = hover ? 'rgba(35,20,13,0.38)' : 'rgba(35,20,13,0.22)';
    drawingContext.shadowBlur = hover ? 9 : 4;
    drawingContext.shadowOffsetY = 3;
    fill(hover ? color(87, 72, 58, 204) : color(74, 62, 51, 204));
    stroke(221, 207, 174, 80);
    strokeWeight(1);
    rectMode(CENTER);
    rect(b.x, b.y, b.w, b.h, 5);
    drawingContext.restore();

    noStroke();
    fill(completed[i] ? '#a7bd87' : '#d7c69f');
    circle(b.x - b.w * 0.36, b.y, max(6, b.h * 0.16));
    fill(238, 225, 196, 225);
    textSize(max(8, b.h * 0.21));
    text(`${stageInfo[i].number}  ${stageInfo[i].name}`, b.x + b.w * 0.04, b.y);
  }

  if (completed.every(Boolean)) {
    fill(116, 47, 38, 220);
    textStyle(ITALIC);
    textSize(max(10, l.deckW * 0.015));
    text('ARCHIVE COMPLETE', l.panelX, l.y + l.deckH * 0.94);
  }
  pop();
}

function getStageButtons(l) {
  const w = l.deckW * 0.25;
  const h = max(30, l.deckH * 0.072);
  const gap = h * 1.28;
  const startY = l.y + l.deckH * 0.58;
  return stageInfo.map((_, i) => ({ x: l.panelX, y: startY + i * gap, w, h }));
}

function drawStagePlate(l) {
  const info = stageInfo[selectedStage - 1];
  const x = l.x + l.deckW * 0.12;
  const y = l.y + l.deckH * 0.88;
  push();
  textAlign(LEFT, CENTER);
  textFont('Georgia');
  fill(60, 49, 39, 205);
  noStroke();
  textStyle(BOLD);
  textSize(max(11, l.deckW * 0.016));
  text(`${info.number}  ${info.name}`, x, y - 8);
  textStyle(NORMAL);
  textSize(max(8, l.deckW * 0.0105));
  fill(67, 55, 44, 165);
  text(info.instruction, x, y + 11);

  const home = getHomeButton(l);
  const hover = dist(mouseX, mouseY, home.x, home.y) < home.r;
  fill(hover ? 76 : 58, 49, 40, 215);
  circle(home.x, home.y, home.r * 2);
  fill(225, 211, 180, 220);
  textAlign(CENTER, CENTER);
  textSize(home.r * 0.48);
  text('MENU', home.x, home.y + 1);
  pop();
}

function getHomeButton(l) {
  return { x: l.x + l.deckW * 0.92, y: l.y + l.deckH * 0.90, r: max(20, l.deckH * 0.045) };
}

function resetRecord() {
  lp = {
    body: null,
    alpha: 255,
    scale: 1,
    scratches: 0,
    deleting: false,
  };
  dragging = false;
  spinning = false;
  spinProgress = 0;
  lastDragPoint = null;
}

function startStage(number) {
  clearStagePhysics();
  clearShards();
  selectedStage = number;
  scene = 'stage';
  resetRecord();
  const l = getLayout();
  setupStagePhysics(l);
}

function setupStagePhysics(l) {
  lp.body = Bodies.circle(l.platterX, l.platterY, l.recordR, {
    frictionAir: selectedStage === 1 ? 0.055 : 0.025,
    restitution: 0.48,
    density: 0.0014,
    label: 'vinyl-record',
  });

  const wall = 34;
  stageWalls = [
    Bodies.rectangle(l.x + l.deckW / 2, l.y - wall / 2, l.deckW, wall, { isStatic: true }),
    Bodies.rectangle(l.x + l.deckW / 2, l.y + l.deckH + wall / 2, l.deckW, wall, { isStatic: true }),
    Bodies.rectangle(l.x - wall / 2, l.y + l.deckH / 2, wall, l.deckH, { isStatic: true }),
    Bodies.rectangle(l.x + l.deckW + wall / 2, l.y + l.deckH / 2, wall, l.deckH, { isStatic: true }),
  ];
  Composite.add(engine.world, [lp.body, ...stageWalls]);
}

function updateStage(l) {
  if (selectedStage === 1 && lp.body && !lp.deleting) {
    const dx = l.platterX - lp.body.position.x;
    const dy = l.platterY - lp.body.position.y;
    const distanceX = abs(lp.body.position.x - l.platterX);
    const threshold = l.recordR * 1.55;

    if (!dragging) {
      // 놓은 LP가 관성을 유지하면서 스프링처럼 플래터로 되돌아온다.
      Body.applyForce(lp.body, lp.body.position, {
        x: dx * lp.body.mass * 0.000004,
        y: dy * lp.body.mass * 0.000004,
      });
    }
    lp.alpha = map(constrain(distanceX, 0, threshold), 0, threshold, 255, 0);
    if (distanceX >= threshold && scene === 'stage') {
      lp.alpha = 0;
      finishStage(1);
    }
  }

  if (lp.deleting) {
    if (selectedStage === 2) {
      lp.alpha *= 0.74;
      lp.scale *= 0.88;
    } else if (selectedStage === 3) {
      lp.alpha *= 0.58;
      lp.scale *= 0.92;
    }
  }
}

function drawStageRecord(l) {
  if (lp.alpha < 1 || !lp.body) return;
  drawRecord(
    lp.body.position.x,
    lp.body.position.y,
    l.recordR,
    lp.body.angle,
    lp.alpha,
    lp.scale,
    lp.scratches,
  );
}

function mousePressed() {
  const l = getLayout();

  if (scene === 'main') {
    const buttons = getStageButtons(l);
    for (let i = 0; i < buttons.length; i++) {
      if (pointInRect(mouseX, mouseY, buttons[i])) {
        startStage(i + 1);
        return;
      }
    }
    return;
  }

  if (scene !== 'stage') return;
  const home = getHomeButton(l);
  if (dist(mouseX, mouseY, home.x, home.y) < home.r) {
    returnToMain();
    return;
  }

  if (!isOverRecord(l, mouseX, mouseY)) return;

  if (selectedStage === 1) {
    dragging = true;
    dragStart = createVector(mouseX, mouseY);
    dragOrigin = createVector(lp.body.position.x, lp.body.position.y);
    lastDragPoint = createVector(mouseX, mouseY);
    Body.setVelocity(lp.body, { x: 0, y: 0 });
  } else if (selectedStage === 2) {
    lp.deleting = true;
    Body.setVelocity(lp.body, { x: random(-2.2, 2.2), y: -3.8 });
    Body.setAngularVelocity(lp.body, random(-0.16, 0.16));
    finishStage(2);
  } else if (selectedStage === 3) {
    spinning = true;
    lastSpinAngle = atan2(mouseY - l.platterY, mouseX - l.platterX);
  }
}

function mouseDragged() {
  if (scene !== 'stage') return;
  const l = getLayout();

  if (selectedStage === 1 && dragging) {
    const dx = mouseX - dragStart.x;
    const threshold = l.recordR * 1.55;
    const nextPosition = {
      x: dragOrigin.x + dx,
      y: dragOrigin.y + (mouseY - dragStart.y) * 0.18,
    };
    Body.setPosition(lp.body, nextPosition);
    Body.setVelocity(lp.body, {
      x: (mouseX - lastDragPoint.x) * 0.38,
      y: (mouseY - lastDragPoint.y) * 0.16,
    });
    Body.setAngularVelocity(lp.body, (mouseX - lastDragPoint.x) * 0.004);
    lastDragPoint.set(mouseX, mouseY);
    lp.alpha = map(constrain(abs(dx), 0, threshold), 0, threshold, 255, 0);
    if (abs(dx) >= threshold) {
      dragging = false;
      lp.alpha = 0;
      finishStage(1);
    }
  }

  if (selectedStage === 3 && spinning) {
    const radius = dist(mouseX, mouseY, l.platterX, l.platterY);
    if (radius < l.recordR * 0.28) return;

    const angle = atan2(mouseY - l.platterY, mouseX - l.platterX);
    let delta = angle - lastSpinAngle;
    if (delta > PI) delta -= TWO_PI;
    if (delta < -PI) delta += TWO_PI;
    if (abs(delta) < 0.7) {
      spinProgress += delta;
      Body.setAngle(lp.body, lp.body.angle + delta);
      Body.setAngularVelocity(lp.body, delta * 0.45);
      lp.scratches = constrain(abs(spinProgress) / TWO_PI, 0, 1);
    }
    lastSpinAngle = angle;

    if (abs(spinProgress) >= TWO_PI * 0.96) {
      spinning = false;
      lp.deleting = true;
      createRecordShards(l);
      Composite.remove(engine.world, lp.body);
      lp.body = null;
      finishStage(3);
    }
  }
}

function mouseReleased() {
  dragging = false;
  lastDragPoint = null;
  if (selectedStage === 3 && spinning) {
    spinning = false;
    spinProgress = 0;
    lp.scratches *= 0.72;
  }
}

function isOverRecord(l, x, y) {
  if (!lp.body) return false;
  return dist(x, y, lp.body.position.x, lp.body.position.y) <= l.recordR;
}

function finishStage(number) {
  completed[number - 1] = true;
  scene = 'complete';
  returnAt = millis() + 1150;
}

function drawCompletionStamp(l) {
  const fadeIn = constrain(map(returnAt - millis(), 1150, 720, 0, 255), 0, 255);
  push();
  textAlign(CENTER, CENTER);
  textFont('Georgia');
  textStyle(ITALIC);
  textSize(max(13, l.deckW * 0.023));
  fill(236, 220, 187, fadeIn);
  noStroke();
  text('TRACK CLEARED', l.platterX, l.platterY);
  pop();
}

function createRecordShards(l) {
  clearShards();
  for (let i = 0; i < 16; i++) {
    const angle = TWO_PI * i / 16;
    const radius = random(l.recordR * 0.2, l.recordR * 0.78);
    const body = Bodies.rectangle(
      l.platterX + cos(angle) * radius,
      l.platterY + sin(angle) * radius,
      random(l.recordR * 0.12, l.recordR * 0.25),
      random(5, 13),
      { frictionAir: 0.018, collisionFilter: { mask: 0 } },
    );
    Composite.add(engine.world, body);
    Body.setVelocity(body, { x: cos(angle) * random(2.5, 7), y: sin(angle) * random(2.5, 6) - 3 });
    Body.setAngularVelocity(body, random(-0.18, 0.18));
    shards.push({ body, w: body.bounds.max.x - body.bounds.min.x, h: body.bounds.max.y - body.bounds.min.y });
  }
}

function drawShards() {
  for (const shard of shards) {
    push();
    translate(shard.body.position.x, shard.body.position.y);
    rotate(shard.body.angle);
    rectMode(CENTER);
    fill(13, 13, 13, 240);
    stroke(165, 159, 146, 65);
    strokeWeight(0.6);
    rect(0, 0, shard.w, shard.h, 2);
    pop();
  }
}

function applyShardGravity() {
  for (const shard of shards) {
    Body.applyForce(shard.body, shard.body.position, {
      x: 0,
      y: shard.body.mass * 0.0008,
    });
  }
}

function clearShards() {
  for (const shard of shards) Composite.remove(engine.world, shard.body);
  shards = [];
}

function clearStagePhysics() {
  if (lp && lp.body) {
    Composite.remove(engine.world, lp.body);
    lp.body = null;
  }
  for (const wall of stageWalls) Composite.remove(engine.world, wall);
  stageWalls = [];
}

function returnToMain() {
  clearStagePhysics();
  clearShards();
  scene = 'main';
  selectedStage = 0;
  resetRecord();
}

function pointInRect(x, y, rectData) {
  return x >= rectData.x - rectData.w / 2 && x <= rectData.x + rectData.w / 2 &&
    y >= rectData.y - rectData.h / 2 && y <= rectData.y + rectData.h / 2;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  buildWoodTexture();
  if (scene === 'stage') {
    const l = getLayout();
    clearStagePhysics();
    resetRecord();
    setupStagePhysics(l);
  } else if (scene === 'complete') {
    returnToMain();
  }
}
