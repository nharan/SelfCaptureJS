import { Chessboard, MARKER_TYPE, INPUT_EVENT_TYPE, COLOR } from "../cm-chessboard/Chessboard.js";
import { Arrows, ARROW_TYPE } from "../cm-chessboard/extensions/arrows/Arrows.js";

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

<<<<<<< Updated upstream
updateStatus();
=======
// Initialize the Arrows extension
const arrows = new Arrows(board, {
  sprite: {
    url: "cm-chessboard/extensions/arrows/assets/arrows.svg",
    size: 40,
    cache: true
  }
});

// Peek mode variables
let peekModeEnabled = false;
let currentPeekArrow = null;
let lastHoveredSquare = null;
let peekCalculationTimer = null;
let isPeekCalculating = false;
let cachedLegalMoves = {}; // Cache for legal moves to avoid recalculation
let lastCalculatedMove = null; // Store the last move we calculated
const PEEK_DEBOUNCE_DELAY = 300; // Increase debounce to 300ms for better performance
const peekButton = document.getElementById("peekButton");

// Add CSS for self-capture highlight
const selfCaptureStyle = document.createElement('style');
selfCaptureStyle.textContent = `
  /* Add hover highlight to squares with same color pieces */
  .cm-chessboard .square.self-capture-highlight {
    fill: rgba(255, 0, 0, 0.5) !important;
  }
`;
document.head.appendChild(selfCaptureStyle);

// Track which piece is being dragged and from where
let draggedPieceSquare = null;
let draggedPieceColor = null;

// Listen for board events to implement self-capture highlighting
// This function doesn't exist in the CM-Chessboard library - commented out to fix error
// board.addPositionChangeListener((oldFen, newFen) => {
//   // Reset highlights when board position changes
//   removeAllHighlights();
// });

// Helper function to check if a square has same color piece as dragged piece
function shouldHighlightForSelfCapture(targetSquare) {
  if (!draggedPieceSquare || !draggedPieceColor) return false;
  
  // Get the piece at the target square
  const position = game.getFEN().split(' ')[0];
  const targetPiece = getPieceAtSquare(position, targetSquare);
  
  // If there's a piece and it's the same color as the dragged piece
  if (targetPiece) {
    const targetColor = targetPiece === targetPiece.toUpperCase() ? 'w' : 'b';
    return targetColor === draggedPieceColor;
  }
  
  return false;
}

// Remove all self-capture highlights
function removeAllHighlights() {
  document.querySelectorAll('.square.self-capture-highlight').forEach(square => {
    square.classList.remove('self-capture-highlight');
  });
}

// Add custom input handler for the board
function customBoardInputHandler(event) {
  // Call the original input handler
  const result = inputHandler(event);
  
  // Handle drag start - track which piece is being dragged
  if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
    const position = game.getFEN().split(' ')[0];
    const pieceAtSquare = getPieceAtSquare(position, event.square);
    
    if (pieceAtSquare) {
      draggedPieceSquare = event.square;
      draggedPieceColor = pieceAtSquare === pieceAtSquare.toUpperCase() ? 'w' : 'b';
      console.log(`Dragging ${draggedPieceColor} piece from ${draggedPieceSquare}`);
    }
  }
  
  return result;
}

// Modify the board to use our custom input handler
board.enableMoveInput(customBoardInputHandler);
>>>>>>> Stashed changes

// Track if we have a piece selected
let selectedPiece = null;

board.enableMoveInput(inputHandler);

