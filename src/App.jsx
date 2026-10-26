import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, Pause, RefreshCw, Wand2, Lightbulb, RotateCcw, RotateCw, 
  Trash2, Eye, Sun, Moon, CheckCircle2, AlertCircle, Sparkles, Volume2, VolumeX, FastForward
} from 'lucide-react';

// --- SUDOKU UTILITIES & ALGORITHMS ---

// Check if placing num at board[row][col] is valid
const isValidPlacement = (board, row, col, num) => {
  for (let i = 0; i < 9; i++) {
    // Check row
    if (board[row][i] === num && i !== col) return false;
    // Check col
    if (board[i][col] === num && i !== row) return false;
    // Check 3x3 box
    const boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
    const boxCol = 3 * Math.floor(col / 3) + (i % 3);
    if (board[boxRow][boxCol] === num && (boxRow !== row || boxCol !== col)) return false;
  }
  return true;
};

// Find empty cell with Minimum Remaining Values (MRV Heuristic)
const findBestEmptyCell = (board) => {
  let minCandidates = 10;
  let bestCell = null;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        let candidates = 0;
        for (let num = 1; num <= 9; num++) {
          if (isValidPlacement(board, r, c, num)) {
            candidates++;
          }
        }
        if (candidates < minCandidates) {
          minCandidates = candidates;
          bestCell = [r, c];
        }
      }
    }
  }
  return bestCell;
};

// Backtracking Solver (Returns solved board or null)
const solveSudokuRecursive = (board) => {
  const cell = findBestEmptyCell(board);
  if (!cell) return true; // Fully solved

  const [row, col] = cell;
  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  for (let num of nums) {
    if (isValidPlacement(board, row, col, num)) {
      board[row][col] = num;
      if (solveSudokuRecursive(board)) return true;
      board[row][col] = 0;
    }
  }
  return false;
};

// Count solutions (used to verify unique solution during generation)
const countSolutions = (board, count = { val: 0 }) => {
  const cell = findBestEmptyCell(board);
  if (!cell) {
    count.val += 1;
    return count.val;
  }

  const [row, col] = cell;
  for (let num = 1; num <= 9; num++) {
    if (isValidPlacement(board, row, col, num)) {
      board[row][col] = num;
      countSolutions(board, count);
      board[row][col] = 0;
      if (count.val >= 2) return count.val; // Stop early if multiple solutions found
    }
  }
  return count.val;
};

