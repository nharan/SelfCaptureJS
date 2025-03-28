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
const PEEK_THROTTLE_DELAY = 250; // Increased from 100ms to 250ms to reduce calculations

// Cache for peek calculations to avoid recalculating the same moves
const peekResultCache = new Map(); // Map<fromSquare_toSquare, {result}>
const MAX_CACHE_SIZE = 30; // Limit cache size to prevent memory issues

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
let lastTouchSquare = null;
let isTouchDragging = false;

// Helper function for the input handler to track moves
const originalInputHandler = inputHandler;
function inputHandler(event) {
  console.log("DEBUG - Received event type:", event.type, "Square:", event.square, "Selected:", selectedPiece);
  
  // Track the square for our touch events handler
  if (event.type === INPUT_EVENT_TYPE.moveInputStarted) {
    lastEventSquare = event.square;
  }
  
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
    // Get the piece at the square
    const position = game.getFEN().split(' ')[0];
    const piece = getPieceAtSquare(position, event.square);
    
    // Check if the piece belongs to the current player (white vs black)
    const isWhiteTurn = game.getFEN().split(' ')[1] === 'w';
    
    // Check if clicked on a piece of the current player's color
    if (piece) {
      const isWhitePiece = piece.toUpperCase() === piece;
      if (isWhiteTurn === isWhitePiece) {
        // Always allow selecting a piece of the current player, even if it can't move
        console.log("Selecting piece at", event.square);
        selectedPiece = event.square;
        
        // Show possible moves (if any)
        const moves = game.getMovesAtSquare(event.square);
        for (const move of moves) {
          event.chessboard.addMarker(MARKER_TYPE.dot, move);
        }
        
        // Always return true to allow piece selection even if there are no moves
        return true;
      }
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
  
  // Helper function to get coordinates from either mouse or touch event
  function getEventCoordinates(event) {
    // Touch event
    if (event.touches && event.touches.length) {
      return {
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY
      };
    }
    // Mouse event
    return {
      clientX: event.clientX,
      clientY: event.clientY
    };
  }
  
  // Helper function to get a square from coordinates
  function getSquareFromCoordinates(x, y) {
    // First check if there's a square element at these coordinates
    const element = document.elementFromPoint(x, y);
    if (element && element.classList.contains('square')) {
      return element.getAttribute('data-square');
    }
    return null;
  }
  
  // Helper function to process pointer movement (both mouse and touch)
  function handlePointerMove(e) {
    // Only process if a piece is being dragged
    if (!dragSourceSquare) return;
    
    // Get the draggable piece reference just once
    const draggablePiece = document.querySelector('.cm-chessboard-draggable-piece');
    if (!draggablePiece) return;
    
    // Get coordinates regardless of event type
    const coords = getEventCoordinates(e);
    
    // For touch events, track that we're dragging
    if (e.type === 'touchmove') {
      isTouchDragging = true;
    }
    
    // Use a more efficient approach to find the element under the cursor/finger
    const elemBelow = elementFromPointWithDraggable(coords.clientX, coords.clientY, draggablePiece);
    if (!elemBelow) return;
    
    // Check if we're over a board square and it's not the source square
    if (!elemBelow.classList.contains('square')) {
      // If not over a square, clear any previous highlights
      document.querySelectorAll('.cm-chessboard .square.self-capture-highlight').forEach(sq => {
        sq.classList.remove('self-capture-highlight');
      });
      return;
    }
    
    const targetSquare = elemBelow.getAttribute('data-square');
    if (!targetSquare || targetSquare === dragSourceSquare) {
      // If over the source square, clear any previous highlights
      document.querySelectorAll('.cm-chessboard .square.self-capture-highlight').forEach(sq => {
        sq.classList.remove('self-capture-highlight');
      });
      return;
    }
    
    // Always check for self-capture highlighting regardless of Peek mode
    // Clear any previous self-capture highlights first
    document.querySelectorAll('.cm-chessboard .square.self-capture-highlight').forEach(sq => {
      sq.classList.remove('self-capture-highlight');
    });
    
    // Get the current board position and check pieces
    const position = game.getFEN().split(' ')[0];
    const sourcePiece = getPieceAtSquare(position, dragSourceSquare);
    const targetPiece = getPieceAtSquare(position, targetSquare);
    
    // If there's a piece at the target, check if it's the same color for self-capture
    if (sourcePiece && targetPiece) {
      const sourceIsWhite = sourcePiece === sourcePiece.toUpperCase();
      const targetIsWhite = targetPiece === targetPiece.toUpperCase();
      
      if (sourceIsWhite === targetIsWhite) {
        // Add highlight for potential self-capture - this is always shown whether peek is on or not
        elemBelow.classList.add('self-capture-highlight');
        
        // Add a data attribute to mark this as a self-capture option
        elemBelow.setAttribute('data-self-capture', 'true');
      }
    }
    
    // Only continue with Peek functionality if Peek mode is enabled
    if (!peekModeEnabled) return;
    
    // Check if this could be a legal move
    // First try getMovesAtSquare for efficiency
    const moves = game.getMovesAtSquare(dragSourceSquare);
    
    // Direct move validation for check-blocking moves or other special cases
    // that might not be captured by getMovesAtSquare
    let isLegalMove = false;
    
    // If the move is in the list from getMovesAtSquare, it's definitely legal
    if (moves && moves.includes(targetSquare)) {
      isLegalMove = true;
    } else {
      // For moves not in the list, we'll do a more direct check
      // This is especially important for moves that block check
      
      // Save current state
      const currentFEN = game.getFEN();
      
      // Try to make the move directly and see if it's valid
      // This is more reliable than just checking the list of moves
      const moveResult = game.move(dragSourceSquare, targetSquare);
      
      // If the move was made successfully, it's legal
      if (moveResult) {
        isLegalMove = true;
        console.log(`[PEEK] Move ${dragSourceSquare}-${targetSquare} validated directly as legal`);
        
        // Restore position
        game.setFEN(currentFEN);
      }
    }
    
    // Skip peek calculations if not a legal move after all checks
    if (!isLegalMove) return;
    
    // Only process if this is a different square than last time
    if (targetSquare === lastHoveredSquare) return;
    
    // Ensure we completely clean up previous state before showing new one
    clearPeekVisualizations();
    resetChessPieceOpacity();
    
    // Update the last hovered square
    lastHoveredSquare = targetSquare;
    
    // Use throttling to prevent too many calculations
    const now = Date.now();
    if (isPeekCalculating || (lastPeekCalculationTime && (now - lastPeekCalculationTime) <= PEEK_THROTTLE_DELAY)) {
      // Even if we're throttling actual calculations, we can still check the cache
      // This makes the UX feel more responsive
      const cacheKey = `${dragSourceSquare}_${targetSquare}`;
      if (peekResultCache.has(cacheKey)) {
        // We can use the cached result without waiting
        const cachedResult = peekResultCache.get(cacheKey);
        showPeekResult(cachedResult);
        return;
      }
      return; // Skip if not in cache and we're still throttling
    }
    
    // Update the timestamp and set calculating flag
    lastPeekCalculationTime = now;
    isPeekCalculating = true;
    
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      simulateMoveAndShowResponse(dragSourceSquare, targetSquare);
      isPeekCalculating = false;
    });
  }
  
  // Helper function to handle pointer release (both mouse and touch)
  function handlePointerUp(e) {
    // For touch events, check if we were dragging
    if (e.type === 'touchend' && !isTouchDragging) {
      // Not dragging, this was just a tap - don't clear highlighting yet
      isTouchDragging = false;
      return;
    }
    
    // Reset touch tracking
    isTouchDragging = false;
    lastTouchSquare = null;
    
    // Clear drag source tracking
    dragSourceSquare = null;
    
    // Always clear any self-capture highlights when dragging ends
    document.querySelectorAll('.cm-chessboard .square.self-capture-highlight').forEach(sq => {
      sq.classList.remove('self-capture-highlight');
      sq.removeAttribute('data-self-capture');
    });
    
    // Only clean up Peek-related stuff if Peek mode is enabled
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
  }
  
  // Create a special handler for compatibility with CM-Chessboard's touch events
  function handleChessboardTouchEvents() {
    // Find the chessboard's DOM container
    const boardElement = document.querySelector('.cm-chessboard');
    if (!boardElement) return;
    
    // Add a passive touchstart listener to capture the square before CM-Chessboard processes it
    boardElement.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      
      if (element && element.classList.contains('square')) {
        lastTouchSquare = element.getAttribute('data-square');
        dragSourceSquare = lastTouchSquare;
        
        // Since this is passive, we can't prevent default, but we track that a touch started
        isTouchDragging = false;
      } else if (element && element.closest('.piece')) {
        // If touching a piece, find its square
        const pieceElement = element.closest('.piece');
        const square = pieceElement.getAttribute('data-square');
        if (square) {
          lastTouchSquare = square;
          dragSourceSquare = square;
          isTouchDragging = false;
        }
      }
    }, { passive: true });
  }
  
  // Track the start of drag operations - mouse
  document.addEventListener('mousedown', (e) => {
    const target = e.target;
    if (target && target.classList.contains('square')) {
      dragSourceSquare = target.getAttribute('data-square');
    } else if (target && target.closest('.square')) {
      // The target might be a piece inside a square
      const square = target.closest('.square');
      dragSourceSquare = square.getAttribute('data-square');
    }
  });
  
  // Mouse move listener
  document.addEventListener('mousemove', handlePointerMove);
  
  // Mouse up listener
  document.addEventListener('mouseup', handlePointerUp);
  
  // Touch event support
  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (target && target.classList.contains('square')) {
      dragSourceSquare = target.getAttribute('data-square');
      lastTouchSquare = dragSourceSquare;
    } else if (target && target.closest('.square')) {
      // The target might be a piece inside a square
      const square = target.closest('.square');
      dragSourceSquare = square.getAttribute('data-square');
      lastTouchSquare = dragSourceSquare;
    }
  }, { passive: false });
  
  // Touch move listener with non-passive option to allow preventDefault
  document.addEventListener('touchmove', (e) => {
    // Prevent page scrolling when dragging pieces
    if (dragSourceSquare) {
      e.preventDefault();
    }
    handlePointerMove(e);
  }, { passive: false });
  
  // Touch end listener
  document.addEventListener('touchend', handlePointerUp);
  
  // Setup CM-Chessboard specific touch handlers
  handleChessboardTouchEvents();
  
  // On window resize, clear any peek visualizations to avoid misaligned elements
  window.addEventListener('resize', () => {
    clearPeekVisualizations();
    resetChessPieceOpacity();
  });
});

