import { Grid } from "./grid.js";
import { Tile } from "./tile.js";

const gameBoard = document.getElementById("game-board");

const scoreDisplay = document.getElementById("score");
const bestScoreDisplay = document.getElementById("best-score");
const movesDisplay = document.getElementById("moves");
const timerDisplay = document.getElementById("game-timer");

const grid = new Grid(gameBoard);

let score = 0;
let moves = 0;

let timerStarted = false;
let timerInterval;
let seconds = 0;

let paused = false;
let gameOver = false;
let isMoving = false;

let previousState = null;

let bestScore = Number(localStorage.getItem("bestScore")) || 0;

bestScoreDisplay.textContent = bestScore;

grid.getRandomEmptyCell().linkTile(new Tile(gameBoard));
grid.getRandomEmptyCell().linkTile(new Tile(gameBoard));

setupInputOnce();

function setupInputOnce() {
  if (!gameOver) {
    window.addEventListener("keydown", handleInput, { once: true });
  }
}

async function handleInput(event) {

  if (event.key.toLowerCase() === "n") {
    location.reload();
    return;
  }

  if (event.key.toLowerCase() === "p") {
    togglePause();
    setupInputOnce();
    return;
  }

  if (event.key.toLowerCase() === "z") {
    undoMove();
    setupInputOnce();
    return;
  }

  if (paused || gameOver || isMoving) {
    setupInputOnce();
    return;
  }

  if (
    event.key === "ArrowUp" ||
    event.key === "ArrowDown" ||
    event.key === "ArrowLeft" ||
    event.key === "ArrowRight"
  ) {
    startTimer();
  }

  let canMove = false;

  switch (event.key) {
    case "ArrowUp":
      canMove = canMoveUp();

      if (canMove) {
        saveState();
        isMoving = true;
        await moveUp();
      }
      break;

    case "ArrowDown":
      canMove = canMoveDown();

      if (canMove) {
        saveState();
        isMoving = true;
        await moveDown();
      }
      break;

    case "ArrowLeft":
      canMove = canMoveLeft();

      if (canMove) {
        saveState();
        isMoving = true;
        await moveLeft();
      }
      break;

    case "ArrowRight":
      canMove = canMoveRight();

      if (canMove) {
        saveState();
        isMoving = true;
        await moveRight();
      }
      break;

    default:
      setupInputOnce();
      return;
  }

  if (!canMove) {
    setupInputOnce();
    return;
  }

  moves++;
  movesDisplay.textContent = moves;

  const newTile = new Tile(gameBoard);
  grid.getRandomEmptyCell().linkTile(newTile);

  isMoving = false;

  if (
    !canMoveUp() &&
    !canMoveDown() &&
    !canMoveLeft() &&
    !canMoveRight()
  ) {
    await newTile.waitForAnimationEnd();

    gameOver = true;
    clearInterval(timerInterval);

    showGameOver();
    return;
  }

  setupInputOnce();
}

function saveState() {
  previousState = {
    tiles: grid.cells.map(cell => {
      return cell.isEmpty()
        ? null
        : {
            x: cell.x,
            y: cell.y,
            value: cell.linkedTile.value
          };
    }),

    score: score,
    moves: moves,
    seconds: seconds
  };
}

function undoMove() {
  if (!previousState || paused || gameOver || isMoving) {
    return;
  }

  grid.cells.forEach(cell => {
    if (!cell.isEmpty()) {
      cell.linkedTile.removeFromDOM();
      cell.unlinkTile();
    }

    if (cell.hasTileForMerge()) {
      cell.unlinkTileForMerge();
    }
  });

  previousState.tiles.forEach(tileData => {
    if (tileData !== null) {
      const cell = grid.cells.find(
        cell =>
          cell.x === tileData.x &&
          cell.y === tileData.y
      );

      if (cell) {
        const tile = new Tile(gameBoard);
        tile.setValue(tileData.value);
        cell.linkTile(tile);
      }
    }
  });

  score = previousState.score;
  moves = previousState.moves;
  seconds = previousState.seconds;

  scoreDisplay.textContent = score;
  movesDisplay.textContent = moves;

  updateTimerDisplay();
}

