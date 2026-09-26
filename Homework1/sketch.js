const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;
let phone;
let initialNotifications = [];
let notifications = [];
let startTime;
let lastSpawnTime = 0;
let finalScene = false;
let lastNotificationTitle = "";
let weightless = false;
let weightlessStartTime = 0;
const maxNotifications = 50;
const totalDuration = 45000;

const initialData = [
  ["Messages", "You have a new message", "#02000d"],
  ["Mail", "3 unread emails", "#07203f"],
  ["Calendar", "Meeting starts in 10 minutes", "#ebded4"],
  ["Bank", "Your payment is complete", "#D9aa90"],
  ["Social", "hiiamy | HURRY!!!! FAST!!!", "#A65E46"],
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  textFont("Arial");
  engine = Engine.create();
  engine.gravity.y = 0.2;
  startTime = millis();
  createPhone();
  createInitialNotifications();
}

function createPhone() {
  phone = {
    x: width / 2,
    y: height / 2,
    w: min(width * 0.78, 390),
    h: min(height * 0.88, min(width * 0.78, 390) * 2.09),
    radius: 42,
  };
  const t = 24;
  Composite.add(engine.world, [
    Bodies.rectangle(phone.x, phone.y - phone.h / 2 + t / 2, phone.w, t, {
      isStatic: true,
    }),
    Bodies.rectangle(phone.x, phone.y + phone.h / 2 - t / 2, phone.w, t, {
      isStatic: true,
    }),
    Bodies.rectangle(phone.x - phone.w / 2 + t / 2, phone.y, t, phone.h, {
      isStatic: true,
    }),
    Bodies.rectangle(phone.x + phone.w / 2 - t / 2, phone.y, t, phone.h, {
      isStatic: true,
    }),
  ]);
}

function createInitialNotifications() {
  const w = phone.w - 64;
  const h = 68;
  const y = phone.y - phone.h / 2 + 105;
  initialData.forEach((data, i) => {
    const body = Bodies.rectangle(phone.x, y + i * 88, w, h, {
      isStatic: true,
      friction: 0.85,
      restitution: 0.05,
      chamfer: { radius: 16 },
      label: "initial",
    });
    body.notification = data;
    body.w = w;
    body.h = h;
    Body.setAngle(body, random(-0.025, 0.025));
    initialNotifications.push(body);
    notifications.push(body);
  });
  Composite.add(engine.world, initialNotifications);
}

function createNotification() {
  const progress = getProgress();
  const w = phone.w - 64;
  const h = random(58, 74);
  const firstIncoming = notifications.length === 5;
  const x = firstIncoming
    ? phone.x + random(-10, 10)
    : random(
        phone.x - phone.w / 2 + w / 2 + 8,
        phone.x + phone.w / 2 - w / 2 - 8,
      );
  const spawnY = firstIncoming
    ? initialNotifications[initialNotifications.length - 1].position.y -
      h * 0.82
    : phone.y - phone.h / 2 + 42;
  const notificationPool = [
    [
      "+92 0099-3847",
      "Are you available? REQUEST as fast as possible!!",
      "#02000d",
    ],
    ["CALENDER", "Action required today", "#07203f"],
    ["Direct Message", "ALEX | Hurry up!! F.A.S.T.", "#ebded4"],
    ["MOOSINSA", "WHY DON'T YOU BUY ONE?! BIG SALE", "#d9aa90"],
    ["Social Media", "You have new activity", "#a65e46"],
    ["Reminder", "Don't forget this, hiiamy!!", "#9c8b3f"],
  ];
  const availableNotifications = notificationPool.filter(
    (notification) => notification[0] !== lastNotificationTitle,
  );
  const data = random(availableNotifications);
  lastNotificationTitle = data[0];
  const body = Bodies.rectangle(x, spawnY, w, h, {
    friction: lerp(0.18, 0.95, progress),
    restitution: lerp(0.38, 0.02, progress),
    density: lerp(0.001, 0.006, progress),
    frictionAir: 0.035,
    chamfer: { radius: 16 },
    label: "incoming",
  });
  body.notification = data;
  body.w = w;
  body.h = h;
  notifications.push(body);
  Composite.add(engine.world, body);
  Body.setAngle(body, random(-0.28, 0.28));
  Body.setAngularVelocity(body, random(-0.045, 0.045));
  Body.setVelocity(body, {
    x: firstIncoming ? random(-0.15, 0.15) : random(-1.15, 1.15),
    y: firstIncoming ? 0.35 : random(0.45, 1.1),
  });

  if (notifications.length === 6) {
    initialNotifications.forEach((notification, index) => {
      Body.setStatic(notification, false);
      Body.setVelocity(notification, {
        x: 0,
        y: 0.35 + index * 0.08,
      });
    });

    Body.setVelocity(body, { x: 0, y: 1.2 });
  }
}