// Helper function to find element below draggable piece without hiding it
function elementFromPointWithDraggable(x, y, draggablePiece) {
  // If no draggable piece is provided, just return the element at the point
  if (!draggablePiece) {
    return document.elementFromPoint(x, y);
  }
  
  // Find all draggable elements to make them temporarily transparent to pointer events
  const draggableElements = [
    draggablePiece,
    document.querySelector('.cm-chessboard-draggable-piece'),
    document.querySelector('.cm-chessboard .dragging')
  ].filter(el => el); // Filter out null/undefined elements
  
  // Save current styles to restore later
  const originalStyles = draggableElements.map(el => ({
    element: el,
    pointerEvents: el.style.pointerEvents,
    zIndex: el.style.zIndex
  }));
  
  // Make draggable elements "transparent" to mouse/touch events
  draggableElements.forEach(el => {
    el.style.pointerEvents = 'none';
  });
  
  // Get the element below
  const element = document.elementFromPoint(x, y);
  
  // Restore original styles
  originalStyles.forEach(item => {
    item.element.style.pointerEvents = item.pointerEvents;
    item.element.style.zIndex = item.zIndex;
  });
  
  return element;
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

// Add Peek button event listener
peekButton.addEventListener("click", () => {
  // When turning off Peek mode, clean up everything first
  if (peekModeEnabled) {
    // Fully clean up any peek visualizations
    clearPeekVisualizations();
    
    // Reset all the state variables
    isPeekCalculating = false;
    lastPeekCalculationTime = null;
    currentPeekArrow = null;
    lastHoveredSquare = null;
    
    // Clear the cache to avoid stale results when re-enabling
    peekResultCache.clear();
  }
  
  // Toggle the mode flag
  peekModeEnabled = !peekModeEnabled;
  
  // Update button appearance
  if (peekModeEnabled) {
    peekButton.classList.add("peek-active");
    peekButton.innerHTML = "👁️ Peek [ON]";
    
    // Show notification
    const notification = document.createElement('div');
    notification.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background-color:#007bff;color:white;padding:10px 20px;border-radius:5px;z-index:9999;box-shadow:0 2px 10px rgba(0,0,0,0.2);';
    notification.textContent = 'Peek Mode Activated';
    document.body.appendChild(notification);
    
    // Fade out notification
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 1s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 1000);
    }, 2000);
  } else {
    peekButton.classList.remove("peek-active");
    peekButton.innerHTML = "👁️ Peek";
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
  // Create a cache key
  const cacheKey = `${fromSquare}_${toSquare}`;
  
  // Check if we have this result cached
  if (peekResultCache.has(cacheKey)) {
    // Use cached result
    const cachedResult = peekResultCache.get(cacheKey);
    
    // Clear any existing visualizations
    clearPeekVisualizations();
    
    // Show the cached result
    showPeekResult(cachedResult);
    return;
  }
  
  // Save the current game state
  const currentFEN = game.getFEN();
  
  // Clear any existing visualizations
  clearPeekVisualizations();
  
  // Reset opacity of all pieces to ensure we don't have leftover transparency
  resetChessPieceOpacity();
  
  // Store the current peek state
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
    
    // Create an object to store the results for caching
    const peekResult = {
      playerFrom: fromSquare,
      playerTo: toSquare,
      playerPiece: sourcePiece,
    };
    
    // Try to make the move
    const moveResult = game.move(fromSquare, toSquare);
    
    if (moveResult) {
      // Log the position after player's move
      const afterPlayerMoveFEN = game.getFEN();
      
      // Add a DOM element to capture console logs
      const logCapture = document.createElement('div');
      logCapture.id = 'peek-log-capture';
      logCapture.style.display = 'none';
      document.body.appendChild(logCapture);
      
      // Capture console.log output temporarily
      const originalConsoleLog = console.log;
      console.log = function() {
        // Call the original console.log
        originalConsoleLog.apply(console, arguments);
        
        // Capture the log message
        const logMessage = Array.from(arguments).join(' ');
        const logEntry = document.createElement('div');
        logEntry.textContent = logMessage;
        logCapture.appendChild(logEntry);
      };
      
      // If move is valid, calculate AI's response
      const aiMoveResult = game.makeAIMove();
      
      // Restore original console.log
      console.log = originalConsoleLog;
      
      // Extract engine logs and look for "Best:" moves
      const engineLogs = Array.from(logCapture.children)
        .map(node => node.textContent)
        .filter(text => text.includes('Best:'));
      
      // Remove the log capture element
      document.body.removeChild(logCapture);
      
      // Get the position after AI's move
      const afterAIMoveFEN = game.getFEN();
      
      if (aiMoveResult) {
        // First try to extract the move directly from engine log using regex
        let capturedBestMove = false;
        let aiFromSquare, aiToSquare;
        let isCapture = false;
        
        // Try to find the deepest search with a Best move
        if (engineLogs.length > 0) {
          console.log(`[PEEK] Found ${engineLogs.length} engine logs with Best move`);
          
          // Sort by depth (D:4 is deeper than D:1)
          engineLogs.sort((a, b) => {
            const depthA = parseInt(a.match(/D:(\d+)/)?.[1] || "0");
            const depthB = parseInt(b.match(/D:(\d+)/)?.[1] || "0");
            return depthB - depthA; // Sort by descending depth
          });
          
          // Get the deepest search result
          const deepestLog = engineLogs[0];
          console.log(`[PEEK] Using deepest engine log: ${deepestLog}`);
          
          // Extract the best move using regex
          const bestMoveMatch = deepestLog.match(/Best:([a-h][1-8][a-h][1-8])/);
          if (bestMoveMatch && bestMoveMatch.length > 1) {
            const bestMove = bestMoveMatch[1];
            aiFromSquare = bestMove.substring(0, 2);
            aiToSquare = bestMove.substring(2, 4);
            console.log(`[PEEK] Extracted AI move from engine logs: ${aiFromSquare} to ${aiToSquare}`);
            
            // Check if this is a capture by seeing if there's a piece at the destination
            const targetPiece = getPieceAtSquare(afterPlayerMoveFEN, aiToSquare);
            if (targetPiece) {
              isCapture = true;
              console.log(`[PEEK] Detected that AI move is a capture - target square ${aiToSquare} has piece ${targetPiece}`);
            }
            
            capturedBestMove = true;
          }
        }
        
        // Fallback to traditional move detection if we couldn't parse the Best move
        if (!capturedBestMove) {
          console.log("[PEEK] Falling back to move detection from board differences");
          
          // Use our detection function to find the actual squares that changed
          const actualMove = detectActualMove(afterPlayerMoveFEN, afterAIMoveFEN);
          
          // Restore the original position
          game.setFEN(currentFEN);
          
          if (actualMove) {
            aiFromSquare = actualMove.from;
            aiToSquare = actualMove.to;
            
            // Check if this was a capture by looking for a piece at the destination in the previous position
            const targetPiece = getPieceAtSquare(afterPlayerMoveFEN, aiToSquare);
            if (targetPiece) {
              isCapture = true;
              console.log(`[PEEK] Detected capture from board differences - target square ${aiToSquare} had piece ${targetPiece}`);
            }
          } else {
            // Fallback method if detection fails
            if (aiMoveResult === "O-O" || aiMoveResult === "O-O-O") {
              // Handle castling
              const side = afterPlayerMoveFEN.split(' ')[1]; // 'w' or 'b'
              
              if (side === 'w') {
                aiFromSquare = 'e1';
                aiToSquare = aiMoveResult === "O-O" ? 'g1' : 'c1';
              } else {
                aiFromSquare = 'e8';
                aiToSquare = aiMoveResult === "O-O" ? 'g8' : 'c8';
              }
              
              // Update the peek state and result object
              currentPeekArrow.isCastling = true;
              peekResult.isCastling = true;
              
              // Also handle rook movement for castling
              const rookFromSquare = aiMoveResult === "O-O" ? 
                (side === 'w' ? 'h1' : 'h8') : 
                (side === 'w' ? 'a1' : 'a8');
              const rookToSquare = aiMoveResult === "O-O" ? 
                (side === 'w' ? 'f1' : 'f8') : 
                (side === 'w' ? 'd1' : 'd8');
              const rookPiece = side === 'w' ? 'R' : 'r';
              
              // Update the peek state and result object with rook info
              currentPeekArrow.aiRookFrom = rookFromSquare;
              currentPeekArrow.aiRookTo = rookToSquare;
              currentPeekArrow.aiRookPiece = rookPiece;
              
              peekResult.aiRookFrom = rookFromSquare;
              peekResult.aiRookTo = rookToSquare;
              peekResult.aiRookPiece = rookPiece;
            } else {
              // Handle normal moves and captures
              const movePattern = /([a-h][1-8])([-x])([a-h][1-8])/;
              const match = aiMoveResult.match(movePattern);
              
              if (match && match.length === 4) {
                aiFromSquare = match[1];
                aiToSquare = match[3];
                
                // Check if this is a capture
                isCapture = match[2] === 'x';
              }
            }
          }
        }
        
        // Save capture state
        currentPeekArrow.isCapture = isCapture;
        peekResult.isCapture = isCapture;
        
        // Restore the original position
        game.setFEN(currentFEN);
        
        // Get the AI piece at the source square
        if (aiFromSquare && aiToSquare) {
          const aiPiece = getPieceAtSquare(position, aiFromSquare);
          
          if (aiPiece) {
            // Update the peek state with AI move information
            currentPeekArrow.aiFrom = aiFromSquare;
            currentPeekArrow.aiTo = aiToSquare;
            currentPeekArrow.aiPiece = aiPiece;
            
            // Add to the result object for caching
            peekResult.aiFrom = aiFromSquare;
            peekResult.aiTo = aiToSquare;
            peekResult.aiPiece = aiPiece;
            
            // Show a ghost of the AI's piece at its destination
            showGhostPiece(aiPiece, aiToSquare, 'ai');
            
            // If this is castling, also show the rook move
            if (currentPeekArrow.isCastling && currentPeekArrow.aiRookPiece) {
              showGhostPiece(currentPeekArrow.aiRookPiece, currentPeekArrow.aiRookTo, 'ai-secondary');
            }
          }
        }
        
        // Cache the result
        if (peekResultCache.size >= MAX_CACHE_SIZE) {
          // Remove the oldest entry if cache is full
          const firstKey = peekResultCache.keys().next().value;
          peekResultCache.delete(firstKey);
        }
        peekResultCache.set(cacheKey, peekResult);
      } else {
        // Restore the original position
        game.setFEN(currentFEN);
        
        // Cache the player-only move
        peekResultCache.set(cacheKey, peekResult);
      }
    } else {
      // Invalid move, clear any visualizations
      clearPeekVisualizations();
    }
  }
}

