import {
  INPUT_EVENT_TYPE,
  COLOR,
  Chessboard,
  MARKER_TYPE,
} from "../cm-chessboard/Chessboard.js";

var game_over = false;

// get elements
const fen = document.getElementById("fen");
const setFEN = document.getElementById("setFEN");
const copyFEN = document.getElementById("copyFEN");
const reset = document.getElementById("reset");
const takeback = document.getElementById("takeback");
const makeMove = document.getElementById("makeMove");
const flipBoard = document.getElementById("flipBoard");
const aiMove = document.getElementById("aiMove");
const uiState = document.getElementById("uiState");
const thinkingTime = document.getElementById("thinkingTime");
// Add AI vs AI button
const aiVsAi = document.getElementById("aiVsAi");
// Add stop AI vs AI button
const stopAiVsAi = document.getElementById("stopAiVsAi");

// Flag to track if AI vs AI match is running
let aiVsAiRunning = false;

// initialise engine
var game = new engine();

// initialise chessboard
const board = new Chessboard(document.getElementById("board"), {
  position: game.getFEN(),
  sprite: { url: "../assets/images/chessboard-sprite-staunty.svg" },
  animationDuration: 200,
  style: {
    moveFromMarker: MARKER_TYPE.frame,
    moveToMarker: MARKER_TYPE.frame,
  }
});

updateStatus();

// Track if we have a piece selected
let selectedPiece = null;

board.enableMoveInput(inputHandler);

function inputHandler(event) {
  event.chessboard.removeMarkers(MARKER_TYPE.dot);
  if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
    // If we already have a piece selected
    if (selectedPiece) {
      // Check if this is a valid destination
      const moves = game.getMovesAtSquare(selectedPiece);
      if (moves.includes(event.square)) {
        // This is a valid move destination
        const result = game.move(selectedPiece, event.square);
        if (result) {
          selectedPiece = null;
          event.chessboard.disableMoveInput();
          event.chessboard.state.moveInputProcess.then(() => {
            event.chessboard.setPosition(game.getFEN(), true).then(() => {
              event.chessboard.enableMoveInput(inputHandler);
              setTimeout(() => {
                game.makeAIMove();
                event.chessboard.setPosition(game.getFEN(), true);
                setTimeout(() => updateStatus(), 300);
              }, 500);
            });
          });
        }
        return false;
      }
    }
    
    // No piece selected or invalid destination - try to select a new piece
    const moves = game.getMovesAtSquare(event.square);
    if (moves.length > 0) {
      selectedPiece = event.square;
      for (const move of moves) {
        event.chessboard.addMarker(MARKER_TYPE.dot, move);
      }
      return true;
    }
    selectedPiece = null;
    return false;
  } else if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
    const result = game.move(event.squareFrom, event.squareTo);
    selectedPiece = null;
    if (result) {
      event.chessboard.disableMoveInput();
      event.chessboard.state.moveInputProcess.then(() => {
        event.chessboard.setPosition(game.getFEN(), true).then(() => {
          event.chessboard.enableMoveInput(inputHandler);
          setTimeout(() => {
            game.makeAIMove();
            event.chessboard.setPosition(game.getFEN(), true);
            setTimeout(() => updateStatus(), 300);
          }, 500);
        });
      });
    }
    return result;
  }
}

// Check board status
function updateStatus() {
  if (game_over) return;

  // update FEN
  fen.value = game.getFEN();

  const status = game.gameStatus();

  if (status.over) {
    game_over = true;
    board.disableMoveInput();
    aiVsAiRunning = false; // Stop AI vs AI match if running
    alert(status.over);
    uiState.innerHTML = `${status.over}!`;
    return false;
  } else {
    // update status
    status.check
      ? (uiState.innerHTML = "Check!")
      : (uiState.innerHTML =
          `${status.sideToMove[0].toUpperCase()}${status.sideToMove.slice(1)}` +
          " to move");
  }
}

// event listeners
reset.addEventListener("click", () => {
  if (window.confirm("Are you sure you want to reset the board?")) {
    game.reset();
    game_over = false;
    aiVsAiRunning = false; // Stop AI vs AI match if running
    board.enableMoveInput(inputHandler);
    board.setPosition(game.getFEN(), true);
    updateStatus();
  }
});

takeBack.addEventListener("click", () => {
  alert("Just like life, in chess, there are no takebacks.");
});

makeMove.addEventListener("click", () => {
  setTimeout(() => {
    game.makeAIMove();
    board.setPosition(game.getFEN(), true);
    board.enableMoveInput(inputHandler);
  }, 500);
  updateStatus();
});

flipBoard.addEventListener("click", () => {
  board.setOrientation(board.getOrientation() === "w" ? "b" : "w", true);
});

copyFEN.addEventListener("click", () => {
  const fen = game.getFEN();
  navigator.clipboard
    .writeText(fen)
    .then(() => {
      alert("FEN copied to clipboard");
    })
    .catch(() => {
      alert("Oops, something went wrong.");
    });
});

setFEN.addEventListener("click", () => {
  const fenField = fen.value;
  game.setFEN(fenField);
  board.setPosition(fenField, true);
  updateStatus();
});

thinkingTime.addEventListener("change", () => {
  game.setThinkingTime(thinkingTime.value);
});

// AI vs AI match function
function startAiVsAiMatch() {
  if (game_over) return;
  
  aiVsAiRunning = true;
  board.disableMoveInput();
  
  // Make a move and schedule the next one
  function makeAiMove() {
    if (!aiVsAiRunning || game_over) {
      if (!game_over) {
        board.enableMoveInput(inputHandler);
      }
      return;
    }
    
    game.makeAIMove();
    board.setPosition(game.getFEN(), true);
    updateStatus();
    
    // Schedule next move with a delay
    setTimeout(() => {
      if (aiVsAiRunning && !game_over) {
        makeAiMove();
      } else if (!game_over) {
        board.enableMoveInput(inputHandler);
      }
    }, 1000); // 1 second delay between moves
  }
  
  // Start the AI vs AI match
  makeAiMove();
}

// Stop AI vs AI match
function stopAiVsAiMatch() {
  aiVsAiRunning = false;
  if (!game_over) {
    board.enableMoveInput(inputHandler);
  }
}

// Add event listeners for AI vs AI buttons
aiVsAi.addEventListener("click", startAiVsAiMatch);
stopAiVsAi.addEventListener("click", stopAiVsAiMatch);