function draw() {
  background(5);
  const progress = getProgress();
  if (!finalScene) {
    if (!weightless) {
      engine.gravity.y = lerp(0.15, 2.4, progress);
    }

    const interval = lerp(1500, 120, progress);
    if (
      !weightless &&
      notifications.length < maxNotifications &&
      millis() - lastSpawnTime > interval
    ) {
      createNotification();
      lastSpawnTime = millis();
    }

    if (!weightless && notifications.length >= maxNotifications) {
      startWeightlessScene();
    }

    Engine.update(engine);
    keepNotificationsInsidePhone();

    if (weightless && millis() - weightlessStartTime > 3000) {
      finalScene = true;
    }
  }
  drawPhone();
  drawNotifications();
  drawDynamicIsland();
  if (finalScene) drawFinalMessage();
  else drawStatus();
}

function startWeightlessScene() {
  weightless = true;
  weightlessStartTime = millis();
  engine.gravity.y = 0;

  notifications.forEach((body) => {
    Body.setVelocity(body, {
      x: random(-1.1, 1.1),
      y: random(-1.1, 1.1),
    });
    Body.setAngularVelocity(body, random(-0.025, 0.025));
  });
}

function keepNotificationsInsidePhone() {
  notifications.forEach((body) => {
    const minX = phone.x - phone.w / 2 + 16;
    const maxX = phone.x + phone.w / 2 - 16;
    const minY = phone.y - phone.h / 2 + 18;
    const maxY = phone.y + phone.h / 2 - 18;
    const p = body.position;
    const v = body.velocity;
    const bounds = body.bounds;
    let correctedX = p.x;
    let correctedY = p.y;
    let hitX = false;
    let hitY = false;

    if (bounds.min.x < minX) {
      correctedX += minX - bounds.min.x;
      hitX = true;
    } else if (bounds.max.x > maxX) {
      correctedX -= bounds.max.x - maxX;
      hitX = true;
    }

    if (bounds.min.y < minY) {
      correctedY += minY - bounds.min.y;
      hitY = true;
    } else if (bounds.max.y > maxY) {
      correctedY -= bounds.max.y - maxY;
      hitY = true;
    }

    if (hitX || hitY) {
      Body.setPosition(body, { x: correctedX, y: correctedY });
      Body.setVelocity(body, {
        x: hitX ? -v.x * 0.45 : v.x,
        y: hitY ? -v.y * 0.18 : v.y,
      });
    }
  });
}

function drawPhone() {
  push();
  noStroke();
  fill(180, 184, 190);
  rect(phone.x, phone.y, phone.w, phone.h, phone.radius);
  fill(18, 19, 22);
  rect(phone.x, phone.y, phone.w - 8, phone.h - 8, phone.radius - 5);
  fill(2, 2, 3);
  rect(phone.x, phone.y, phone.w - 18, phone.h - 18, phone.radius - 10);

  fill(235, 235, 238, 220);
  rect(phone.x, phone.y + phone.h / 2 - 25, 82, 5, 3);

  fill(125, 130, 136);
  rect(phone.x - phone.w / 2 - 2, phone.y - 70, 4, 48, 3);
  rect(phone.x - phone.w / 2 - 2, phone.y - 5, 4, 27, 3);
  rect(phone.x + phone.w / 2 + 2, phone.y - 52, 4, 75, 3);
  pop();
}

function drawDynamicIsland() {
  push();
  const islandY = phone.y - phone.h / 2 + 33;
  fill(0);
  noStroke();
  rect(phone.x, islandY, 92, 25, 15);
  fill(23, 25, 29);
  ellipse(phone.x + 23, islandY, 9, 9);
  fill(42, 45, 50);
  ellipse(phone.x + 23, islandY, 4, 4);
  pop();
}

function drawNotifications() {
  notifications.forEach((body) => {
    const insidePhone =
      body.bounds.max.x > phone.x - phone.w / 2 &&
      body.bounds.min.x < phone.x + phone.w / 2 &&
      body.bounds.max.y > phone.y - phone.h / 2 &&
      body.bounds.min.y < phone.y + phone.h / 2;

    if (!insidePhone) return;

    push();
    translate(body.position.x, body.position.y);
    rotate(body.angle);
    noStroke();
    fill(235, 235, 235, 242);
    rect(0, 0, body.w, body.h, 16);
    fill(body.notification[2]);
    rect(-body.w / 2 + 29, 0, 35, 35, 9);
    fill(25);
    textAlign(LEFT, CENTER);
    textStyle(BOLD);
    textSize(12);
    text(body.notification[0], -body.w / 2 + 57, -13);
    textStyle(NORMAL);
    textSize(10);
    text(body.notification[1], -body.w / 2 + 57, 10);
    fill(100);
    text("now", body.w / 2 - 28, -body.h / 2 + 15);
    pop();
  });
}

function drawStatus() {
  fill(240);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(13);
  text(
    `${notifications.length} notifications`,
    width / 2,
    phone.y + phone.h / 2 + 28,
  );
}

function drawFinalMessage() {
  const scene = get();

  drawingContext.save();
  drawingContext.filter = "blur(7px)";
  image(scene, 0, 0);
  drawingContext.restore();

  noStroke();
  fill(0, 0, 0, 128);
  rect(width / 2, height / 2, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(min(phone.w * 0.055, 17));
  textStyle(BOLD);
  text("We are always connected,", width / 2, height / 2 - 18);
  text("yet sometimes disconnection is rest.", width / 2, height / 2 + 18);
}

function getProgress() {
  return constrain((millis() - startTime) / totalDuration, 0, 1);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  location.reload();
}