// Helper function to show peek results from cache
function showPeekResult(result) {
  console.log(`[PEEK] Showing peek result from cache:`, JSON.stringify(result));
  
  // First, ensure ALL previous transparency effects are completely cleared
  // Not just removing ghost pieces, but also resetting ALL piece opacity
  document.querySelectorAll('.cm-chessboard .piece[style*="opacity"]').forEach(piece => {
    piece.style.opacity = '';
  });
  // Clear any peek source classes
  document.querySelectorAll('.peek-source-square').forEach(sq => {
    sq.classList.remove('peek-source-square');
  });
  
  // Set current peek arrow state
  currentPeekArrow = result;
  
  // Show player ghost piece
  if (result.playerPiece && result.playerTo) {
    showGhostPiece(result.playerPiece, result.playerTo, 'player');
  }
  
  // Show AI ghost piece if available
  if (result.aiPiece && result.aiTo) {
    showGhostPiece(result.aiPiece, result.aiTo, 'ai');
  }
  
  // Show rook for castling if needed
  if (result.aiRookPiece && result.aiRookTo) {
    showGhostPiece(result.aiRookPiece, result.aiRookTo, 'ai-secondary');
  }
}

// Function to show a ghost piece at a specific square
function showGhostPiece(piece, square, type = 'player') {
  // Check if this move is a capture by the AI
  const isCapture = type === 'ai' && currentPeekArrow?.isCapture === true;
  console.log(`[PEEK] Showing ghost piece: ${piece} at ${square}, type: ${type}, is${isCapture ? '' : ' not'} a capture`);
  console.log(`[PEEK] Current peek data:`, JSON.stringify(currentPeekArrow));
  
  // Find the target square
  const targetSquare = document.querySelector(`.cm-chessboard .board .square[data-square="${square}"]`);
  if (!targetSquare) {
    console.log(`[PEEK] Target square element not found: ${square}`);
    return;
  }
  
  // Get the board size and calculate the piece size
  const boardEl = document.getElementById('board');
  const boardRect = boardEl.getBoundingClientRect();
  const boardSize = boardRect.width;
  const squareSize = boardSize / 8;
  
  // Check if there's already a ghost piece for this square and type
  const existingGhost = document.querySelector(`.peek-ghost-piece.peek-${type}[data-square="${square}"]`);
  if (existingGhost) {
    console.log(`[PEEK] Ghost piece already exists for ${square}, type ${type}`);
    // If we already have a ghost piece for this square, just return
    return;
  }
  
  // Clear any existing source piece transparency
  // This ensures we only have transparency on the squares directly related to the current ghost piece
  document.querySelectorAll('.peek-source-square').forEach(square => {
    // Only remove if not related to current peek arrow
    const squareCoord = square.getAttribute('data-square');
    if ((type === 'player' && currentPeekArrow?.playerFrom !== squareCoord) ||
        (type === 'ai' && currentPeekArrow?.aiFrom !== squareCoord) ||
        (type === 'ai-secondary' && currentPeekArrow?.aiRookFrom !== squareCoord)) {
      square.classList.remove('peek-source-square');
      square.querySelectorAll('[style*="opacity"]').forEach(el => {
        el.style.opacity = '';
      });
    }
  });
  
  // Create a ghost piece element
  const ghostPiece = document.createElement('div');
  ghostPiece.className = `peek-ghost-piece peek-${type}`;
  ghostPiece.setAttribute('data-piece', piece);
  ghostPiece.setAttribute('data-square', square);
  
  // Determine the class for the specific piece
  const pieceClass = piece.toUpperCase() === piece ? 'w' : 'b';
  const pieceType = piece.toLowerCase();
  
  // Prepare all styles in a batch to reduce reflows
  const styles = {
    position: 'absolute',
    width: `${squareSize}px`,
    height: `${squareSize}px`,
    opacity: type === 'player' ? '0.9' : '0.85',
    zIndex: '100',
    pointerEvents: 'none',
    borderRadius: '50%'
  };
  
  // Different border colors for player vs AI ghosts
  const borderColor = type === 'player' ? '#3498db' : '#e74c3c';
  const glowColor = type === 'player' ? 'rgba(52, 152, 219, 0.6)' : 'rgba(231, 76, 60, 0.6)';
  
  // Add border and shadow
  styles.border = `2px solid ${borderColor}`;
  styles.boxShadow = `0 0 10px ${glowColor}`;
  
  // Calculate the position of the square
  const squareRect = targetSquare.getBoundingClientRect();
  const left = squareRect.left - boardRect.left;
  const top = squareRect.top - boardRect.top;
  styles.left = `${left}px`;
  styles.top = `${top}px`;
  
  // Apply all styles at once to reduce reflows
  Object.assign(ghostPiece.style, styles);
  
  // Create a direct piece element
  const pieceSVG = document.createElement('div');
  pieceSVG.className = 'ghost-piece-svg';
  pieceSVG.style.cssText = 'width:100%;height:100%;';
  
  // Create the piece image
  const pieceImg = document.createElement('img');
  pieceImg.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;';
  
  // Set the image source
  const pieceName = `${pieceClass}${pieceType.toUpperCase()}`;
  pieceImg.src = `img/chesspieces/wikipedia/${pieceName}.png`;
  
  // Add fallback for image load errors
  pieceImg.onerror = () => {
    pieceSVG.style.backgroundImage = `url('assets/images/chessboard-sprite-staunty.svg')`;
    pieceSVG.style.backgroundSize = '400%';
    
    // Set background position based on piece type
    const positions = {
      'wp': '0 0', 'wn': '-100% 0', 'wb': '-200% 0', 'wr': '-300% 0',
      'wq': '0 -100%', 'wk': '-100% -100%', 'bp': '-200% -100%', 'bn': '-300% -100%',
      'bb': '0 -200%', 'br': '-100% -200%', 'bq': '-200% -200%', 'bk': '-300% -200%'
    };
    pieceSVG.style.backgroundPosition = positions[`${pieceClass}${pieceType}`] || '0 0';
  };
  
  // Build the DOM structure
  pieceSVG.appendChild(pieceImg);
  ghostPiece.appendChild(pieceSVG);
  
  // Find the board container and add the ghost piece
  const boardContainer = boardEl.closest('.board-container');
  if (boardContainer) {
    boardContainer.appendChild(ghostPiece);
    
    // Handle piece transparency (optimize by organizing by piece type)
    let sourceSquare;
    
    if (type === 'player' && currentPeekArrow?.playerFrom) {
      sourceSquare = currentPeekArrow.playerFrom;
      console.log(`[PEEK] Using player source square: ${sourceSquare}`);
    } else if (type === 'ai' && currentPeekArrow?.aiFrom) {
      sourceSquare = currentPeekArrow.aiFrom;
      const moveType = isCapture ? "capture" : "move";
      console.log(`[PEEK] Using AI source square: ${sourceSquare}, moveType: ${moveType}`);
    } else if (type === 'ai-secondary' && currentPeekArrow?.aiRookFrom) {
      sourceSquare = currentPeekArrow.aiRookFrom;
      console.log(`[PEEK] Using AI rook source square: ${sourceSquare}`);
    }
    
    if (sourceSquare) {
      fadeSourcePiece(sourceSquare);
    } else {
      console.log(`[PEEK] No source square found for ${type} ghost piece`);
    }
  }
}