function inputHandler(event) {
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

<<<<<<< Updated upstream
=======
// Helper function to extract piece at specific square from FEN
function getPieceAtSquare(fenPosition, square) {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 8 - parseInt(square.charAt(1));
  
  const rows = fenPosition.split('/');
  if (rank < 0 || rank >= rows.length) return null;
  
  const row = rows[rank];
  
  let col = 0;
  for (let i = 0; i < row.length; i++) {
    const char = row.charAt(i);
    
    if (isNaN(char)) {
      // It's a piece
      if (col === file) {
        return char;
      }
      col++;
    } else {
      // It's a number - skip these many columns
      col += parseInt(char);
    }
  }
  
  return null;
}

updateStatus();

// Track if we have a piece selected
let selectedPiece = null;

// Initialize the board with standard input handler
board.enableMoveInput(inputHandler);

// Add self-capture highlighting
document.addEventListener('DOMContentLoaded', () => {
  // Track last clicked square for drag source detection
  let dragSourceSquare = null;
  
  // Event listener to capture the start of drag
  const originalInputHandler = window.inputHandler;
  window.inputHandler = function(event) {
    if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
      dragSourceSquare = event.square;
      
      // Cache legal moves if peek mode is enabled
      if (peekModeEnabled && dragSourceSquare) {
        // Clear any previous cache
        cachedLegalMoves = {};
        
        // Get all legal moves for this square
        const moves = game.getMovesAtSquare(dragSourceSquare);
        
        // Cache them for quick lookup
        if (moves && moves.length > 0) {
          moves.forEach(move => {
            cachedLegalMoves[move] = true;
          });
        }
      }
    }
    return inputHandler(event);
  };
  
  // Track the start of drag operations
  document.addEventListener('mousedown', (e) => {
    const target = e.target;
    if (target && target.classList.contains('square')) {
      dragSourceSquare = target.getAttribute('data-square');
      
      // Cache legal moves if peek mode is enabled
      if (peekModeEnabled && dragSourceSquare) {
        // Clear any previous cache
        cachedLegalMoves = {};
        
        // Get all legal moves for this square
        const moves = game.getMovesAtSquare(dragSourceSquare);
        
        // Cache them for quick lookup
        if (moves && moves.length > 0) {
          moves.forEach(move => {
            cachedLegalMoves[move] = true;
          });
        }
      }
    }
  });
  
  // Mouse move listener to highlight potential self-captures
  document.addEventListener('mousemove', (e) => {
    // Check if we're dragging
    const draggablePiece = document.querySelector('.cm-chessboard-draggable-piece');
    if (!draggablePiece || !dragSourceSquare) return;
    
    // Hide draggable piece temporarily to find element below
    const originalStyle = draggablePiece.style.display;
    draggablePiece.style.display = 'none';
    const elemBelow = document.elementFromPoint(e.clientX, e.clientY);
    draggablePiece.style.display = originalStyle;
    
    // Clear any existing highlights
    document.querySelectorAll('.cm-chessboard .square.self-capture-highlight').forEach(sq => {
      sq.classList.remove('self-capture-highlight');
    });
    
    // Check if we're over a board square
    if (elemBelow && elemBelow.classList.contains('square')) {
      const targetSquare = elemBelow.getAttribute('data-square');
      
      // Don't highlight the source square
      if (targetSquare && targetSquare !== dragSourceSquare) {
        // Check if this is a potential self-capture
        const position = game.getFEN().split(' ')[0];
        const sourcePiece = getPieceAtSquare(position, dragSourceSquare);
        const targetPiece = getPieceAtSquare(position, targetSquare);
        
        if (sourcePiece && targetPiece) {
          // Check if same color
          const sourceIsWhite = sourcePiece === sourcePiece.toUpperCase();
          const targetIsWhite = targetPiece === targetPiece.toUpperCase();
          
          if (sourceIsWhite === targetIsWhite) {
            // Add highlight for potential self-capture
            elemBelow.classList.add('self-capture-highlight');
          }
        }
        
        // Peek mode functionality
        if (peekModeEnabled) {
          // Only process if this is a different square than last time
          if (targetSquare !== lastHoveredSquare) {
            lastHoveredSquare = targetSquare;
            
            // Check if this is a legal move using the cached values for better performance
            if (cachedLegalMoves[targetSquare]) {
              // Avoid recalculations for the same move
              const moveKey = `${dragSourceSquare}-${targetSquare}`;
              if (moveKey === lastCalculatedMove && currentPeekArrow) {
                return; // Skip calculation if we already did this one
              }
              
              // Clear any ongoing peek calculation
              if (peekCalculationTimer) {
                clearTimeout(peekCalculationTimer);
              }
              
              // Clear previous arrow if we're not currently calculating
              if (!isPeekCalculating && currentPeekArrow) {
                arrows.removeArrows();
                currentPeekArrow = null;
              }
              
              // Set a longer delay to prevent excessive calculations while moving
              peekCalculationTimer = setTimeout(() => {
                // Indicate we're calculating
                isPeekCalculating = true;
                lastCalculatedMove = moveKey;
                
                // Simulate the move without actually making it - asynchronously
                setTimeout(() => {
                  simulateMoveAndShowResponse(dragSourceSquare, targetSquare);
                  isPeekCalculating = false;
                }, 0);
              }, PEEK_DEBOUNCE_DELAY); // Use the increased debounce delay
            }
          }
        }
      }
    }
  });
  
  // Clear highlights when drag ends
  document.addEventListener('mouseup', () => {
    dragSourceSquare = null;
    document.querySelectorAll('.cm-chessboard .square.self-capture-highlight').forEach(sq => {
      sq.classList.remove('self-capture-highlight');
    });
    
    // Clear any peek arrows and state
    if (peekModeEnabled) {
      // Cancel any pending peek calculations
      if (peekCalculationTimer) {
        clearTimeout(peekCalculationTimer);
        peekCalculationTimer = null;
      }
      
      // Clear the isPeekCalculating flag
      isPeekCalculating = false;
      
      // Remove any arrows
      if (currentPeekArrow) {
        arrows.removeArrows();
        currentPeekArrow = null;
      }
      
      // Reset hover state and cached moves
      lastHoveredSquare = null;
      lastCalculatedMove = null;
      cachedLegalMoves = {};
    }
  });
});

