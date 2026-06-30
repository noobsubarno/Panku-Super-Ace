// --- 1. GAME CONTEXT & WALLET STATE ---
let balance = 1000.00;

const BET_TIERS = [1, 3, 5, 8, 10, 20, 30, 50, 100, 200, 500, 1000];
let currentBetIndex = 4; // Starts at $10
let betAmount = BET_TIERS[currentBetIndex]; 

let currentWin = 0.00;
let multiplierIndex = 0; 
let freeSpinsRemaining = 0;
let isFreeSpinMode = false;
let scattersGeneratedThisSpin = 0; // STAGE 3: Scatter Limiter

const NORMAL_MULTIPLIERS = [1, 2, 3, 5];
const FREE_MULTIPLIERS = [2, 4, 6, 10];
let currentMultipliers = NORMAL_MULTIPLIERS;

const ROWS = 4;
const COLS = 5;
const TILE_SIZE = 95;
const MARGIN = 10;
const REEL_SPEED = 30;

let isGameRunning = false;
let app;
let gridData = [];
let gridSprites = [];

// STAGE 1: Weighted Math Strips (The House Edge)
// 0=J, 1=Q, 2=K, 3=A
const REEL_STRIPS = [
    [0, 0, 0, 1, 1, 1, 2, 3],       // Reel 1: Heavy J & Q
    [2, 2, 2, 3, 3, 3, 0, 1],       // Reel 2: Heavy K & A (Breaks the chain often)
    [0, 1, 2, 3, 0, 1, 2, 3],       // Reel 3: Balanced
    [0, 1, 2, 3, 0, 1, 2, 3],       // Reel 4: Balanced
    [0, 1, 2, 3, 0, 1, 2, 3]        // Reel 5: Balanced
];

const SYMBOLS = {
    0: { name: 'J',     color: 0x9B59B6, payout: [0, 0, 0, 0.1, 0.2, 0.5] },
    1: { name: 'Q',     color: 0x2ECC71, payout: [0, 0, 0, 0.1, 0.2, 0.5] },
    2: { name: 'K',     color: 0x3498DB, payout: [0, 0, 0, 0.2, 0.3, 0.8] },
    3: { name: 'A',     color: 0xE74C3C, payout: [0, 0, 0, 0.3, 0.5, 1.2] },
    4: { name: 'Gold',  color: 0xF1C40F, payout: [0, 0, 0, 0.5, 1.0, 2.5] }, 
    5: { name: 'WILD',  color: 0x1ABC9C, payout: [0, 0, 0, 0.0, 0.0, 0.0] },
    6: { name: 'SCATTER',color: 0xE67E22, payout: [0, 0, 0, 0.0, 0.0, 0.0] }
};
const BASE_NAMES = ['J', 'Q', 'K', 'A'];

// --- 2. START SCREEN CONTROLLER ---
document.getElementById('play-btn').addEventListener('click', () => {
    const startScreen = document.getElementById('start-screen');
    startScreen.style.opacity = '0';
    setTimeout(() => {
        startScreen.style.display = 'none';
        document.getElementById('game-ui').style.display = 'flex';
        initSlotEngine();
    }, 500);
});