// Split out the piece fading to a separate function for better performance
function fadeSourcePiece(sourceSquare) {
  console.log(`[PEEK] Attempting to fade source piece at ${sourceSquare}`);
  
  const squareEl = document.querySelector(`.cm-chessboard .board .square[data-square="${sourceSquare}"]`);
  if (!squareEl) {
    console.log(`[PEEK] Square element not found for ${sourceSquare}`);
    return;
  }
  
  // Mark the square with a class for easier selection and cleanup
  squareEl.classList.add('peek-source-square');
  
  // 1. First try using the class-based approach as it's most efficient
  // CSS will handle the opacity through the class
  
  // 2. As a fallback, also find direct piece elements and set opacity
  const pieceLayers = squareEl.querySelectorAll('.piece, .draggable-source');
  if (pieceLayers.length > 0) {
    console.log(`[PEEK] Found ${pieceLayers.length} direct piece layers to fade for ${sourceSquare}`);
    pieceLayers.forEach(pieceLayer => {
      pieceLayer.style.opacity = '0.3';
      console.log(`[PEEK] Applied opacity 0.3 to piece layer: ${pieceLayer.className}`);
    });
    return; // If we found and updated pieces, we're done
  }
  
  console.log(`[PEEK] No direct piece layers found, using fallback approach for ${sourceSquare}`);
  
  // 3. If still not successful, try the most specific approach
  setChessPieceOpacity(sourceSquare, 0.3);
}

