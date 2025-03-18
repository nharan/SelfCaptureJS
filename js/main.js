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
// Add Peek button
const peekButton = document.getElementById("peekButton");

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

// Initialize the Arrows extension for Peek mode
const arrows = new Arrows(board, {
  sprite: {
    url: "./assets/images/chessboard-arrows.svg",
    size: 40,
    cache: true
  }
});

// Add custom styling for arrows directly to ensure visibility
const arrowsStyle = document.createElement('style');
arrowsStyle.textContent = `
  .cm-chessboard .arrow-default .arrow-head, 
  .cm-chessboard .arrow-danger .arrow-head {
    fill-opacity: 1 !important;
  }
  
  .cm-chessboard .arrow-default .arrow-line,
  .cm-chessboard .arrow-danger .arrow-line {
    stroke-width: 6px !important;
    visibility: visible !important;
    opacity: 0.85 !important;
  }
  
  .cm-chessboard .arrow-default .arrow-head {
    fill: blue !important;
  }
  
  .cm-chessboard .arrow-default .arrow-line {
    stroke: blue !important;
  }
`;
document.head.appendChild(arrowsStyle);

// Peek mode variables
let peekModeEnabled = false;
let currentPeekArrow = null;
let lastHoveredSquare = null;
let lastPeekCalculationTime = null;
let isPeekCalculating = false;
const PEEK_THROTTLE_DELAY = 100; // ms - how often to calculate peek results at most

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

// Add the highlighting functionality in a safe way
document.addEventListener('DOMContentLoaded', () => {
  // Poll for SVG elements since they might not be immediately available
  const checkForBoardSquares = setInterval(() => {
    const squares = document.querySelectorAll('.cm-chessboard .board .square');
    
    if (squares.length > 0) {
      clearInterval(checkForBoardSquares);
      
      // Track piece dragging state
      let isDragging = false;
      let dragSourceSquare = null;
      let dragSourceColor = null;
      
      // Monitor draggable piece to detect when drag starts/ends
      const dragObserver = new MutationObserver((mutations) => {
        const draggablePiece = document.querySelector('.cm-chessboard-draggable-piece');
        
        if (draggablePiece && !isDragging) {
          // Drag has started
          isDragging = true;
          
          // Find which square was the source
          const boardState = game.getFEN().split(' ')[0];
          // Get currently clicked square from most recent moveInputStarted event
          if (lastEventSquare) {
            dragSourceSquare = lastEventSquare;
            const pieceAtSquare = getPieceAtSquare(boardState, lastEventSquare);
            if (pieceAtSquare) {
              dragSourceColor = pieceAtSquare === pieceAtSquare.toUpperCase() ? 'w' : 'b';
            }
          }
        } else if (!draggablePiece && isDragging) {
          // Drag has ended
          isDragging = false;
          dragSourceSquare = null;
          dragSourceColor = null;
          
          // Clean up any highlights
          squares.forEach(sq => {
            sq.classList.remove('self-capture-highlight');
          });
        }
      });
      
      // Start observing DOM for the draggable piece
      dragObserver.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
      // Add mouseover/mouseout event handlers to highlight during drag
      squares.forEach(square => {
        square.addEventListener('mouseover', () => {
          if (isDragging && dragSourceSquare) {
            const targetSquare = square.getAttribute('data-square');
            
            // Don't highlight the source square
            if (targetSquare === dragSourceSquare) return;
            
            const position = game.getFEN().split(' ')[0];
            const targetPiece = getPieceAtSquare(position, targetSquare);
            
            // If there's a piece and it's the same color as the dragged piece
            if (targetPiece) {
              const targetColor = targetPiece === targetPiece.toUpperCase() ? 'w' : 'b';
              if (targetColor === dragSourceColor) {
                square.classList.add('self-capture-highlight');
              }
            }
          }
        });
        
        square.addEventListener('mouseout', () => {
          square.classList.remove('self-capture-highlight');
        });
      });
    }
  }, 200); // Check every 200ms
});

// Track the last square clicked to help with drag detection
let lastEventSquare = null;

