const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const questList = document.getElementById("quest-list");
const messageNode = document.getElementById("game-message");

const tileSize = 32;
const mapRows = [
  "####################",
  "#....TT....###.....#",
  "#....TT....###..B..#",
  "#..................#",
  "#..####....#####...#",
  "#..#..#....#...#...#",
  "#..#..####.#...#...#",
  "#..#.......#...#...#",
  "#..#...N.......#...#",
  "#..#######..####...#",
  "#..................#",
  "#......S...........#",
  "#..................#",
  "####################",
];

const tileColors = {
  "#": "#4e445f",
  ".": "#527a4d",
  T: "#355d3a",
  N: "#527a4d",
  B: "#527a4d",
  S: "#527a4d",
};

const blockedTiles = new Set(["#", "T"]);
const interactables = {
  N: "town elder",
  B: "quest board",
  S: "shrine",
};

const quests = [
  { id: "elder", label: "Talk to the town elder (N)", done: false },
  { id: "board", label: "Check the quest board (B)", done: false },
  { id: "shrine", label: "Visit the old shrine (S)", done: false },
];

const questTargets = {
  elder: "N",
  board: "B",
  shrine: "S",
};

const player = { x: 2, y: 2 };
const keys = new Set();
let activeQuestIndex = 0;
let lastMoveTime = 0;
const moveDelay = 120;

function tileAt(x, y) {
  if (x < 0 || y < 0 || y >= mapRows.length || x >= mapRows[0].length) {
    return "#";
  }
  return mapRows[y][x];
}

function setMessage(text) {
  messageNode.textContent = text;
}

function renderQuests() {
  questList.innerHTML = "";
  quests.forEach((quest, index) => {
    const item = document.createElement("li");
    const marker = quest.done ? "✅" : index === activeQuestIndex ? "➡️" : "⬜";
    item.textContent = `${marker} ${quest.label}`;
    questList.appendChild(item);
  });
}

function completeActiveQuest(tile) {
  const quest = quests[activeQuestIndex];
  if (!quest) {
    setMessage("All quests complete. Keep exploring the town!");
    return;
  }

  if (tile === questTargets[quest.id]) {
    quest.done = true;
    activeQuestIndex += 1;
    const nextQuest = quests[activeQuestIndex];
    setMessage(
      nextQuest
        ? `Quest complete! Next: ${nextQuest.label}`
        : "You finished every quest. Great adventuring!"
    );
    renderQuests();
  } else if (interactables[tile]) {
    setMessage(
      `You found the ${interactables[tile]}, but your active quest is: ${quest.label}`
    );
  } else {
    setMessage("Nothing to interact with here.");
  }
}

function interact() {
  const directions = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (const [dx, dy] of directions) {
    const tile = tileAt(player.x + dx, player.y + dy);
    if (interactables[tile]) {
      completeActiveQuest(tile);
      return;
    }
  }
  setMessage("No one and nothing important is close enough.");
}

function movePlayer(dx, dy) {
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  if (blockedTiles.has(tileAt(nextX, nextY))) {
    setMessage("A wall or trees block your path.");
    return;
  }
  player.x = nextX;
  player.y = nextY;
}

function handleMovement(now) {
  if (now - lastMoveTime < moveDelay) {
    return;
  }

  if (keys.has("arrowup") || keys.has("w")) {
    movePlayer(0, -1);
  } else if (keys.has("arrowdown") || keys.has("s")) {
    movePlayer(0, 1);
  } else if (keys.has("arrowleft") || keys.has("a")) {
    movePlayer(-1, 0);
  } else if (keys.has("arrowright") || keys.has("d")) {
    movePlayer(1, 0);
  } else {
    return;
  }

  lastMoveTime = now;
}

function drawMap() {
  for (let y = 0; y < mapRows.length; y += 1) {
    for (let x = 0; x < mapRows[y].length; x += 1) {
      const tile = mapRows[y][x];
      ctx.fillStyle = tileColors[tile] || tileColors["."];
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

      if (tile === "N" || tile === "B" || tile === "S") {
        ctx.fillStyle = tile === "N" ? "#f2ca5e" : tile === "B" ? "#87b7ff" : "#d4a5ff";
        ctx.fillRect(x * tileSize + 8, y * tileSize + 8, tileSize - 16, tileSize - 16);
      }
    }
  }
}

function drawPlayer() {
  ctx.fillStyle = "#ff6a88";
  ctx.beginPath();
  ctx.arc(
    player.x * tileSize + tileSize / 2,
    player.y * tileSize + tileSize / 2,
    tileSize / 3,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function gameLoop(now) {
  handleMovement(now);
  drawMap();
  drawPlayer();
  requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
    keys.add(key);
  }

  if (key === "e") {
    event.preventDefault();
    interact();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

renderQuests();
setMessage("Welcome adventurer! Start by talking to the town elder (N).");
requestAnimationFrame(gameLoop);