// Function to simulate a move and show the AI's response
function simulateMoveAndShowResponse(fromSquare, toSquare) {
  // Save the current game state
  const currentFEN = game.getFEN();
  console.log("=== PEEK DEBUG START ===");
  console.log("Current FEN:", currentFEN);
  console.log("Player move:", fromSquare, "to", toSquare);
  
  // Try to make the move
  const moveResult = game.move(fromSquare, toSquare);
  console.log("Move result:", moveResult);
  
  if (moveResult) {
    // Log the position after player's move
    const afterPlayerMoveFEN = game.getFEN();
    console.log("Position after player move:", afterPlayerMoveFEN);
    
    // If move is valid, calculate AI's response
    const aiMoveResult = game.makeAIMove();
    console.log("AI response move (raw):", aiMoveResult);
    
    // Get the position after AI's move
    const afterAIMoveFEN = game.getFEN();
    console.log("Position after AI move:", afterAIMoveFEN);
    
    if (aiMoveResult) {
      // USE OUR NEW FUNCTION to detect the actual squares that changed
      const actualMove = detectActualMove(afterPlayerMoveFEN, afterAIMoveFEN);
      console.log("Detected AI move:", actualMove);
      
      // Restore the original position
      game.setFEN(currentFEN);
      
      if (actualMove) {
        const aiFromSquare = actualMove.from;
        const aiToSquare = actualMove.to;
        
        console.log("Using detected move coordinates - from:", aiFromSquare, "to:", aiToSquare);
        
        // Clear any existing arrows first
        arrows.removeArrows();
        
        // Add arrow to show AI's response
        console.log("Drawing arrow from", aiFromSquare, "to", aiToSquare);
        arrows.addArrow(ARROW_TYPE.danger, aiFromSquare, aiToSquare);
        currentPeekArrow = { from: aiFromSquare, to: aiToSquare };
      } else {
        console.warn("Could not detect actual AI move from board comparison");
        
        // Try the fallback method of parsing the move notation
        let aiFromSquare, aiToSquare;
        
        // Handle castling
        if (aiMoveResult === "O-O" || aiMoveResult === "O-O-O") {
          console.log("Detected castling move");
          // For castling, we need to determine the squares based on the side to move
          // and whether it's kingside or queenside
          const side = afterPlayerMoveFEN.split(' ')[1]; // 'w' or 'b'
          
          if (side === 'w') {
            aiFromSquare = 'e1';
            aiToSquare = aiMoveResult === "O-O" ? 'g1' : 'c1';
          } else {
            aiFromSquare = 'e8';
            aiToSquare = aiMoveResult === "O-O" ? 'g8' : 'c8';
          }
          
          // Clear any existing arrows first
          arrows.removeArrows();
          
          // Add arrow to show AI's response
          console.log("Drawing arrow from", aiFromSquare, "to", aiToSquare);
          arrows.addArrow(ARROW_TYPE.danger, aiFromSquare, aiToSquare);
          currentPeekArrow = { from: aiFromSquare, to: aiToSquare };
        } else {
          // Handle normal moves and captures
          console.log("Parsing non-castling move");
          const movePattern = /([a-h][1-8])([-x])([a-h][1-8])/;
          const match = aiMoveResult.match(movePattern);
          console.log("Regex match result:", match);
          
          if (match && match.length === 4) {
            aiFromSquare = match[1];
            aiToSquare = match[3];
            
            // Clear any existing arrows first
            arrows.removeArrows();
            
            // Add arrow to show AI's response
            console.log("Drawing arrow from", aiFromSquare, "to", aiToSquare);
            arrows.addArrow(ARROW_TYPE.danger, aiFromSquare, aiToSquare);
            currentPeekArrow = { from: aiFromSquare, to: aiToSquare };
          } else {
            console.warn("Could not parse AI move notation:", aiMoveResult);
          }
        }
      }
      
      console.log("=== PEEK DEBUG END ===");
    } else {
      console.warn("AI did not return a move result");
      console.log("=== PEEK DEBUG END ===");
      // Restore the original position 
      game.setFEN(currentFEN);
    }
  } else {
    console.log("Move was invalid");
    console.log("=== PEEK DEBUG END ===");
  }
}

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======