// Helper function for the input handler to track moves
const originalInputHandler = inputHandler;
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
    }
    return inputHandler(event);
  };
  
  // Track the start of drag operations
  document.addEventListener('mousedown', (e) => {
    const target = e.target;
    if (target && target.classList.contains('square')) {
      dragSourceSquare = target.getAttribute('data-square');
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
            // If we're switching to a new target square, clear any previous peek visualizations first
            if (lastHoveredSquare !== null) {
              // Clear any existing visualizations completely before showing new ones
              clearPeekVisualizations();
            }
            
            // Update the last hovered square
            lastHoveredSquare = targetSquare;
            
            // Check if this is a legal move
            const moves = game.getMovesAtSquare(dragSourceSquare);
            if (moves && moves.includes(targetSquare)) {
              // Use a timestamp-based throttling approach instead of debouncing
              const now = Date.now();
              if (!lastPeekCalculationTime || (now - lastPeekCalculationTime) > PEEK_THROTTLE_DELAY) {
                lastPeekCalculationTime = now;
                
                // Clear any ongoing peek calculation
                if (isPeekCalculating) {
                  return; // Skip if we're already calculating
                }
                
                // Clear previous arrow
                if (currentPeekArrow) {
                  arrows.removeArrows();
                  currentPeekArrow = null;
                }
                
                // Indicate we're calculating
                isPeekCalculating = true;
                
                // Use requestAnimationFrame for better performance
                requestAnimationFrame(() => {
                  simulateMoveAndShowResponse(dragSourceSquare, targetSquare);
                  isPeekCalculating = false;
                });
              }
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
      // Clear calculation state
      isPeekCalculating = false;
      lastPeekCalculationTime = null;
      
      // Remove any visualizations
      clearPeekVisualizations();
      
      // Ensure all opacity effects are completely gone
      resetChessPieceOpacity();
      
      // Reset peek state
      currentPeekArrow = null;
      
      // Reset hover state
      lastHoveredSquare = null;
      
      // Ensure all pieces are fully visible
      document.querySelectorAll('.cm-chessboard .piece').forEach(piece => {
        piece.style.opacity = '';
      });
    }
  });
});

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