function addScore(points) {
  score += points;

  scoreDisplay.textContent = score;

  if (score > bestScore) {
    bestScore = score;

    localStorage.setItem(
      "bestScore",
      bestScore
    );

    bestScoreDisplay.textContent = bestScore;
  }
}

function startTimer() {
  if (timerStarted) {
    return;
  }

  timerStarted = true;

  timerInterval = setInterval(() => {
    if (!paused && !gameOver) {
      seconds++;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  timerDisplay.textContent =
    `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function togglePause() {
  if (gameOver) {
    return;
  }

  paused = !paused;

  if (paused) {
    showPause();
  } else {
    hidePause();
  }
}

function showPause() {
  if (document.getElementById("game-paused")) {
    return;
  }

  const modal = document.createElement("div");

  modal.id = "game-paused";

  modal.innerHTML = `
    <div class="game-paused-box">
      <h2>GAME PAUSED</h2>
      <p>Press P to resume</p>
    </div>
  `;

  document.body.appendChild(modal);
}

function hidePause() {
  const modal = document.getElementById("game-paused");

  if (modal) {
    modal.remove();
  }
}

function showGameOver() {
  const modal = document.createElement("div");

  modal.id = "game-over";

  modal.innerHTML = `
    <div class="game-over-box">
      <h2>Game Over &gt;.&lt;</h2>
      <p>Score: ${score}</p>
      <p>Moves: ${moves}</p>
      <p>Time: ${timerDisplay.textContent}</p>
      <p>Press ENTER to close</p>
      <p>Press N to start a new game</p>
    </div>
  `;

  document.body.appendChild(modal);

  function handleGameOverInput(event) {
    if (event.key === "Enter") {
      modal.remove();

      window.removeEventListener(
        "keydown",
        handleGameOverInput
      );
    }

    if (event.key.toLowerCase() === "n") {
      location.reload();
    }
  }

  window.addEventListener(
    "keydown",
    handleGameOverInput
  );
}

async function moveUp() {
  await slideTiles(grid.cellsGroupedByColumn);
}

async function moveDown() {
  await slideTiles(grid.cellsGroupedByReversedColumn);
}

async function moveLeft() {
  await slideTiles(grid.cellsGroupedByRow);
}

async function moveRight() {
  await slideTiles(grid.cellsGroupedByReversedRow);
}

async function slideTiles(groupedCells) {
  const promises = [];

  groupedCells.forEach(group => {
    slideTilesInGroup(group, promises);
  });

  await Promise.all(promises);

  grid.cells.forEach(cell => {
    if (cell.hasTileForMerge()) {
      const mergedValue = cell.mergeTiles();

      addScore(mergedValue);
    }
  });
}

function slideTilesInGroup(group, promises) {
  for (let i = 1; i < group.length; i++) {
    if (group[i].isEmpty()) {
      continue;
    }

    const cellWithTile = group[i];

    let targetCell;
    let j = i - 1;

    while (
      j >= 0 &&
      group[j].canAccept(
        cellWithTile.linkedTile
      )
    ) {
      targetCell = group[j];
      j--;
    }

    if (!targetCell) {
      continue;
    }

    promises.push(
      cellWithTile.linkedTile.waitForTransitionEnd()
    );

    if (targetCell.isEmpty()) {
      targetCell.linkTile(
        cellWithTile.linkedTile
      );
    } else {
      targetCell.linkTileForMerge(
        cellWithTile.linkedTile
      );
    }

    cellWithTile.unlinkTile();
  }
}

function canMoveUp() {
  return canMove(
    grid.cellsGroupedByColumn
  );
}

function canMoveDown() {
  return canMove(
    grid.cellsGroupedByReversedColumn
  );
}

function canMoveLeft() {
  return canMove(
    grid.cellsGroupedByRow
  );
}

function canMoveRight() {
  return canMove(
    grid.cellsGroupedByReversedRow
  );
}

function canMove(groupedCells) {
  return groupedCells.some(group =>
    canMoveInGroup(group)
  );
}

function canMoveInGroup(group) {
  return group.some((cell, index) => {

    if (index === 0) {
      return false;
    }

    if (cell.isEmpty()) {
      return false;
    }

    const targetCell = group[index - 1];

    return targetCell.canAccept(
      cell.linkedTile
    );
  });
}