import { Chessboard, MARKER_TYPE, INPUT_EVENT_TYPE, COLOR } from "../cm-chessboard/Chessboard.js";

var game_over = false;

// get elements
const fen = document.getElementById("fen");
const setFEN = document.getElementById("setFEN");
const copyFEN = document.getElementById("copyFEN");
const reset = document.getElementById("reset");
const makeMove = document.getElementById("makeMove");
const flipBoard = document.getElementById("flipBoard");
const aiMove = document.getElementById("aiMove");
const uiState = document.getElementById("uiState");
const thinkingTime = document.getElementById("thinkingTime");
const soundToggle = document.getElementById("soundToggle");
// Add AI vs AI button
const aiVsAi = document.getElementById("aiVsAi");
// Add stop AI vs AI button
const stopAiVsAi = document.getElementById("stopAiVsAi");

// Flag to track if AI vs AI match is running
let aiVsAiRunning = false;

// Chess sounds
const sounds = {
  // Basic chess sounds
  click: new Audio('assets/sounds/click.mp3'),
  move: new Audio('assets/sounds/move.mp3'),
  capture: new Audio('assets/sounds/capture.mp3'),
  castle: new Audio('assets/sounds/castle.mp3'),
  check: new Audio('assets/sounds/move-check.mp3'),
  
  // Evaluation-based sounds (commented out for now)
  /*
  bad2: new Audio('assets/sounds/bad2.mp3'),
  bad1: new Audio('assets/sounds/bad1.mp3'),
  neutral: new Audio('assets/sounds/neutral.mp3'),
  good1: new Audio('assets/sounds/good1.mp3'),
  good2: new Audio('assets/sounds/good2.mp3')
  */
};

// Sound enabled flag
let soundEnabled = true;

// Function to play a chess sound
function playSound(soundType) {
  if (!soundEnabled) return;
  
  // Stop any currently playing sounds
  Object.values(sounds).forEach(sound => {
    sound.pause();
    sound.currentTime = 0;
  });
  
  // Play the requested sound
  if (sounds[soundType]) {
    sounds[soundType].play();
  }
}

/*
// Function to play sound based on move evaluation (commented out for now)
function playSoundFeedback(evaluation) {
  if (!soundEnabled) return;
  
  // Mute previous sounds
  Object.values(sounds).forEach(sound => {
    sound.pause();
    sound.currentTime = 0;
  });
  
  // Play appropriate sound based on evaluation score
  if (evaluation <= -2) {
    sounds.bad2.play();
  } else if (evaluation <= -0.5) {
    sounds.bad1.play();
  } else if (evaluation < 0.5) {
    sounds.neutral.play();
  } else if (evaluation < 2) {
    sounds.good1.play();
  } else {
    sounds.good2.play();
  }
}
*/

// initialise engine
var game = new engine();