// --- 3. INITIALIZE PIXI ENGINE ---
async function initSlotEngine() {
    app = new PIXI.Application();
    await app.init({
        width: (COLS * (TILE_SIZE + MARGIN)) + MARGIN,
        height: (ROWS * (TILE_SIZE + MARGIN)) + MARGIN,
        backgroundColor: 0x1a1a1a
    });
    
    document.getElementById('game-container').appendChild(app.canvas);
    gridData = Array(COLS).fill(null).map(() => Array(ROWS).fill(null));
    gridSprites = Array(COLS).fill(null).map(() => Array(ROWS).fill(null));

    // BET CONTROLS LOGIC
    document.getElementById('bet-minus').addEventListener('click', () => {
        if (isGameRunning || isFreeSpinMode) return;
        if (currentBetIndex > 0) {
            currentBetIndex--;
            betAmount = BET_TIERS[currentBetIndex];
            updateUIHeaders();
        }
    });

    document.getElementById('bet-plus').addEventListener('click', () => {
        if (isGameRunning || isFreeSpinMode) return;
        if (currentBetIndex < BET_TIERS.length - 1) {
            currentBetIndex++;
            betAmount = BET_TIERS[currentBetIndex];
            updateUIHeaders();
        }
    });

    function updateUIHeaders() {
        document.getElementById('balance-display').innerText = `Balance: $${balance.toFixed(2)}`;
        document.getElementById('multiplier-display').innerText = `Multiplier: x${currentMultipliers[multiplierIndex]}`;
        document.getElementById('win-display').innerText = `Win: $${currentWin.toFixed(2)}`;
        document.getElementById('bet-display').innerText = `Bet: $${betAmount}`;
        
        const fsDisplay = document.getElementById('freespin-display');
        const spinBtn = document.getElementById('spin-btn');
        if (isFreeSpinMode) {
            fsDisplay.style.display = 'block';
            fsDisplay.innerText = `Free Spins: ${freeSpinsRemaining}`;
            spinBtn.innerText = 'AUTO FREE SPIN';
            spinBtn.style.background = 'linear-gradient(180deg, #e74c3c, #c0392b)';
        } else {
            fsDisplay.style.display = 'none';
            spinBtn.innerText = 'SPIN REELS';
            spinBtn.style.background = 'linear-gradient(180deg, #2ecc71, #27ae60)';
        }
    }

    function createVisualCard(symbolId, isGolden, col, row, startY) {
        const container = new PIXI.Container();
        const cardBg = new PIXI.Graphics();
        cardBg.roundRect(0, 0, TILE_SIZE, TILE_SIZE, 12);
        
        cardBg.fill({ color: isGolden && symbolId !== 5 && symbolId !== 6 ? 0xFFD700 : SYMBOLS[symbolId].color });
        cardBg.stroke({ color: isGolden && symbolId !== 5 ? 0xFFFFFF : 0x333333, width: isGolden ? 4 : 2 });
        container.addChild(cardBg);

        let characterText = SYMBOLS[symbolId].name;
        let textColor = 0xFFFFFF;
        if (isGolden && symbolId < 4) {
            characterText = BASE_NAMES[symbolId] + "\n⭐";
            textColor = 0x000000; 
        } else if (symbolId === 6) { 
            textColor = 0x000000;
        }

        const cardLabel = new PIXI.Text({
            text: characterText,
            style: {
                fontFamily: 'Arial Black',
                fontSize: symbolId >= 5 ? 18 : 40,
                fill: textColor,
                align: 'center'
            }
        });

        cardLabel.anchor.set(0.5);
        cardLabel.x = TILE_SIZE / 2;
        cardLabel.y = TILE_SIZE / 2;
        container.addChild(cardLabel);

        container.x = col * (TILE_SIZE + MARGIN) + MARGIN;
        container.y = startY;
        app.stage.addChild(container);
        return container;
    }

    function populateGrid() {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (!gridData[c][r]) {
                    let symId;
                    
                    // STAGE 3: Hard limit of 3 Scatters generated per spin loop
                    if (scattersGeneratedThisSpin < 3 && Math.random() < 0.015) { 
                        symId = 6;
                        scattersGeneratedThisSpin++;
                    } else {
                        // STAGE 1: Pull from the weighted reel strips
                        const strip = REEL_STRIPS[c];
                        symId = strip[Math.floor(Math.random() * strip.length)];
                    }
                    
                    // STAGE 2: 8% Golden Card Chance
                    let goldenChance = (symId < 4 && Math.random() < 0.08); 
                    
                    gridData[c][r] = { id: symId, isGolden: goldenChance, markedForRemoval: false };
                    const startY = -(ROWS - r) * (TILE_SIZE + MARGIN) - 200; 
                    gridSprites[c][r] = createVisualCard(symId, goldenChance, c, r, startY);
                }
            }
        }
    }

    function checkScatters() {
        let scatterCount = 0;
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (gridData[c][r] && gridData[c][r].id === 6) scatterCount++;
            }
        }
        
        if (scatterCount === 3) {
            if (isFreeSpinMode) {
                // STAGE 4: Retriggers inside Free Spins only give 2 to 5 extra spins
                let extraSpins = Math.floor(Math.random() * 4) + 2; 
                alert(`3 SCATTERS RETRIGGER! ${extraSpins} EXTRA FREE SPINS!`);
                freeSpinsRemaining += extraSpins;
            } else {
                // Initial Trigger gives the full 10
                alert("3 SCATTERS FOUND! 10 FREE SPINS AWARDED!");
                freeSpinsRemaining += 10;
                isFreeSpinMode = true;
                currentMultipliers = FREE_MULTIPLIERS;
            }
            updateUIHeaders();
        }
    }

    function evaluateGridPayouts() {
        let winningCombinationsFound = false;
        let spinPayoutSum = 0;

        for (let baseSymbol = 0; baseSymbol <= 4; baseSymbol++) {
            let columnMatches = Array(COLS).fill(0);
            let matchMap = Array(COLS).fill(null).map(() => []);

            for (let c = 0; c < COLS; c++) {
                for (let r = 0; r < ROWS; r++) {
                    let cell = gridData[c][r];
                    if (cell && (cell.id === baseSymbol || cell.id === 5)) {
                        columnMatches[c]++;
                        matchMap[c].push(r);
                    }
                }
            }

            let consecutiveSpans = 0;
            for (let c = 0; c < COLS; c++) {
                if (columnMatches[c] > 0) consecutiveSpans++;
                else break;
            }

            if (consecutiveSpans >= 3) {
                winningCombinationsFound = true;
                let totalWaysPaths = 1;
                for (let i = 0; i < consecutiveSpans; i++) totalWaysPaths *= columnMatches[i];

                let basePayoutRate = SYMBOLS[baseSymbol].payout[consecutiveSpans];
                let payoutChunk = totalWaysPaths * (basePayoutRate * betAmount) * currentMultipliers[multiplierIndex];
                spinPayoutSum += payoutChunk;

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
            setTimeout(processCascadePhase, 700);
        } else {
            checkScatters();
            if (isFreeSpinMode && freeSpinsRemaining > 0) {
                setTimeout(triggerSpin, 1500); 
            } else if (isFreeSpinMode && freeSpinsRemaining <= 0) {
                if (currentWin > 0) alert(`Free Spins Finished! Total Bonus Win: $${currentWin.toFixed(2)}`);
                isFreeSpinMode = false;
                currentMultipliers = NORMAL_MULTIPLIERS;
                isGameRunning = false;
                updateUIHeaders();
            } else {
                isGameRunning = false;
            }
        }
    }

    function processCascadePhase() {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                let cell = gridData[c][r];
                if (cell && cell.markedForRemoval) {
                    app.stage.removeChild(gridSprites[c][r]);
                    if (cell.isGolden && cell.id !== 5) {
                        gridData[c][r] = { id: 5, isGolden: false, markedForRemoval: false };
                        gridSprites[c][r] = createVisualCard(5, false, c, r, r * (TILE_SIZE + MARGIN) + MARGIN);
                    } else {
                        gridData[c][r] = null;
                        gridSprites[c][r] = null;
                    }
                }
            }
        }

        for (let c = 0; c < COLS; c++) {
            let emptySpacesFound = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (gridData[c][r] === null) {
                    emptySpacesFound++;
                } else if (emptySpacesFound > 0) {
                    gridData[c][r + emptySpacesFound] = gridData[c][r];
                    gridSprites[c][r + emptySpacesFound] = gridSprites[c][r];
                    gridData[c][r] = null;
                    gridSprites[c][r] = null;
                }
            }
        }

        if (multiplierIndex < currentMultipliers.length - 1) multiplierIndex++;
        
        populateGrid();
        updateUIHeaders();
        setTimeout(evaluateGridPayouts, 600);
    }

    function triggerSpin() {
        if (isGameRunning && !isFreeSpinMode) return; 
        
        if (!isFreeSpinMode) {
            if (balance < betAmount) {
                alert("Insufficient Balance for this bet!");
                return;
            }
            balance -= betAmount;
        } else {
            freeSpinsRemaining--;
        }

        isGameRunning = true;
        
        // Reset state for the new spin cycle
        if (!isFreeSpinMode || (isFreeSpinMode && freeSpinsRemaining === 9)) {
             // Keep the currentWin accumulating if we are in free spins
             if (!isFreeSpinMode) currentWin = 0.00; 
        }
        
        multiplierIndex = 0; 
        scattersGeneratedThisSpin = 0; // Reset scatter cap limit per spin
        
        updateUIHeaders();

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
