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
