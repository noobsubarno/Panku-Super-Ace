// --- 1. GAME CONTEXT & WALLET STATE ---
let balance = 1000.00;
let betAmount = 10.00;
let currentWin = 0.00;
let multiplierIndex = 0; // 0=1x, 1=2x, 2=3x, 3=5x
const MULTIPLIERS = [1, 2, 3, 5];

const ROWS = 4;
const COLS = 5;
const TILE_SIZE = 90;
const MARGIN = 10;
const REEL_SPEED = 25;

let isGameRunning = false;

// Symbol definitions matching Super Ace pay hierarchy
const SYMBOLS = {
    0: { name: 'J',     color: 0x9B59B6, payout: [0, 0, 0, 0.1, 0.2, 0.5] },
    1: { name: 'Q',     color: 0x2ECC71, payout: [0, 0, 0, 0.1, 0.2, 0.5] },
    2: { name: 'K',     color: 0x3498DB, payout: [0, 0, 0, 0.2, 0.3, 0.8] },
    3: { name: 'A',     color: 0xE74C3C, payout: [0, 0, 0, 0.3, 0.5, 1.2] },
    4: { name: 'Gold',  color: 0xF1C40F, payout: [0, 0, 0, 0.5, 1.0, 2.5] }, // Base template for Gold cards
    5: { name: 'WILD',  color: 0x1ABC9C, payout: [0, 0, 0, 0.0, 0.0, 0.0] }  // Joker Wild card
};

// Base names used to determine text character for Gold variants
const BASE_NAMES = ['J', 'Q', 'K', 'A'];

// --- 2. INITIALIZE PIXI CONTAINER ---
const app = new PIXI.Application();

