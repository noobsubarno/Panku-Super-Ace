// --- 1. GAME CONTEXT & WALLET STATE ---
let balance = 1000.00;
let betAmount = 10.00;
let currentWin = 0.00;
let multiplierIndex = 0; 
const MULTIPLIERS = [1, 2, 3, 5];

const ROWS = 4;
const COLS = 5;
const TILE_SIZE = 95;
const MARGIN = 10;
const REEL_SPEED = 30;

let isGameRunning = false;
let app;
let gridData = [];
let gridSprites = [];

const SYMBOLS = {
    0: { name: 'J',     color: 0x9B59B6, payout: [0, 0, 0, 0.1, 0.2, 0.5] },
    1: { name: 'Q',     color: 0x2ECC71, payout: [0, 0, 0, 0.1, 0.2, 0.5] },
    2: { name: 'K',     color: 0x3498DB, payout: [0, 0, 0, 0.2, 0.3, 0.8] },
    3: { name: 'A',     color: 0xE74C3C, payout: [0, 0, 0, 0.3, 0.5, 1.2] },
    4: { name: 'Gold',  color: 0xF1C40F, payout: [0, 0, 0, 0.5, 1.0, 2.5] }, 
    5: { name: 'WILD',  color: 0x1ABC9C, payout: [0, 0, 0, 0.0, 0.0, 0.0] }  
};
const BASE_NAMES = ['J', 'Q', 'K', 'A'];

// --- 2. START SCREEN CONTROLLER ---
document.getElementById('play-btn').addEventListener('click', () => {
    const startScreen = document.getElementById('start-screen');
    startScreen.style.opacity = '0';
    setTimeout(() => {
        startScreen.style.display = 'none';
        document.getElementById('game-ui').style.display = 'flex';
        initSlotEngine(); // Boot the game engine
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

    function updateUIHeaders() {
        document.getElementById('balance-display').innerText = `Balance: $${balance.toFixed(2)}`;
        document.getElementById('multiplier-display').innerText = `Multiplier: x${MULTIPLIERS[multiplierIndex]}`;
        document.getElementById('win-display').innerText = `Win: $${currentWin.toFixed(2)}`;
    }

    function createVisualCard(symbolId, isGolden, col, row, startY) {
        const container = new PIXI.Container();
        const cardBg = new PIXI.Graphics();
        cardBg.roundRect(0, 0, TILE_SIZE, TILE_SIZE, 12);
        
        cardBg.fill({ color: isGolden && symbolId !== 5 ? 0xFFD700 : SYMBOLS[symbolId].color });
        cardBg.stroke({ color: isGolden && symbolId !== 5 ? 0xFFFFFF : 0x333333, width: isGolden ? 4 : 2 });
        container.addChild(cardBg);

        let characterText = SYMBOLS[symbolId].name;
        let textColor = 0xFFFFFF;
        if (isGolden && symbolId !== 5) {
            characterText = BASE_NAMES[symbolId] + "\n⭐";
            textColor = 0x000000; 
        }

        const cardLabel = new PIXI.Text({
            text: characterText,
            style: {
                fontFamily: 'Arial Black',
                fontSize: symbolId === 5 || isGolden ? 22 : 40,
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
                    let symId = Math.floor(Math.random() * 4); 
                    let goldenChance = (Math.random() < 0.25); 
                    
                    gridData[c][r] = { id: symId, isGolden: goldenChance, markedForRemoval: false };
                    const startY = -(ROWS - r) * (TILE_SIZE + MARGIN) - 200; // Drop from higher up
                    gridSprites[c][r] = createVisualCard(symId, goldenChance, c, r, startY);
                }
            }
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
                let payoutChunk = totalWaysPaths * (basePayoutRate * betAmount) * MULTIPLIERS[multiplierIndex];
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
            isGameRunning = false;
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

        if (multiplierIndex < MULTIPLIERS.length - 1) multiplierIndex++;
        
        populateGrid();
        updateUIHeaders();
        setTimeout(evaluateGridPayouts, 600);
    }

    function triggerSpin() {
        if (isGameRunning) return;
        if (balance < betAmount) {
            alert("Insufficient Balance!");
            return;
        }

        isGameRunning = true;
        balance -= betAmount;
        currentWin = 0.00;
        multiplierIndex = 0; 
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