// Add Peek button event listener
peekButton.addEventListener("click", () => {
  peekModeEnabled = !peekModeEnabled;
  
  // Update button appearance
  if (peekModeEnabled) {
    peekButton.classList.remove("btn-outline-info");
    peekButton.classList.add("btn-info");
  } else {
    peekButton.classList.remove("btn-info");
    peekButton.classList.add("btn-outline-info");
    
    // Clear any peek calculation state when disabling
    if (peekCalculationTimer) {
      clearTimeout(peekCalculationTimer);
      peekCalculationTimer = null;
    }
    
    // Clear the isPeekCalculating flag
    isPeekCalculating = false;
    
    // Clear any existing peek arrows
    if (currentPeekArrow) {
      arrows.removeArrows();
      currentPeekArrow = null;
    }
    
    // Reset state
    lastHoveredSquare = null;
    lastCalculatedMove = null;
    cachedLegalMoves = {};
  }
  
  console.log("Peek mode " + (peekModeEnabled ? "enabled" : "disabled"));
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

// Share button functionality
const shareButton = document.getElementById('shareButton');
const downloadImageBtn = document.getElementById('downloadImage');
const boardCanvas = document.getElementById('boardCanvas');
let shareModal;

// Initialize modal after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if Bootstrap is available
  if (typeof bootstrap !== 'undefined') {
    shareModal = new bootstrap.Modal(document.getElementById('shareModal'));
    
    // Setup event listeners
    shareButton.addEventListener('click', () => {
      // Generate the board image
      renderBoardDirectly();
      // Show the modal
      shareModal.show();
    });
  } else {
    console.error("Bootstrap JavaScript not loaded. Modal functionality won't work.");
    
    // Fallback for when Bootstrap JS is not available
    shareButton.addEventListener('click', () => {
      alert("Sorry, the share functionality requires Bootstrap JavaScript which isn't loaded properly. Please refresh the page or try again later.");
    });
  }
  
  // Download button event listener
  downloadImageBtn.addEventListener('click', () => {
    downloadBoardImage();
  });
});