// Shuffle array helper
const shuffle = (arr) => {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Generate Full Solved Board
const generateFullBoard = () => {
  const board = Array(9).fill(0).map(() => Array(9).fill(0));
  
  const fillBoard = (b) => {
    const cell = findBestEmptyCell(b);
    if (!cell) return true;
    const [row, col] = cell;
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (let num of nums) {
      if (isValidPlacement(b, row, col, num)) {
        b[row][col] = num;
        if (fillBoard(b)) return true;
        b[row][col] = 0;
      }
    }
    return false;
  };

  fillBoard(board);
  return board;
};

// Generate Puzzle by removing numbers based on difficulty
const generatePuzzle = (difficulty) => {
  const fullBoard = generateFullBoard();
  const puzzle = fullBoard.map(row => [...row]);

  // Clues count target based on difficulty
  let targetClues = 40;
  if (difficulty === 'Medium') targetClues = 32;
  if (difficulty === 'Hard') targetClues = 26;
  if (difficulty === 'Expert') targetClues = 22;

  let cellsToRemove = 81 - targetClues;
  const positions = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  const shuffledPositions = shuffle(positions);

  for (let [r, c] of shuffledPositions) {
    if (cellsToRemove <= 0) break;

    const temp = puzzle[r][c];
    puzzle[r][c] = 0;

    // Test for unique solution
    const boardCopy = puzzle.map(row => [...row]);
    if (countSolutions(boardCopy) !== 1) {
      puzzle[r][c] = temp; // Revert if not unique
    } else {
      cellsToRemove--;
    }
  }

  return { puzzle, solution: fullBoard };
};

export default function App() {
  // --- STATE ---
  const [board, setBoard] = useState(Array(9).fill(0).map(() => Array(9).fill(0)));
  const [initialBoard, setInitialBoard] = useState(Array(9).fill(0).map(() => Array(9).fill(0)));
  const [solutionBoard, setSolutionBoard] = useState(Array(9).fill(0).map(() => Array(9).fill(0)));
  const [pencilNotes, setPencilNotes] = useState(
    Array(9).fill(0).map(() => Array(9).fill(0).map(() => new Set()))
  );
  
  const [selectedCell, setSelectedCell] = useState([0, 0]);
  const [difficulty, setDifficulty] = useState('Medium');
  const [isPencilMode, setIsPencilMode] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [isSolvingVisual, setIsSolvingVisual] = useState(false);
  const [solveSpeed, setSolveSpeed] = useState(20); // ms per step
  
  // History for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  // Status & Hints
  const [message, setMessage] = useState({ type: '', text: '' });
  const [highlightNum, setHighlightNum] = useState(null);

  const visualSolveRef = useRef(false);

  // --- START NEW GAME ---
  const startNewGame = useCallback((diff = difficulty) => {
    visualSolveRef.current = false;
    setIsSolvingVisual(false);
    
    const { puzzle, solution } = generatePuzzle(diff);
    setBoard(puzzle.map(r => [...r]));
    setInitialBoard(puzzle.map(r => [...r]));
    setSolutionBoard(solution);
    setPencilNotes(Array(9).fill(0).map(() => Array(9).fill(0).map(() => new Set())));
    setSelectedCell([0, 0]);
    setIsSolved(false);
    setTimer(0);
    setIsTimerRunning(true);
    setHistory([]);
    setHistoryIdx(-1);
    setMessage({ type: 'info', text: `New ${diff} game started. Good luck!` });
  }, [difficulty]);

  useEffect(() => {
    startNewGame('Medium');
  }, []);

  // --- TIMER HANDLER ---
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && !isSolved) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, isSolved]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- STATE PUSH TO HISTORY ---
  const pushStateToHistory = (newBoard, newPencil) => {
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push({
      board: newBoard.map(r => [...r]),
      pencilNotes: newPencil.map(r => r.map(cellSet => new Set(cellSet)))
    });
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  };

  // --- UNDO / REDO ---
  const handleUndo = () => {
    if (historyIdx > 0) {
      const prev = history[historyIdx - 1];
      setBoard(prev.board.map(r => [...r]));
      setPencilNotes(prev.pencilNotes.map(r => r.map(s => new Set(s))));
      setHistoryIdx(historyIdx - 1);
    } else if (historyIdx === 0) {
      setBoard(initialBoard.map(r => [...r]));
      setPencilNotes(Array(9).fill(0).map(() => Array(9).fill(0).map(() => new Set())));
      setHistoryIdx(-1);
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setBoard(next.board.map(r => [...r]));
      setPencilNotes(next.pencilNotes.map(r => r.map(s => new Set(s))));
      setHistoryIdx(historyIdx + 1);
    }
  };

  // Check Game Completion
  const checkCompletion = (currentBoard) => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (currentBoard[r][c] === 0 || currentBoard[r][c] !== solutionBoard[r][c]) {
          return false;
        }
      }
    }
    return true;
  };

  // --- INPUT HANDLER ---
  const handleNumberInput = (num) => {
    if (isSolved || isSolvingVisual) return;
    const [r, c] = selectedCell;

    // Prevent changing given numbers
    if (initialBoard[r][c] !== 0) return;

    if (isPencilMode) {
      // Toggle Pencil Note
      if (num === 0) return;
      const newPencil = pencilNotes.map(row => row.map(s => new Set(s)));
      if (newPencil[r][c].has(num)) {
        newPencil[r][c].delete(num);
      } else {
        newPencil[r][c].add(num);
      }
      setPencilNotes(newPencil);
      pushStateToHistory(board, newPencil);
    } else {
      // Normal Number Placement
      const newBoard = board.map(row => [...row]);
      newBoard[r][c] = num;
      
      // Clear pencil notes for this cell if filled
      const newPencil = pencilNotes.map(row => row.map(s => new Set(s)));
      if (num !== 0) {
        newPencil[r][c].clear();
      }

      setBoard(newBoard);
      setPencilNotes(newPencil);
      pushStateToHistory(newBoard, newPencil);

      // Check win state
      if (checkCompletion(newBoard)) {
        setIsSolved(true);
        setIsTimerRunning(false);
        setMessage({ type: 'success', text: '🎉 Congratulations! Puzzle Solved Successfully!' });
      } else {
        setMessage({ type: '', text: '' });
      }
    }
  };

  // --- KEYBOARD CONTROLS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSolvingVisual) return;
      const [r, c] = selectedCell;

      if (e.key >= '1' && e.key <= '9') {
        handleNumberInput(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleNumberInput(0);
      } else if (e.key === 'ArrowUp' && r > 0) {
        setSelectedCell([r - 1, c]);
      } else if (e.key === 'ArrowDown' && r < 8) {
        setSelectedCell([r + 1, c]);
      } else if (e.key === 'ArrowLeft' && c > 0) {
        setSelectedCell([r, c - 1]);
      } else if (e.key === 'ArrowRight' && c < 8) {
        setSelectedCell([r, c + 1]);
      } else if (e.key.toLowerCase() === 'n') {
        setIsPencilMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, isPencilMode, isSolvingVisual, history, historyIdx, board]);

  // --- SOLVER ENGINES ---

  // Instant Solver
  const handleInstantSolve = () => {
    visualSolveRef.current = false;
    setIsSolvingVisual(false);

    // Verify if board is valid so far
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0 && !isValidPlacement(board, r, c, board[r][c])) {
          setMessage({ type: 'error', text: 'Invalid board configuration! Clear conflicting numbers.' });
          return;
        }
      }
    }

    const copyBoard = board.map(r => [...r]);
    if (solveSudokuRecursive(copyBoard)) {
      setBoard(copyBoard);
      setIsSolved(true);
      setIsTimerRunning(false);
      setMessage({ type: 'success', text: 'Board Solved Instantly!' });
    } else {
      setMessage({ type: 'error', text: 'No solution exists for the current board configuration.' });
    }
  };

  // Step-by-Step Visual Backtracking Solver
  const handleVisualSolve = async () => {
    if (isSolvingVisual) {
      visualSolveRef.current = false;
      setIsSolvingVisual(false);
      return;
    }

    visualSolveRef.current = true;
    setIsSolvingVisual(true);
    setMessage({ type: 'info', text: 'Visual Backtracking Solver in progress...' });

    const workBoard = board.map(r => [...r]);

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const solveStep = async () => {
      if (!visualSolveRef.current) return false;

      const cell = findBestEmptyCell(workBoard);
      if (!cell) return true; // Solved

      const [r, c] = cell;

      for (let num = 1; num <= 9; num++) {
        if (!visualSolveRef.current) return false;

        if (isValidPlacement(workBoard, r, c, num)) {
          workBoard[r][c] = num;
          setBoard(workBoard.map(row => [...row]));
          setSelectedCell([r, c]);
          
          await delay(solveSpeed);

          if (await solveStep()) return true;

          workBoard[r][c] = 0;
          setBoard(workBoard.map(row => [...row]));
          await delay(solveSpeed);
        }
      }
      return false;
    };

    const success = await solveStep();
    setIsSolvingVisual(false);

    if (success) {
      setIsSolved(true);
      setIsTimerRunning(false);
      setMessage({ type: 'success', text: 'Visual Solve Complete!' });
    } else if (visualSolveRef.current) {
      setMessage({ type: 'error', text: 'Unsolvable board configuration.' });
    } else {
      setMessage({ type: 'info', text: 'Visual solver paused/cancelled.' });
    }
  };

  // --- HINT ENGINE ---
  const handleGetHint = () => {
    if (isSolved || isSolvingVisual) return;

    // Check for logical single candidate first
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0) {
          const candidates = [];
          for (let num = 1; num <= 9; num++) {
            if (isValidPlacement(board, r, c, num)) {
              candidates.push(num);
            }
          }
          if (candidates.length === 1) {
            setSelectedCell([r, c]);
            handleNumberInput(candidates[0]);
            setMessage({ 
              type: 'info', 
              text: `💡 Naked Single Hint: Cell (${r + 1}, ${c + 1}) could only be ${candidates[0]}.` 
            });
            return;
          }
        }
      }
    }

    // Fallback: Reveal actual solution for current selected cell or first empty
    let [r, c] = selectedCell;
    if (board[r][c] !== 0) {
      // Find first empty cell
      let found = false;
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          if (board[i][j] === 0) {
            r = i;
            c = j;
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) return;
    }

    const correctNum = solutionBoard[r][c];
    setSelectedCell([r, c]);
    handleNumberInput(correctNum);
    setMessage({ 
      type: 'info', 
      text: `💡 Solution Hint: Revealed ${correctNum} for cell (${r + 1}, ${c + 1}).` 
    });
  };

  // Reset to initial puzzle
  const handleReset = () => {
    visualSolveRef.current = false;
    setIsSolvingVisual(false);
    setBoard(initialBoard.map(r => [...r]));
    setPencilNotes(Array(9).fill(0).map(() => Array(9).fill(0).map(() => new Set())));
    setIsSolved(false);
    setMessage({ type: 'info', text: 'Board reset to original puzzle.' });
  };

  // Clear Entire Board (for manual board entry mode)
  const handleClearAll = () => {
    visualSolveRef.current = false;
    setIsSolvingVisual(false);
    const empty = Array(9).fill(0).map(() => Array(9).fill(0));
    setBoard(empty);
    setInitialBoard(empty);
    setSolutionBoard(empty);
    setPencilNotes(Array(9).fill(0).map(() => Array(9).fill(0).map(() => new Set())));
    setIsSolved(false);
    setMessage({ type: 'info', text: 'Cleared board for custom puzzle entry.' });
  };

  // Get cell state / highlighting logic
  const getCellStyles = (r, c) => {
    const isSelected = selectedCell[0] === r && selectedCell[1] === c;
    const isGiven = initialBoard[r][c] !== 0;
    const val = board[r][c];
    const isError = val !== 0 && !isValidPlacement(board, r, c, val);
    
    const isSameRowCol = selectedCell[0] === r || selectedCell[1] === c;
    const isSameBox = Math.floor(selectedCell[0] / 3) === Math.floor(r / 3) && 
                      Math.floor(selectedCell[1] / 3) === Math.floor(c / 3);
    const isSameValue = highlightNum && val === highlightNum && val !== 0;

    let baseBg = darkMode ? 'bg-slate-800' : 'bg-white';
    if (isError) baseBg = darkMode ? 'bg-red-950/80' : 'bg-red-100';
    else if (isSelected) baseBg = darkMode ? 'bg-indigo-600' : 'bg-indigo-500';
    else if (isSameValue) baseBg = darkMode ? 'bg-amber-600/50' : 'bg-amber-200';
    else if (isSameRowCol || isSameBox) baseBg = darkMode ? 'bg-slate-700/60' : 'bg-indigo-50/80';

    let textColor = darkMode ? 'text-slate-100' : 'text-slate-800';
    if (isSelected) textColor = 'text-white font-extrabold';
    else if (isGiven) textColor = darkMode ? 'text-sky-400 font-bold' : 'text-sky-600 font-bold';
    else if (isError) textColor = 'text-red-500 font-bold';
    else textColor = darkMode ? 'text-emerald-400 font-semibold' : 'text-emerald-600 font-semibold';

    // Borders for 3x3 subgrids
    const borderR = (c + 1) % 3 === 0 && c < 8 ? (darkMode ? 'border-r-2 border-r-slate-500' : 'border-r-2 border-r-slate-400') : (darkMode ? 'border-r border-r-slate-700/50' : 'border-r border-r-slate-200');
    const borderB = (r + 1) % 3 === 0 && r < 8 ? (darkMode ? 'border-b-2 border-b-slate-500' : 'border-b-2 border-b-slate-400') : (darkMode ? 'border-b border-b-slate-700/50' : 'border-b border-b-slate-200');

    return `${baseBg} ${textColor} ${borderR} ${borderB}`;
  };

  // Count Clues
  const clueCount = board.flat().filter(x => x !== 0).length;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'} font-sans p-4 md:p-8`}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER BAR */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
                Sudoku Engine
              </h1>
              <p className="text-xs text-slate-400">Interactive Solver & Generator</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-xl border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-100'} shadow-sm`}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

            {/* Timer Display */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} font-mono text-base font-medium`}>
              <button onClick={() => setIsTimerRunning(!isTimerRunning)} className="hover:text-indigo-400">
                {isTimerRunning ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
              </button>
              <span>{formatTime(timer)}</span>
            </div>
          </div>
        </header>

        {/* MAIN BODY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: SUDOKU BOARD */}
          <div className="lg:col-span-7 flex flex-col items-center gap-4">
            
            {/* Status Message */}
            {message.text && (
              <div className={`w-full max-w-[450px] p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
                'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
              }`}>
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            {/* 9x9 Board Grid */}
            <div className={`w-full max-w-[450px] aspect-square p-2 rounded-2xl border-2 ${
              darkMode ? 'bg-slate-800 border-slate-700 shadow-2xl' : 'bg-white border-slate-300 shadow-xl'
            } grid grid-cols-9 overflow-hidden`}>
              {board.map((row, r) => 
                row.map((val, c) => (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => {
                      setSelectedCell([r, c]);
                      setHighlightNum(val !== 0 ? val : null);
                    }}
                    className={`relative flex items-center justify-center text-xl font-bold transition-all duration-150 select-none ${getCellStyles(r, c)}`}
                  >
                    {val !== 0 ? (
                      val
                    ) : (
                      // Pencil Notes 3x3 subgrid
                      <div className="grid grid-cols-3 gap-0.5 w-full h-full p-0.5 pointer-events-none">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                          <span key={n} className="text-[8px] leading-none text-slate-400 flex items-center justify-center">
                            {pencilNotes[r][c].has(n) ? n : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Quick Actions Row */}
            <div className="flex items-center justify-between w-full max-w-[450px] px-2 gap-2 text-xs">
              <button
                onClick={handleUndo}
                disabled={historyIdx < 0}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
                  historyIdx >= 0 
                    ? darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-100'
                    : 'opacity-40 cursor-not-allowed border-transparent'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Undo
              </button>

              <button
                onClick={handleRedo}
                disabled={historyIdx >= history.length - 1}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
                  historyIdx < history.length - 1
                    ? darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-100'
                    : 'opacity-40 cursor-not-allowed border-transparent'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" /> Redo
              </button>

              <button
                onClick={() => setIsPencilMode(!isPencilMode)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
                  isPencilMode 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20' 
                    : darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-100'
                }`}
              >
                ✏️ Notes {isPencilMode ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={() => handleNumberInput(0)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-red-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-red-600 hover:bg-slate-100'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" /> Erase
              </button>
            </div>

            {/* NUMPAD */}
            <div className="grid grid-cols-9 gap-1.5 w-full max-w-[450px]">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => handleNumberInput(num)}
                  className={`py-3 rounded-xl font-bold text-lg shadow-sm border transition-all active:scale-95 ${
                    darkMode 
                      ? 'bg-slate-800 border-slate-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-500' 
                      : 'bg-white border-slate-200 hover:bg-indigo-500 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

          </div>

          {/* RIGHT PANEL: CONTROL SUITE & SOLVERS */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* PUZZLE GENERATOR CARD */}
            <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-400" />
                  Puzzle Generator
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20">
                  {clueCount} Clues
                </span>
              </div>

              {/* Difficulty Selector */}
              <div className="grid grid-cols-4 gap-2">
                {['Easy', 'Medium', 'Hard', 'Expert'].map((diff) => (
                  <button
                    key={diff}
                    onClick={() => {
                      setDifficulty(diff);
                      startNewGame(diff);
                    }}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                      difficulty === diff
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                        : darkMode 
                          ? 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700' 
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              <button
                onClick={() => startNewGame(difficulty)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Generate New Puzzle
              </button>
            </div>

            {/* SOLVER ENGINES CARD */}
            <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'} space-y-4`}>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Solver Engine & Hints
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {/* Instant Solve */}
                <button
                  onClick={handleInstantSolve}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    darkMode 
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <FastForward className="w-4 h-4" /> Instant Solve
                </button>

                {/* Logical Hint */}
                <button
                  onClick={handleGetHint}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    darkMode 
                      ? 'bg-amber-600/20 border-amber-500/40 text-amber-400 hover:bg-amber-600/30' 
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Lightbulb className="w-4 h-4" /> Get Hint
                </button>
              </div>

              {/* Visual Solver Controls */}
              <div className="pt-2 border-t border-slate-700/50 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Visual Animation Speed</span>
                  <span className="font-mono">{solveSpeed}ms / step</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={solveSpeed}
                  onChange={(e) => setSolveSpeed(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />

                <button
                  onClick={handleVisualSolve}
                  className={`w-full py-2.5 rounded-xl border font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    isSolvingVisual
                      ? 'bg-red-600 text-white border-red-500 hover:bg-red-500'
                      : darkMode
                        ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-100'
                        : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {isSolvingVisual ? 'Stop Visual Solve' : 'Run Visual Backtracking'}
                </button>
              </div>
            </div>

            {/* BOARD MANAGEMENT CARD */}
            <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'} space-y-3`}>
              <h2 className="text-base font-bold text-slate-400 text-xs uppercase tracking-wider">
                Board Management
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleReset}
                  className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                    darkMode ? 'bg-slate-700/40 border-slate-600 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Reset Board
                </button>
                <button
                  onClick={handleClearAll}
                  className={`py-2 rounded-xl border text-xs font-medium text-red-400 transition-all ${
                    darkMode ? 'bg-slate-700/40 border-slate-600 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Clear Board (Custom Input)
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Footer */}
      <footer
        className={`w-full border-t transition-colors duration-200 py-6 mt-12 ${
          darkMode
            ? 'border-slate-800/80 bg-slate-950/60 text-slate-500 backdrop-blur-md'
            : 'border-slate-200 bg-white/70 text-slate-600 backdrop-blur-md'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            <p
              className={`font-medium ${
                darkMode ? 'text-slate-300' : 'text-slate-800'
              }`}
            >
              Sudoku Engine © {new Date().getFullYear()}</p>
            <p className="mt-0.5">This project is open-source and available under the MIT License.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/50">React</span>
            <span className="bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/50">Vite</span>
            <span className="bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/50">Lucide Icons</span>
            <span className="bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/50">Tailwind CSS</span>
            <span className="bg-slate-800/80 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700/50">Vercel</span>
          </div>
        </div>
      </footer>

    </div>
  );
}