// Helper function to directly set opacity on SVG pieces in the chessboard
function setChessPieceOpacity(square, opacity) {
  console.log(`[PEEK] Setting piece opacity for square ${square} to ${opacity}`);
  
  // First, try the direct SVG use element approach (which is what CM-Chessboard uses)
  const pieceElements = document.querySelectorAll(`.cm-chessboard .board .square[data-square="${square}"] use, 
                                                   .cm-chessboard .board .square[data-square="${square}"] .piece,
                                                   .cm-chessboard .piece[data-square="${square}"]`);
  
  if (pieceElements.length > 0) {
    console.log(`[PEEK] Found ${pieceElements.length} direct piece elements`);
    pieceElements.forEach((element, index) => {
      // For SVG elements, we need to modify the style attribute
      if (element instanceof SVGElement) {
        // If it's an SVG element, we can use the style.opacity
        element.style.opacity = opacity;
        console.log(`[PEEK] Set opacity on SVG element #${index}: ${element.tagName}`);
        
        // For 'use' elements in SVG, also try setting attributes directly
        if (element.tagName.toLowerCase() === 'use') {
          element.setAttribute('opacity', opacity);
          console.log(`[PEEK] Also set opacity attribute on SVG use element #${index}`);
        }
      } else {
        // For regular HTML elements
        element.style.opacity = opacity;
        console.log(`[PEEK] Set opacity on HTML element #${index}: ${element.tagName}${element.className ? ' class=' + element.className : ''}`);
      }
    });
  } else {
    console.log(`[PEEK] No direct piece elements found, trying piece layer`);
  }
  
  // Also try finding the piece via the piece layer in the chessboard
  const pieceLayer = document.querySelector(`.cm-chessboard .pieces .piece[data-square="${square}"]`);
  if (pieceLayer) {
    pieceLayer.style.opacity = opacity;
    console.log(`[PEEK] Found and set opacity on piece layer for ${square}`);
    
    // If it has child SVG elements, set their opacity too
    const svgElements = pieceLayer.querySelectorAll('svg, use, g, path');
    console.log(`[PEEK] Found ${svgElements.length} SVG child elements in piece layer`);
    svgElements.forEach((svg, index) => {
      if (svg instanceof SVGElement) {
        svg.style.opacity = opacity;
        svg.setAttribute('opacity', opacity);
        console.log(`[PEEK] Set opacity on SVG child element #${index}: ${svg.tagName}`);
      }
    });
  } else {
    console.log(`[PEEK] No piece layer found for ${square}, trying data-square selector`);
  }
  
  // One more approach - try finding any elements with the square attribute
  const dataSquareElements = document.querySelectorAll(`[data-square="${square}"]`);
  console.log(`[PEEK] Found ${dataSquareElements.length} elements with data-square="${square}"`);
  
  dataSquareElements.forEach((element, index) => {
    // If it's a piece or contains a piece representation
    if (element.classList.contains('piece') || 
        element.querySelector('.piece') || 
        element.closest('.pieces')) {
      
      element.style.opacity = opacity;
      console.log(`[PEEK] Set opacity on data-square element #${index}: ${element.tagName}${element.className ? ' class=' + element.className : ''}`);
      
      // Set opacity on all children
      const children = element.querySelectorAll('*');
      console.log(`[PEEK] Found ${children.length} child elements to set opacity on`);
      
      children.forEach((child, childIndex) => {
        // Skip ghost pieces
        if (!child.closest('.peek-ghost-piece')) {
          child.style.opacity = opacity;
          
          // For SVG elements
          if (child instanceof SVGElement) {
            child.setAttribute('opacity', opacity);
            if (childIndex < 5) { // Only log first few to avoid console spam
              console.log(`[PEEK] Set opacity on child SVG element #${childIndex}: ${child.tagName}`);
            }
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
  // Use specific selectors instead of general ones for better performance
  
  // 1. Remove ghost pieces - do this first as it's the most visible change
  const ghostPieces = document.querySelectorAll('.peek-ghost-piece');
  if (ghostPieces.length > 0) {
    ghostPieces.forEach(ghost => {
      if (ghost.parentNode) {
        ghost.parentNode.removeChild(ghost);
      }
    });
  }
  
  // 2. Clear arrows
  if (arrows) {
    arrows.removeArrows();
  }
  
  // 3. Reset source square opacity with the helper function
  // which handles both class-based and inline style approaches
  document.querySelectorAll('.peek-source-square').forEach(square => {
    square.classList.remove('peek-source-square');
    
    // Find pieces within this square and reset opacity
    const pieces = square.querySelectorAll('.piece, [style*="opacity"]');
    pieces.forEach(piece => {
      piece.style.opacity = '';
    });
  });
  
  // 4. Reset all chess piece opacity using more targeted selectors
  const pieceElements = document.querySelectorAll('.cm-chessboard .piece[style*="opacity"]');
  if (pieceElements.length > 0) {
    pieceElements.forEach(piece => {
      piece.style.opacity = '';
    });
  }
  
  // 5. Clear peek highlights
  clearPeekHighlights();
  
  // Reset state variables to ensure clean slate
  currentPeekArrow = null;
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

// Function to clear the peek cache when board position changes
function clearPeekCache() {
  // Clear the peek result cache when the board position changes
  // This avoids stale results when the game state changes
  peekResultCache.clear();
  
  // Also reset any ongoing peek state
  isPeekCalculating = false;
  lastPeekCalculationTime = null;
  currentPeekArrow = null;
  lastHoveredSquare = null;
}

// Add event listeners to clear cache when position changes
makeMove.addEventListener("click", clearPeekCache);
reset.addEventListener("click", clearPeekCache);

// Clear cache when any move is made through the board interface
const originalValidateMoveInput = window.inputHandler;
window.inputHandler = function(event) {
  if (event.type === INPUT_EVENT_TYPE.validateMoveInput) {
    // Clear cache when a move is made on the board
    clearPeekCache();
  }
  return originalValidateMoveInput(event);
};