// Add Peek button event listener
peekButton.addEventListener("click", () => {
  peekModeEnabled = !peekModeEnabled;
  
  // Update button appearance
  if (peekModeEnabled) {
    peekButton.classList.add("peek-active");
    peekButton.innerHTML = "👁️ Peek [ON]";
    // Also show a notification
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '10px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.backgroundColor = '#007bff';
    notification.style.color = 'white';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.zIndex = '9999';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.textContent = 'Peek Mode Activated';
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 1s ease';
      setTimeout(() => document.body.removeChild(notification), 1000);
    }, 2000);
  } else {
    peekButton.classList.remove("peek-active");
    peekButton.innerHTML = "👁️ Peek";
    
    // Clear any peek calculation state when disabling
    isPeekCalculating = false;
    lastPeekCalculationTime = null;
    
    // Clear any existing visualizations
    clearPeekVisualizations();
    
    // Reset peek state
    currentPeekArrow = null;
    
    // Reset state
    lastHoveredSquare = null;
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

// Function to simulate a move and show the AI's response
function simulateMoveAndShowResponse(fromSquare, toSquare) {
  // Save the current game state
  const currentFEN = game.getFEN();
  
  // Clear any existing visualizations
  clearPeekVisualizations();
  
  // Reset opacity of all pieces to ensure we don't have leftover transparency
  resetChessPieceOpacity();
  
  // Store the current peek state (do this first so it's available to ghost piece function)
  currentPeekArrow = { 
    playerFrom: fromSquare, 
    playerTo: toSquare 
  };
  
  // Get the piece at the source square
  const position = game.getFEN().split(' ')[0];
  const sourcePiece = getPieceAtSquare(position, fromSquare);
  
  if (sourcePiece) {
    // Update the peek state with the source piece
    currentPeekArrow.playerPiece = sourcePiece;
    
    // Show a ghost of the player's piece at the destination
    showGhostPiece(sourcePiece, toSquare, 'player');
    
    // Try to make the move
    const moveResult = game.move(fromSquare, toSquare);
    
    if (moveResult) {
      // Log the position after player's move
      const afterPlayerMoveFEN = game.getFEN();
      
      // If move is valid, calculate AI's response
      const aiMoveResult = game.makeAIMove();
      
      // Get the position after AI's move
      const afterAIMoveFEN = game.getFEN();
      
      if (aiMoveResult) {
        // Use our detection function to find the actual squares that changed
        const actualMove = detectActualMove(afterPlayerMoveFEN, afterAIMoveFEN);
        
        // Restore the original position
        game.setFEN(currentFEN);
        
        if (actualMove) {
          const aiFromSquare = actualMove.from;
          const aiToSquare = actualMove.to;
          
          // Get the AI piece that would move
          const aiPiece = getPieceAtSquare(afterPlayerMoveFEN, aiFromSquare);
          
          if (aiPiece) {
            // Update the peek state with AI move information
            currentPeekArrow.aiFrom = aiFromSquare;
            currentPeekArrow.aiTo = aiToSquare;
            currentPeekArrow.aiPiece = aiPiece;
            
            // Show a ghost of the AI's piece at its destination
            showGhostPiece(aiPiece, aiToSquare, 'ai');
          }
        } else {
          // Fallback method if detection fails
          let aiFromSquare, aiToSquare, aiPiece;
          
          // Handle castling
          if (aiMoveResult === "O-O" || aiMoveResult === "O-O-O") {
            // For castling, we need to determine the squares based on the side to move
            const side = afterPlayerMoveFEN.split(' ')[1]; // 'w' or 'b'
            
            if (side === 'w') {
              aiFromSquare = 'e1';
              aiToSquare = aiMoveResult === "O-O" ? 'g1' : 'c1';
              aiPiece = 'K'; // White king
            } else {
              aiFromSquare = 'e8';
              aiToSquare = aiMoveResult === "O-O" ? 'g8' : 'c8';
              aiPiece = 'k'; // Black king
            }
            
            // Update the peek state
            currentPeekArrow.aiFrom = aiFromSquare;
            currentPeekArrow.aiTo = aiToSquare;
            currentPeekArrow.aiPiece = aiPiece;
            currentPeekArrow.isCastling = true;
            
            // Show a ghost of the AI's king at its destination
            showGhostPiece(aiPiece, aiToSquare, 'ai');
            
            // Also show rook movement for castling
            const rookFromSquare = aiMoveResult === "O-O" ? 
              (side === 'w' ? 'h1' : 'h8') : 
              (side === 'w' ? 'a1' : 'a8');
            const rookToSquare = aiMoveResult === "O-O" ? 
              (side === 'w' ? 'f1' : 'f8') : 
              (side === 'w' ? 'd1' : 'd8');
            const rookPiece = side === 'w' ? 'R' : 'r';
            
            // Update the peek state with rook info
            currentPeekArrow.aiRookFrom = rookFromSquare;
            currentPeekArrow.aiRookTo = rookToSquare;
            currentPeekArrow.aiRookPiece = rookPiece;
            
            // Show ghost of the rook
            showGhostPiece(rookPiece, rookToSquare, 'ai-secondary');
          } else {
            // Handle normal moves and captures
            const movePattern = /([a-h][1-8])([-x])([a-h][1-8])/;
            const match = aiMoveResult.match(movePattern);
            
            if (match && match.length === 4) {
              aiFromSquare = match[1];
              aiToSquare = match[3];
              
              // Get the AI piece that would move
              aiPiece = getPieceAtSquare(afterPlayerMoveFEN, aiFromSquare);
              
              if (aiPiece) {
                // Update the peek state
                currentPeekArrow.aiFrom = aiFromSquare;
                currentPeekArrow.aiTo = aiToSquare;
                currentPeekArrow.aiPiece = aiPiece;
                
                // Show a ghost of the AI's piece at its destination
                showGhostPiece(aiPiece, aiToSquare, 'ai');
              }
            }
          }
        }
      } else {
        // Restore the original position
        game.setFEN(currentFEN);
      }
    } else {
      // Invalid move, clear any visualizations
      clearPeekVisualizations();
    }
  }
}

// Function to show a ghost piece at a specific square
function showGhostPiece(piece, square, type = 'player') {
  // Find the target square
  const targetSquare = document.querySelector(`.cm-chessboard .board .square[data-square="${square}"]`);
  if (!targetSquare) return;
  
  // Get the board size and calculate the piece size
  const boardEl = document.getElementById('board');
  const boardSize = boardEl.getBoundingClientRect().width;
  const squareSize = boardSize / 8;
  
  // Create a ghost piece element
  const ghostPiece = document.createElement('div');
  ghostPiece.className = `peek-ghost-piece peek-${type}`;
  ghostPiece.setAttribute('data-piece', piece);
  ghostPiece.setAttribute('data-square', square);
  
  // Determine the class for the specific piece
  const pieceClass = piece.toUpperCase() === piece ? 'w' : 'b';
  const pieceType = piece.toLowerCase();
  
  // Set the styling
  ghostPiece.style.position = 'absolute';
  ghostPiece.style.width = `${squareSize}px`;
  ghostPiece.style.height = `${squareSize}px`;
  ghostPiece.style.opacity = type === 'player' ? '0.9' : '0.85';
  ghostPiece.style.zIndex = '100'; // Ensure it's above other elements
  ghostPiece.style.pointerEvents = 'none'; // Ensure it doesn't interfere with clicking
  
  // Different border colors for player vs AI ghosts
  const borderColor = type === 'player' ? '#3498db' : '#e74c3c';
  const glowColor = type === 'player' ? 'rgba(52, 152, 219, 0.6)' : 'rgba(231, 76, 60, 0.6)';
  
  // Add a subtle border and shadow for the ghost piece
  ghostPiece.style.border = `2px solid ${borderColor}`;
  ghostPiece.style.boxShadow = `0 0 10px ${glowColor}`;
  ghostPiece.style.borderRadius = '50%';
  
  // Calculate the position of the square
  const squareRect = targetSquare.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();
  
  // Position the ghost piece over the square
  const left = squareRect.left - boardRect.left;
  const top = squareRect.top - boardRect.top;
  ghostPiece.style.left = `${left}px`;
  ghostPiece.style.top = `${top}px`;
  
  // Create a direct piece element - simplified from chessboard library
  const pieceSVG = document.createElement('div');
  pieceSVG.className = 'ghost-piece-svg';
  pieceSVG.style.width = '100%';
  pieceSVG.style.height = '100%';
  
  // Create the piece directly with an img element for maximum compatibility
  const pieceImg = document.createElement('img');
  pieceImg.style.width = '100%';
  pieceImg.style.height = '100%';
  pieceImg.style.position = 'absolute';
  pieceImg.style.top = '0';
  pieceImg.style.left = '0';
  
  // Set the image source based on piece type
  const pieceName = `${pieceClass}${pieceType.toUpperCase()}`;
  pieceImg.src = `img/chesspieces/wikipedia/${pieceName}.png`;
  
  // In case the image fails to load, add a fallback background
  pieceImg.onerror = () => {
    // Fallback to sprite if image fails
    pieceSVG.style.backgroundImage = `url('assets/images/chessboard-sprite-staunty.svg')`;
    pieceSVG.style.backgroundSize = '400%';
    
    // Set the piece sprite background position based on piece type
    switch(`${pieceClass}${pieceType}`) {
      case 'wp': pieceSVG.style.backgroundPosition = '0 0'; break;
      case 'wn': pieceSVG.style.backgroundPosition = '-100% 0'; break;
      case 'wb': pieceSVG.style.backgroundPosition = '-200% 0'; break;
      case 'wr': pieceSVG.style.backgroundPosition = '-300% 0'; break;
      case 'wq': pieceSVG.style.backgroundPosition = '0 -100%'; break;
      case 'wk': pieceSVG.style.backgroundPosition = '-100% -100%'; break;
      case 'bp': pieceSVG.style.backgroundPosition = '-200% -100%'; break;
      case 'bn': pieceSVG.style.backgroundPosition = '-300% -100%'; break;
      case 'bb': pieceSVG.style.backgroundPosition = '0 -200%'; break;
      case 'br': pieceSVG.style.backgroundPosition = '-100% -200%'; break;
      case 'bq': pieceSVG.style.backgroundPosition = '-200% -200%'; break;
      case 'bk': pieceSVG.style.backgroundPosition = '-300% -200%'; break;
    }
  };
  
  // Add the image to the ghost piece
  pieceSVG.appendChild(pieceImg);
  ghostPiece.appendChild(pieceSVG);
  
  // Add it to the board container
  const boardContainer = boardEl.closest('.board-container');
  if (boardContainer) {
    boardContainer.appendChild(ghostPiece);
    
    // Make the source piece semi-transparent
    // Add a class directly to all the source squares for more reliable opacity change
    if (type === 'player' && currentPeekArrow && currentPeekArrow.playerFrom) {
      const sourceSquare = document.querySelector(`.cm-chessboard .board .square[data-square="${currentPeekArrow.playerFrom}"]`);
      if (sourceSquare) {
        // Add a class to mark this as a source square for peeking
        sourceSquare.classList.add('peek-source-square');
        
        // Also try a more direct approach - get all pieces within this square
        const pieceLayers = sourceSquare.querySelectorAll('.piece, .draggable-source');
        pieceLayers.forEach(pieceLayer => {
          pieceLayer.style.opacity = '0.3';
          // Use !important to make sure it applies
          pieceLayer.setAttribute('style', pieceLayer.getAttribute('style') + '; opacity: 0.3 !important;');
        });
        
        // Use our helper function to directly modify SVG elements
        setChessPieceOpacity(currentPeekArrow.playerFrom, 0.3);
      }
    } else if (type === 'ai' && currentPeekArrow && currentPeekArrow.aiFrom) {
      // Also make AI source pieces semi-transparent
      const aiSourceSquare = document.querySelector(`.cm-chessboard .board .square[data-square="${currentPeekArrow.aiFrom}"]`);
      if (aiSourceSquare) {
        // Add a class to mark this as a source square for peeking
        aiSourceSquare.classList.add('peek-source-square');
        
        // Get all pieces within this square
        const aiPieceLayers = aiSourceSquare.querySelectorAll('.piece, .draggable-source');
        aiPieceLayers.forEach(pieceLayer => {
          pieceLayer.style.opacity = '0.3';
          // Use !important to make sure it applies
          pieceLayer.setAttribute('style', pieceLayer.getAttribute('style') + '; opacity: 0.3 !important;');
        });
        
        // Use our helper function to directly modify SVG elements
        setChessPieceOpacity(currentPeekArrow.aiFrom, 0.3);
      }
    } else if (type === 'ai-secondary' && currentPeekArrow && currentPeekArrow.aiRookFrom) {
      // Handle the rook's source piece for castling
      const rookSourceSquare = document.querySelector(`.cm-chessboard .board .square[data-square="${currentPeekArrow.aiRookFrom}"]`);
      if (rookSourceSquare) {
        // Add a class to mark this as a source square for peeking
        rookSourceSquare.classList.add('peek-source-square');
        
        // Get all pieces within this square
        const rookPieceLayers = rookSourceSquare.querySelectorAll('.piece, .draggable-source');
        rookPieceLayers.forEach(pieceLayer => {
          pieceLayer.style.opacity = '0.3';
          // Use !important to make sure it applies
          pieceLayer.setAttribute('style', pieceLayer.getAttribute('style') + '; opacity: 0.3 !important;');
        });
        
        // Use our helper function to directly modify SVG elements
        setChessPieceOpacity(currentPeekArrow.aiRookFrom, 0.3);
      }
    }
  }
}

// Helper function to directly set opacity on SVG pieces in the chessboard
function setChessPieceOpacity(square, opacity) {
  // First, try the direct SVG use element approach (which is what CM-Chessboard uses)
  const pieceElements = document.querySelectorAll(`.cm-chessboard .board .square[data-square="${square}"] use, 
                                                   .cm-chessboard .board .square[data-square="${square}"] .piece,
                                                   .cm-chessboard .piece[data-square="${square}"]`);
  
  if (pieceElements.length > 0) {
    pieceElements.forEach(element => {
      // For SVG elements, we need to modify the style attribute
      if (element instanceof SVGElement) {
        // If it's an SVG element, we can use the style.opacity
        element.style.opacity = opacity;
        
        // For 'use' elements in SVG, also try setting attributes directly
        if (element.tagName.toLowerCase() === 'use') {
          element.setAttribute('opacity', opacity);
        }
      } else {
        // For regular HTML elements
        element.style.opacity = opacity;
      }
    });
  }
  
  // Also try finding the piece via the piece layer in the chessboard
  const pieceLayer = document.querySelector(`.cm-chessboard .pieces .piece[data-square="${square}"]`);
  if (pieceLayer) {
    pieceLayer.style.opacity = opacity;
    
    // If it has child SVG elements, set their opacity too
    const svgElements = pieceLayer.querySelectorAll('svg, use, g, path');
    svgElements.forEach(svg => {
      if (svg instanceof SVGElement) {
        svg.style.opacity = opacity;
        svg.setAttribute('opacity', opacity);
      }
    });
  }
  
  // One more approach - try finding any elements with the square attribute
  document.querySelectorAll(`[data-square="${square}"]`).forEach(element => {
    // If it's a piece or contains a piece representation
    if (element.classList.contains('piece') || 
        element.querySelector('.piece') || 
        element.closest('.pieces')) {
      
      element.style.opacity = opacity;
      
      // Set opacity on all children
      const children = element.querySelectorAll('*');
      children.forEach(child => {
        // Skip ghost pieces
        if (!child.closest('.peek-ghost-piece')) {
          child.style.opacity = opacity;
          
          // For SVG elements
          if (child instanceof SVGElement) {
            child.setAttribute('opacity', opacity);
          }
        }
      });
    }
  });
}

// Function to reset all chess piece opacity
function resetChessPieceOpacity() {
  // Reset all piece elements
  document.querySelectorAll('.cm-chessboard .piece, .cm-chessboard use').forEach(piece => {
    piece.style.opacity = '';
    
    // For SVG elements
    if (piece instanceof SVGElement) {
      piece.removeAttribute('opacity');
    }
  });
  
  // Also reset any elements that have inline opacity style
  document.querySelectorAll('[style*="opacity"]').forEach(element => {
    // Only target elements related to the chessboard
    if (element.closest('.cm-chessboard') && 
        !element.classList.contains('peek-ghost-piece')) {
      // Extract the current style and remove opacity
      let style = element.getAttribute('style') || '';
      style = style.replace(/opacity\s*:\s*[^;]+(!important)?;?/g, '');
      if (style.trim()) {
        element.setAttribute('style', style);
      } else {
        element.removeAttribute('style');
      }
    }
  });
  
  // Also directly reset all pieces by square
  for (let row = 1; row <= 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = String.fromCharCode('a'.charCodeAt(0) + col) + row;
      // Find all elements associated with this square
      document.querySelectorAll(`[data-square="${square}"]`).forEach(element => {
        element.style.opacity = '';
        // Reset any children as well
        element.querySelectorAll('*').forEach(child => {
          child.style.opacity = '';
          if (child instanceof SVGElement) {
            child.removeAttribute('opacity');
          }
        });
      });
    }
  }
  
  // Also reset by square class
  document.querySelectorAll('.peek-source-square').forEach(square => {
    square.classList.remove('peek-source-square');
  });
}