async function initSlotEngine() {
    await app.init({
        width: (COLS * (TILE_SIZE + MARGIN)) + MARGIN,
        height: (ROWS * (TILE_SIZE + MARGIN)) + MARGIN,
        backgroundColor: 0x1a1a1a
    });
    
    document.getElementById('game-container').innerHTML = ''; // Clear container
    document.getElementById('game-container').appendChild(app.canvas);

    // Grid states
    let gridData = Array(COLS).fill(null).map(() => Array(ROWS).fill(null));
    let gridSprites = Array(COLS).fill(null).map(() => Array(ROWS).fill(null));

    // UI elements update helper
    function updateUIHeaders() {
        document.getElementById('balance-display').innerText = `Balance: $${balance.toFixed(2)}`;
        document.getElementById('multiplier-display').innerText = `Multiplier: x${MULTIPLIERS[multiplierIndex]}`;
        document.getElementById('win-display').innerText = `Win: $${currentWin.toFixed(2)}`;
    }

    function createVisualCard(symbolId, isGolden, col, row, startY) {
        const container = new PIXI.Container();
        
        // A. Draw the Card Background Shape
        const cardBg = new PIXI.Graphics();
        cardBg.roundRect(0, 0, TILE_SIZE, TILE_SIZE, 12);
        
        // If golden, use gold background color, otherwise use standard symbol color
        cardBg.fill({ color: isGolden && symbolId !== 5 ? 0xFFD700 : SYMBOLS[symbolId].color });
        
        if (isGolden && symbolId !== 5) {
            cardBg.stroke({ color: 0xFFFFFF, width: 3 });
        } else {
            cardBg.stroke({ color: 0x333333, width: 2 });
        }
        container.addChild(cardBg);

        // B. Determine Text Display Character
        let characterText = SYMBOLS[symbolId].name;
        let textColor = 0xFFFFFF;
        
        if (isGolden && symbolId !== 5) {
            // Gold card keeps its original card value character (J, Q, K, A) but displays on gold background
            characterText = BASE_NAMES[symbolId] + "\n⭐";
            textColor = 0x000000; // Black text for high contrast on gold background
        }

        // C. Render Card Typography Label
        const cardLabel = new PIXI.Text({
            text: characterText,
            style: {
                fontFamily: 'Arial',
                fontSize: symbolId === 5 || isGolden ? 24 : 38,
                fontWeight: 'bold',
                fill: textColor,
                align: 'center'
            }
        });

        cardLabel.anchor.set(0.5);
        cardLabel.x = TILE_SIZE / 2;
        cardLabel.y = TILE_SIZE / 2;
        container.addChild(cardLabel);

        // Move container layout to coordinates
        container.x = col * (TILE_SIZE + MARGIN) + MARGIN;
        container.y = startY;
        
        app.stage.addChild(container);
        return container;
    }

    // --- 3. FILL MATRIX LOGIC ---
    function populateGrid() {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (!gridData[c][r]) {
                    // Randomly select base symbols 0-3 (J, Q, K, A)
                    let symId = Math.floor(Math.random() * 4); 
                    let goldenChance = (Math.random() < 0.25); // 25% chance this card spawns as Gold variant
                    
                    gridData[c][r] = { id: symId, isGolden: goldenChance, matchCount: 0 };
                    const startY = -(ROWS - r) * (TILE_SIZE + MARGIN);
                    gridSprites[c][r] = createVisualCard(symId, goldenChance, c, r, startY);
                }
            }
        }
    }

    // --- 4. 1,024 WAYS TO WIN MATHEMATICAL EVALUATION ENGINE ---
    function evaluateGridPayouts() {
        let winningCombinationsFound = false;
        let spinPayoutSum = 0;

        // Trace paths across symbol maps to count column occurrences
        for (let baseSymbol = 0; baseSymbol <= 4; baseSymbol++) {
            let columnMatches = Array(COLS).fill(0);
            let matchMap = Array(COLS).fill(null).map(() => []);

            for (let c = 0; c < COLS; c++) {
                for (let r = 0; r < ROWS; r++) {
                    let cell = gridData[c][r];
                    // Match if it's the target symbol OR if it's a WILD Joker (ID: 5)
                    if (cell && (cell.id === baseSymbol || cell.id === 5)) {
                        columnMatches[c]++;
                        matchMap[c].push(r);
                    }
                }
            }

            // Calculate matching length span stretching from the left side
            let consecutiveSpans = 0;
            for (let c = 0; c < COLS; c++) {
                if (columnMatches[c] > 0) consecutiveSpans++;
                else break;
            }

            // If a symbol connects across 3 or more reels sequentially, evaluate wins
            if (consecutiveSpans >= 3) {
                winningCombinationsFound = true;
                
                // 1,024 Ways math multiplication rule: multiply number of matching elements per column
                let totalWaysPaths = 1;
                for (let i = 0; i < consecutiveSpans; i++) {
                    totalWaysPaths *= columnMatches[i];
                }

                let basePayoutRate = SYMBOLS[baseSymbol].payout[consecutiveSpans];
                let payoutChunk = totalWaysPaths * (basePayoutRate * betAmount) * MULTIPLIERS[multiplierIndex];
                spinPayoutSum += payoutChunk;

                // Mark winning targets for elimination sequence
                for (let i = 0; i < consecutiveSpans; i++) {
                    matchMap[i].forEach(r => {
                        if (gridData[i][r]) gridData[i][r].markedForRemoval = true;
                    });
                }
            }
        }

        if (winningCombinationsFound) {
            currentWin += spinPayoutSum;
            balance += spinPayoutSum;
            updateUIHeaders();
            
            // Proceed to cascading clear phase
            setTimeout(processCascadePhase, 800);
        } else {
            // No consecutive combos left, return execution handle to player
            isGameRunning = false;
        }
    }

    // --- 5. CASCADING / ELIMINATION EXECUTION PHASE ---
    function processCascadePhase() {
        // Step A: Parse targets, convert gold elements to active Jokers
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                let cell = gridData[c][r];
                if (cell && cell.markedForRemoval) {
                    app.stage.removeChild(gridSprites[c][r]);
                    
                    if (cell.isGolden && cell.id !== 5) {
                        // Mutate block properties into a Joker WILD card
                        gridData[c][r] = { id: 5, isGolden: false, matchCount: 0, markedForRemoval: false };
                        gridSprites[c][r] = createVisualCard(5, false, c, r, r * (TILE_SIZE + MARGIN) + MARGIN);
                    } else {
                        gridData[c][r] = null;
                        gridSprites[c][r] = null;
                    }
                }
            }
        }

        // Step B: Structural gravity translation loop
        for (let c = 0; c < COLS; c++) {
            let emptySpacesFound = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (gridData[c][r] === null) {
                    emptySpacesFound++;
                } else if (emptySpacesFound > 0) {
                    // Pull the higher cards down to bottom row slots
                    gridData[c][r + emptySpacesFound] = gridData[c][r];
                    gridSprites[c][r + emptySpacesFound] = gridSprites[c][r];
                    gridData[c][r] = null;
                    gridSprites[c][r] = null;
                }
            }
        }

        // Step C: Scale current base win combo multiplier tier index
        if (multiplierIndex < MULTIPLIERS.length - 1) {
            multiplierIndex++;
        }

        // Refill empty data slots and validate combos again
        populateGrid();
        updateUIHeaders();
        setTimeout(evaluateGridPayouts, 600);
    }

    // --- 6. TRIGGER SYSTEM FOR THE SPIN CONTROLLER ---
    function triggerSpin() {
        if (isGameRunning) return;
        if (balance < betAmount) {
            alert("Insufficient Balance!");
            return;
        }

        isGameRunning = true;
        balance -= betAmount;
        currentWin = 0.00;
        multiplierIndex = 0; // Drop combo multipliers down to baseline x1
        updateUIHeaders();

        // Wipe old board layout completely
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (gridSprites[c][r]) app.stage.removeChild(gridSprites[c][r]);
                gridData[c][r] = null;
                gridSprites[c][r] = null;
            }
        }

        populateGrid();
        setTimeout(evaluateGridPayouts, 500);
    }

    // Smooth drop frame physics tracking
    app.ticker.add(() => {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                const sprite = gridSprites[c][r];
                if (sprite) {
                    const targetY = r * (TILE_SIZE + MARGIN) + MARGIN;
                    if (sprite.y < targetY) {
                        sprite.y += REEL_SPEED;
                        if (sprite.y > targetY) sprite.y = targetY;
                    }
                }
            }
        }
    });

    document.getElementById('spin-btn').addEventListener('click', triggerSpin);
    updateUIHeaders();
    populateGrid();
}

initSlotEngine();
