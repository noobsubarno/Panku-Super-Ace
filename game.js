// --- CONFIGURATION ---
const ROWS = 4;
const COLS = 5;
const TILE_SIZE = 90;
const MARGIN = 10;
const REEL_SPEED = 25;

const SYMBOL_COLORS = {
    0: 0xE74C3C, // Ace (Red)
    1: 0x3498DB, // King (Blue)
    2: 0x2ECC71, // Queen (Green)
    3: 0x9B59B6, // Jack (Purple)
    4: 0xF1C40F, // Golden Card (Gold)
    5: 0x1ABC9C  // Joker Wild (Cyan)
};

// --- INITIALIZE PIXI ---
const app = new PIXI.Application();

async function initGame() {
    await app.init({
        width: (COLS * (TILE_SIZE + MARGIN)) + MARGIN,
        height: (ROWS * (TILE_SIZE + MARGIN)) + MARGIN,
        backgroundColor: 0x222222
    });
    
    document.getElementById('game-container').appendChild(app.canvas);

    // Grid data states
    let gridData = Array(COLS).fill(null).map(() => Array(ROWS).fill(0));
    let gridSprites = Array(COLS).fill(null).map(() => Array(ROWS).fill(null));

    function createCard(symbolId, col, row, startY) {
        const card = new PIXI.Graphics();
        card.roundRect(0, 0, TILE_SIZE, TILE_SIZE, 8);
        card.fill({ color: SYMBOL_COLORS[symbolId] });
        
        card.x = col * (TILE_SIZE + MARGIN) + MARGIN;
        card.y = startY;
        
        app.stage.addChild(card);
        return card;
    }

    function spin() {
        for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
                if (gridSprites[c][r]) {
                    app.stage.removeChild(gridSprites[c][r]);
                }
                
                // 20% chance for a Golden Card (ID: 4)
                const symbolId = Math.random() < 0.2 ? 4 : Math.floor(Math.random() * 4);
                gridData[c][r] = symbolId;
                
                // Spawn above view to drop down
                const startY = -(ROWS - r) * (TILE_SIZE + MARGIN);
                gridSprites[c][r] = createCard(symbolId, c, r, startY);
            }
        }
    }

    // Smooth dropping physics animation loop
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

    document.getElementById('spin-btn').addEventListener('click', spin);
    spin(); // Initial spin on load
}

initGame();