// Function to clear all peek visualizations
function clearPeekVisualizations() {
  // Reset all chess piece opacity using our helper function
  resetChessPieceOpacity();

  // Find any pieces that were made transparent and restore them
  document.querySelectorAll('.cm-chessboard .board .piece').forEach(piece => {
    if (piece.style.opacity !== '') {
      piece.style.opacity = '';
    }
  });
  
  // Also clear any source square classes we added
  document.querySelectorAll('.cm-chessboard .square.peek-source-square').forEach(square => {
    square.classList.remove('peek-source-square');
    // Find all elements within this square and reset their opacity
    square.querySelectorAll('*').forEach(el => {
      if (el.style.opacity !== '') {
        el.style.opacity = '';
      }
    });
  });
  
  // Clean up any inline styles that might have been forcefully added
  document.querySelectorAll('.cm-chessboard [style*="opacity"]').forEach(el => {
    // Only reset if it's related to our peek functionality (not affecting other UI elements)
    if (el.closest('.square') || el.classList.contains('piece') || el.classList.contains('draggable-source')) {
      // Extract the current style and remove opacity
      let style = el.getAttribute('style') || '';
      style = style.replace(/opacity\s*:\s*[^;]+(!important)?;?/g, '');
      if (style.trim()) {
        el.setAttribute('style', style);
      } else {
        el.removeAttribute('style');
      }
    }
  });
  
  // Remove any existing ghost pieces
  document.querySelectorAll('.peek-ghost-piece').forEach(ghost => {
    ghost.parentNode.removeChild(ghost);
  });
  
  // Clear existing arrows if any
  arrows.removeArrows();
  
  // Clear any peek square highlights
  clearPeekHighlights();
}

// Function to clear peek square highlights
function clearPeekHighlights() {
  // Remove any peek-related highlights on squares
  document.querySelectorAll('.cm-chessboard .square.peek-highlight').forEach(sq => {
    sq.classList.remove('peek-highlight');
  });
  // Also remove any other peek-related classes we might have used
  document.querySelectorAll('.cm-chessboard .square.peek-source').forEach(sq => {
    sq.classList.remove('peek-source');
  });
  document.querySelectorAll('.cm-chessboard .square.peek-target').forEach(sq => {
    sq.classList.remove('peek-target');
  });
}