// Function to directly render the chess board to canvas without html2canvas
function renderBoardDirectly() {
  const canvas = boardCanvas;
  const ctx = canvas.getContext('2d');
  
  // Get board container dimensions for responsive sizing
  const boardRect = document.getElementById('board').getBoundingClientRect();
  
  // Set canvas dimensions with some padding for the title
  const padding = 60; // Space for the title
  canvas.width = boardRect.width;
  canvas.height = boardRect.width + padding;
  
  // Fill the background
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add the title
  ctx.fillStyle = '#5d4037';
  ctx.font = 'bold 24px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.fillText('fairchess.com', canvas.width / 2, 35);
  
  // Board colors
  const lightColor = '#f0d9b5';
  const darkColor = '#b58863';
  const borderColor = '#5d4037';
  
  // Get current game position
  const position = game.getFEN().split(' ')[0];
  const boardOrientation = board.getOrientation();
  
  // Draw the outer border
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, padding, canvas.width, canvas.width);
  
  // Draw inner board (slightly smaller to create border effect)
  const borderWidth = Math.max(4, canvas.width * 0.01);
  const innerWidth = canvas.width - borderWidth * 2;
  const squareSize = innerWidth / 8;
  
  // Parse FEN position
  const rows = position.split('/');
  
  // For mapping pieces to image files
  const pieceMap = {
    'p': 'bP', 'n': 'bN', 'b': 'bB', 'r': 'bR', 'q': 'bQ', 'k': 'bK',
    'P': 'wP', 'N': 'wN', 'B': 'wB', 'R': 'wR', 'Q': 'wQ', 'K': 'wK'
  };
  
  // Draw the board squares and coordinates
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // Adjust for board orientation
      const displayRow = boardOrientation === 'w' ? 7 - row : row;
      const displayCol = boardOrientation === 'w' ? col : 7 - col;
      
      const isLight = (displayRow + displayCol) % 2 === 0;
      ctx.fillStyle = isLight ? lightColor : darkColor;
      
      const x = displayCol * squareSize + borderWidth;
      const y = displayRow * squareSize + padding + borderWidth;
      
      // Draw square
      ctx.fillRect(x, y, squareSize, squareSize);
      
      // Draw coordinates
      if (displayRow === 7) {
        // Files (a-h)
        ctx.fillStyle = isLight ? darkColor : lightColor;
        ctx.font = `${squareSize * 0.2}px Arial`;
        ctx.textAlign = 'left';
        const file = boardOrientation === 'w' ? 
          String.fromCharCode(97 + displayCol) : 
          String.fromCharCode(97 + (7 - displayCol));
        ctx.fillText(file, x + 2, y + squareSize - 2);
      }
      
      if (displayCol === 0) {
        // Ranks (1-8)
        ctx.fillStyle = isLight ? darkColor : lightColor;
        ctx.font = `${squareSize * 0.2}px Arial`;
        ctx.textAlign = 'left';
        const rank = boardOrientation === 'w' ? 
          String(8 - displayRow) : 
          String(displayRow + 1);
        ctx.fillText(rank, x + 2, y + squareSize * 0.2 + 2);
      }
    }
  }
  
  // Preload all piece images
  const pieceImages = {};
  const imagePromises = [];
  
  for (const pieceChar in pieceMap) {
    const imageName = pieceMap[pieceChar];
    imagePromises.push(new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        pieceImages[pieceChar] = img;
        resolve();
      };
      img.onerror = () => {
        console.error(`Failed to load image for ${imageName}`);
        reject();
      };
      img.src = `img/chesspieces/wikipedia/${imageName}.png`;
    }));
  }

  // Show loading message
  ctx.fillStyle = '#333333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Loading pieces...', canvas.width / 2, padding - 10);
  
  // Wait for all images to load, then draw the pieces
  Promise.all(imagePromises).then(() => {
    // Clear the loading message
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, padding - 20, canvas.width, 20);
    
    // Redraw the title
    ctx.fillStyle = '#5d4037';
    ctx.font = 'bold 24px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.fillText('fairchess.com', canvas.width / 2, 35);
    
    // Now draw the pieces using the loaded images
    for (let row = 0; row < 8; row++) {
      let col = 0;
      const fenRow = rows[row];
      
      for (let i = 0; i < fenRow.length; i++) {
        const char = fenRow.charAt(i);
        
        if (isNaN(char)) {
          // It's a piece - draw the image
          // Adjust for board orientation
          const displayRow = boardOrientation === 'w' ? row : 7 - row;
          const displayCol = boardOrientation === 'w' ? col : 7 - col;
          
          const x = displayCol * squareSize + borderWidth;
          const y = displayRow * squareSize + padding + borderWidth;
          
          // Draw the piece image
          const img = pieceImages[char];
          if (img) {
            const padding = squareSize * 0.1; // 10% padding
            ctx.drawImage(img, 
              x + padding, 
              y + padding, 
              squareSize - 2*padding, 
              squareSize - 2*padding
            );
          }
          
          col++;
        } else {
          // It's a number - skip these many columns
          col += parseInt(char);
        }
      }
    }
  }).catch(error => {
    console.error("Error loading piece images:", error);
    // Draw simple piece representations as fallback
    drawSimplePieces(ctx, rows, squareSize, borderWidth, padding, boardOrientation);
  });
}