// initialise chessboard
const board = new Chessboard(document.getElementById("board"), {
  position: game.getFEN(),
  sprite: { url: "assets/images/chessboard-sprite-staunty.svg" },
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
  console.log("DEBUG - Received event type:", event.type, "Square:", event.square, "Selected:", selectedPiece);
  event.chessboard.removeMarkers(MARKER_TYPE.dot);
  if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
    // Play click sound when a piece is clicked
    playSound('click');
    
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
          
          // Check if this was a self-capture (indicated by 'x' in move notation)
          if (result.includes('x')) {
            // Create a visual flash effect on the square
            createCaptureFlash(event.square);
          }
          
          event.chessboard.state.moveInputProcess.then(() => {
            event.chessboard.setPosition(game.getFEN(), true).then(() => {
              // Determine what sound to play based on the move
              const status = game.gameStatus();
              if (status.check) {
                playSound('check');
              } else if (result.includes('x')) {
                playSound('capture');
              } else if (result.includes('O-O')) {
                playSound('castle');
              } else {
                playSound('move');
              }
              
              event.chessboard.enableMoveInput(inputHandler);
              setTimeout(() => {
                const aiMoveResult = game.makeAIMove();
                board.setPosition(game.getFEN(), true);
                
                // Play sound for AI move
                const newStatus = game.gameStatus();
                if (newStatus.check) {
                  playSound('check');
                } else if (aiMoveResult && aiMoveResult.includes('x')) {
                  playSound('capture');
                } else if (aiMoveResult && aiMoveResult.includes('O-O')) {
                  playSound('castle');
                } else {
                  playSound('move');
                }
                
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
      console.log("Selecting piece at", event.square);
      selectedPiece = event.square;
      for (const move of moves) {
        event.chessboard.addMarker(MARKER_TYPE.dot, move);
      }
      return true;
    }
    selectedPiece = null;
    return false;
  } else if (event.type === INPUT_EVENT_TYPE.moveInputCanceled) {
    // Handle deselection when move is canceled
    console.log("Deselecting piece due to move cancel");
    selectedPiece = null;
    event.chessboard.removeMarkers(MARKER_TYPE.dot);
    return false;
  } else if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
    const result = game.move(event.squareFrom, event.squareTo);
    selectedPiece = null;
    if (result) {
      event.chessboard.disableMoveInput();
      
      // Check if this was a self-capture (indicated by 'x' in move notation)
      if (result.includes('x')) {
        // Create a visual flash effect on the square
        createCaptureFlash(event.squareTo);
      }
      
      event.chessboard.state.moveInputProcess.then(() => {
        event.chessboard.setPosition(game.getFEN(), true).then(() => {
          // Determine what sound to play based on the move
          const status = game.gameStatus();
          if (status.check) {
            playSound('check');
          } else if (result.includes('x')) {
            playSound('capture');
          } else if (result.includes('O-O')) {
            playSound('castle');
          } else {
            playSound('move');
          }
          
          /* Commented out evaluation-based sound
          const evaluation = game.evaluatePosition();
          playSoundFeedback(evaluation);
          */
          
          event.chessboard.enableMoveInput(inputHandler);
          setTimeout(() => {
            const aiMoveResult = game.makeAIMove();
            board.setPosition(game.getFEN(), true);
            
            // Play sound for AI move
            const newStatus = game.gameStatus();
            if (newStatus.check) {
              playSound('check');
            } else if (aiMoveResult && aiMoveResult.includes('x')) {
              playSound('capture');
            } else if (aiMoveResult && aiMoveResult.includes('O-O')) {
              playSound('castle');
            } else {
              playSound('move');
            }
            
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

makeMove.addEventListener("click", () => {
  setTimeout(() => {
    const moveResult = game.makeAIMove();
    board.setPosition(game.getFEN(), true);
    
    // Determine what sound to play based on the AI's move
    const status = game.gameStatus();
    if (status.check) {
      playSound('check');
    } else if (moveResult && moveResult.includes('x')) {
      playSound('capture');
    } else if (moveResult && moveResult.includes('O-O')) {
      playSound('castle');
    } else {
      playSound('move');
    }
    
    /* Commented out evaluation-based sound
    const evaluation = -game.evaluatePosition(); // Negate because it's from human's perspective
    playSoundFeedback(evaluation);
    */
    
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
    
    const moveResult = game.makeAIMove();
    board.setPosition(game.getFEN(), true);
    
    // Determine what sound to play based on the AI's move
    const status = game.gameStatus();
    if (status.check) {
      playSound('check');
    } else if (moveResult && moveResult.includes('x')) {
      playSound('capture');
    } else if (moveResult && moveResult.includes('O-O')) {
      playSound('castle');
    } else {
      playSound('move');
    }
    
    /* Commented out neutral sound for AI vs AI
    sounds.neutral.play();
    */
    
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

// Add sound toggle event listener
soundToggle.addEventListener("change", () => {
  soundEnabled = soundToggle.checked;
});

// Function to create a visual flash effect on a square when a capture occurs
function createCaptureFlash(square) {
  // Get the board container element
  const boardContainer = document.querySelector('.board-container');
  
  // Get the board position and size
  const boardRect = document.getElementById('board').getBoundingClientRect();
  const boardSize = boardRect.width;
  const squareSize = boardSize / 8;
  
  // Calculate the position for the flash effect
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 8 - parseInt(square.charAt(1));
  
  // Create flash element
  const flashElement = document.createElement('div');
  flashElement.className = 'self-capture-flash';
  flashElement.style.left = (file * squareSize) + 'px';
  flashElement.style.top = (rank * squareSize) + 'px';
  flashElement.style.width = squareSize + 'px';
  flashElement.style.height = squareSize + 'px';
  
  // Add to board
  boardContainer.appendChild(flashElement);
  
  // Apply the glow effect to the square in the chessboard
  const svgSquares = document.querySelectorAll('.cm-chessboard .board .square');
  svgSquares.forEach(squareElement => {
    if (squareElement.getAttribute('data-square') === square) {
      squareElement.style.animation = 'selfCaptureGlow 0.6s ease-out';
      setTimeout(() => {
        squareElement.style.animation = '';
      }, 600);
    }
  });
  
  // Remove the flash element after animation completes
  setTimeout(() => {
    boardContainer.removeChild(flashElement);
  }, 600);
}