// Fallback function to draw simple pieces if images fail to load
function drawSimplePieces(ctx, rows, squareSize, borderWidth, padding, boardOrientation) {
  for (let row = 0; row < 8; row++) {
    let col = 0;
    const fenRow = rows[row];
    
    for (let i = 0; i < fenRow.length; i++) {
      const char = fenRow.charAt(i);
      
      if (isNaN(char)) {
        // It's a piece
        // Adjust for board orientation
        const displayRow = boardOrientation === 'w' ? row : 7 - row;
        const displayCol = boardOrientation === 'w' ? col : 7 - col;
        
        const x = displayCol * squareSize + borderWidth;
        const y = displayRow * squareSize + padding + borderWidth;
        
        // Draw piece representation as a circle with letter
        const pieceColor = char === char.toUpperCase() ? '#fff' : '#000';
        const pieceBorder = char === char.toUpperCase() ? '#000' : '#fff';
        const pieceType = char.toLowerCase();
        
        ctx.fillStyle = pieceColor;
        ctx.strokeStyle = pieceBorder;
        ctx.lineWidth = 1.5;
        
        // Draw circle with letter for the piece
        ctx.beginPath();
        ctx.arc(x + squareSize/2, y + squareSize/2, squareSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw piece letter
        ctx.fillStyle = pieceBorder;
        ctx.font = `bold ${squareSize * 0.4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pieceType.toUpperCase(), x + squareSize/2, y + squareSize/2);
        
        col++;
      } else {
        // It's a number - skip these many columns
        col += parseInt(char);
      }
    }
  }
}

// Function to download the board image
function downloadBoardImage() {
  // Create a temporary link element
  const link = document.createElement('a');
  
  // Set the download attributes
  link.download = `fairchess-${new Date().toISOString().split('T')[0]}.png`;
  
  // Convert canvas content to data URL
  link.href = boardCanvas.toDataURL('image/png');
  
  // Append to the document, click it, and remove it
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Function to detect actual piece movement between two board positions
function detectActualMove(beforeFEN, afterFEN) {
  // Split the FENs and get only the piece positions
  const beforePosition = beforeFEN.split(' ')[0];
  const afterPosition = afterFEN.split(' ')[0];
  
  // If the positions are the same, no move was made
  if (beforePosition === afterPosition) {
    return null;
  }
  
  // Convert FEN rows to a 2D board representation
  const beforeBoard = fenToBoard(beforePosition);
  const afterBoard = fenToBoard(afterPosition);
  
  // Find differences - where pieces disappeared and appeared
  let fromSquare = null;
  let toSquare = null;
  
  // Check each square on the board
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      // Convert to algebraic notation (a1, h8, etc.)
      const square = String.fromCharCode('a'.charCodeAt(0) + col) + (8 - row);
      
      // If a piece disappeared from this square
      if (beforeBoard[row][col] && (!afterBoard[row][col] || beforeBoard[row][col] !== afterBoard[row][col])) {
        // This could be the 'from' square
        if (!fromSquare || !toSquare) { // Prioritize first difference found
          fromSquare = square;
        }
      }
      
      // If a piece appeared on this square or changed
      if ((!beforeBoard[row][col] && afterBoard[row][col]) || 
          (beforeBoard[row][col] && afterBoard[row][col] && beforeBoard[row][col] !== afterBoard[row][col])) {
        // This could be the 'to' square
        toSquare = square;
      }
    }
  }
  
  if (fromSquare && toSquare) {
    return {
      from: fromSquare,
      to: toSquare,
      // The piece that moved
      piece: beforeBoard[8 - parseInt(fromSquare.charAt(1))][fromSquare.charCodeAt(0) - 'a'.charCodeAt(0)]
    };
  }
  
  return null;
}

// Convert FEN position string to a 2D board representation
function fenToBoard(fenPosition) {
  const rows = fenPosition.split('/');
  const board = Array(8).fill().map(() => Array(8).fill(null));
  
  for (let row = 0; row < 8; row++) {
    let col = 0;
    for (let i = 0; i < rows[row].length; i++) {
      const char = rows[row].charAt(i);
      
      if (isNaN(char)) {
        // It's a piece
        board[row][col] = char;
        col++;
      } else {
        // It's a number - skip these many columns
        col += parseInt(char);
      }
    }
  }
  
  return board;
}
>>>>>>> Stashed changes
