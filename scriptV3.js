function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    
    // Toggle the class on the body
    body.classList.toggle('dark-mode');
    
    // Check which theme is active now
    const isDark = body.classList.contains('dark-mode');
    
    // 1. Update the icon
    icon.innerText = isDark ? '☀️' : '🌙';
    
    // 2. Save the preference in the browser's memory
    localStorage.setItem('user-theme', isDark ? 'dark' : 'light');
    
    // 3. Optional: If you have a JSXGraph board open, refresh its colors
    if (typeof board !== 'undefined' && board !== null) {
        board.containerObj.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
    }
}

// 4. Load the saved theme when the page opens
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('user-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').innerText = '☀️';
    }
});

// 1. GLOBAL STATE & LOADING
let data = {}; // This will hold your JSON content
let currentStack = [];
let currentIndex = 0;
let board = null;
let currentTaskIndex = 0;

/**
 * Loads the JSON file and initializes the menu
 */
async function loadData() {
    try {
        // Change 'data.json' to the correct path if it's in a subfolder
        const response = await fetch('data.json'); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        data = await response.json();
        console.log("Data loaded successfully:", data);
        
        // Build the menu buttons based on the JSON keys
        createCategoryMenu();
        
    } catch (error) {
        console.error("Failed to load math data:", error);
        const menuEl = document.getElementById('menu');
        if (menuEl) {
            menuEl.innerHTML = `<p style="color:red; padding:20px;">შეცდომა მონაცემების ჩატვირთვისას. <br> გთხოვთ შეამოწმოთ data.json ფაილი.</p>`;
        }
    }
}

/**
 * Dynamically creates buttons for each category found in the JSON
 */
function createCategoryMenu() {
    const menuContainer = document.getElementById('menu');
    if (!menuContainer) return;

    menuContainer.innerHTML = ""; // Clear existing content
    
    Object.keys(data).forEach(categoryName => {
        const btn = document.createElement('button');
        
        // Add your original class plus a new one for specific styling
        btn.classList.add('category-btn', 'menu-card'); 
        
        // Since the emoji is already in the categoryName string, 
        // we just put the whole string inside the button.
        btn.innerHTML = `
            <div class="card-content">${categoryName}</div>
        `;

        btn.onclick = () => startStack(categoryName);
        menuContainer.appendChild(btn);
    });
}

// 2. CORE UTILITIES
function shuffleArray(array) {
    if (!array) return;
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// 3. NAVIGATION FUNCTIONS
function startStack(name) {
    if (!data || !data[name]) return;
    
    // Support both direct arrays and {cards: []} structures
    const categorySource = Array.isArray(data[name]) ? data[name] : data[name].cards;
    
    currentStack = [...categorySource];
    shuffleArray(currentStack);
    currentIndex = 0;
    
    const titleEl = document.getElementById('category-title');
    if (titleEl) titleEl.innerText = name;
    
    document.getElementById('menu').style.display = 'none';
    document.getElementById('player').style.display = 'block';
    updateCard();
}

function updateCard() {
    if (currentStack.length === 0) return;

    const card = currentStack[currentIndex];
    const textEl = document.getElementById('q-text-content');
    const aEl = document.getElementById('a-text');
    const imgEl = document.getElementById('q-img'); 
    const graphEl = document.getElementById('jxgbox');
    const flashcard = document.querySelector('.flashcard');
    const helpBtn = document.getElementById('help-btn');
    const taskBtn = document.getElementById('task-btn');
  
    closeTask();
    closeTheory();

    // 1. IMMEDIATELY reset the flip state so the animation starts
    if (flashcard) {
        flashcard.classList.remove('flipped');
        flashcard.onclick = toggleFlip; 
    }

    // 2. DELAY the content update slightly (e.g., 50-100ms) 
    // This prevents the "spoiler" flash of the next answer.
    setTimeout(() => {
        if (textEl) textEl.innerHTML = card.q || "";
        if (aEl) {
            aEl.innerHTML = `<div class="back-content">${card.a || ""}</div>`;
        }

        // Image handling
        if (imgEl) {
            if (card.img) {
                imgEl.src = card.img;
                imgEl.style.display = "block";
            } else {
                imgEl.style.display = "none";
            }
        }

        // Theory/Help button visibility
        if (helpBtn) {
            if (card.help && card.help.trim() !== "") {
                helpBtn.style.display = "inline-block";
                helpBtn.onclick = openTheory;
            } else {
                helpBtn.style.display = "none";
            }
        }

        // Task button visibility
        if (taskBtn) {
            if (card.tasks && Array.isArray(card.tasks) && card.tasks.length > 0) {
                taskBtn.style.display = "inline-block";
                taskBtn.onclick = openTask; 
            } else {
                taskBtn.style.display = "none";
            }
        }

        // JSXGraph handling
        if (graphEl) {
            if (board) {
                JXG.JSXGraph.freeBoard(board);
                board = null; 
            }
            if (card.func && card.func.trim() !== "") {
                graphEl.style.display = "block";
                graphEl.style.visibility = "visible"; 
                graphEl.style.pointerEvents = "none"; 
                // Nested timeout for graph rendering to ensure the DOM is ready
                setTimeout(() => { renderGraph(card.func); }, 50);
            } else {
                graphEl.style.display = "none";
            }
        }

        // Render KaTeX math AFTER the content has been updated
        if (typeof window.renderMathInElement === 'function') {
            renderMathInElement(document.getElementById('player'), {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false}
                ],
                throwOnError: false
            });
        }
    }, 100); // 100ms is usually the "sweet spot" for flip animations

    // Progress text (can stay outside the timeout as it's not on the card face)
    const progressEl = document.getElementById('progress');
    if (progressEl) progressEl.innerText = `${currentIndex + 1} / ${currentStack.length}`;
}

// 4. THEORY MODAL FUNCTIONS
function openTheory(event) {
    if (event) event.stopPropagation();
    const card = currentStack[currentIndex];
    const modal = document.getElementById('theory-modal');
    const helpTextModal = document.getElementById('help-text-modal');

    if (modal && helpTextModal && card.help) {
        helpTextModal.innerHTML = card.help;
        modal.style.display = "block";
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(helpTextModal, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false}
                ]
            });
        }
    }
}

function closeTheory() {
    const modal = document.getElementById('theory-modal');
    if (modal) modal.style.display = "none";
}

// 5. CORE GRAPHING & FLIPPING
function renderGraph(functionString) {
    if (typeof JXG === 'undefined') return;
    if (board) { JXG.JSXGraph.freeBoard(board); board = null; }
    try {
        board = JXG.JSXGraph.initBoard('jxgbox', {
            boundingbox: [-10, 10, 10, -10],
            axis: true,
            showCopyright: false,
            showNavigation: false,
            keepaspectratio: true
        });
        board.create('functiongraph', [function(x) {
            // Evaluates the string from the JSON
            try { return eval(functionString); } catch(e) { return 0; }
        }], { strokeWidth: 3, strokeColor: '#4a90e2' });
    } catch (err) {
        console.error("Board Initialization Failed:", err);
    }
}

function nextCard() {
    currentIndex = (currentIndex + 1) % currentStack.length;
    updateCard();
}

function prevCard() {
    currentIndex = (currentIndex - 1 + currentStack.length) % currentStack.length;
    updateCard();
}

function goHome() {
    // Hide search button when going to main menu
    const searchBackBtn = document.getElementById('back-to-search-btn');
    if (searchBackBtn) searchBackBtn.style.display = 'none';
    
    // Clear search input
    document.getElementById('app-search').value = "";
    
    document.getElementById('menu').style.display = 'grid';
    document.getElementById('menu').classList.remove('searching');
    document.getElementById('player').style.display = 'none';
    createCategoryMenu();
}

function toggleFlip() {
    const flashcard = document.querySelector('.flashcard');
    const graphEl = document.getElementById('jxgbox');
    if (!flashcard) return;
    flashcard.classList.toggle('flipped');
    
    // Hide graph on back of card to prevent overlap
    if (graphEl) {
        if (flashcard.classList.contains('flipped')) {
            graphEl.style.visibility = "hidden";
        } else {
            if (currentStack[currentIndex] && currentStack[currentIndex].func) {
                graphEl.style.visibility = "visible";
            }
        }
    }
}

// 6. TASK MODAL LOGIC
function openTask(event) {
    if (event) event.stopPropagation();
    const card = currentStack[currentIndex];
    if (!card.tasks || card.tasks.length === 0) return;
    currentTaskIndex = 0; 
    displayTask();
    document.getElementById('task-modal').style.display = "block";
}

function displayTask() {
    const card = currentStack[currentIndex];
    const task = card.tasks[currentTaskIndex];
    
    const taskTextContainer = document.getElementById('task-text-modal');
    const answerBtn = document.getElementById('show-task-answer-btn');
    const answerText = document.getElementById('task-answer-text');
    const answerWrapper = document.getElementById('task-answer-wrapper');
    const navControls = document.getElementById('task-nav-controls');
    const mainContent = document.getElementById('task-main-content'); 
    const hBtn = document.getElementById('hint-btn');
    const hText = document.getElementById('task-hint-text');
    
    if (hText) hText.style.display = "none";

    if (task.hint && task.hint.trim() !== "") {
        hBtn.style.display = "inline-block";
        hText.innerHTML = task.hint; 
    } else {
        hBtn.style.display = "none";
    }

    const oldGame = document.getElementById('active-matching-game');
    if (oldGame) oldGame.remove();

    taskTextContainer.style.display = "block";
    if (answerWrapper) answerWrapper.style.display = "block";
    answerBtn.style.display = "inline-block";
    answerText.style.display = "none";
    answerBtn.innerText = "პასუხის ნახვა";

    if (task.type === "matching" && task.matchingData) {
        taskTextContainer.style.display = "none";
        if (answerWrapper) answerWrapper.style.display = "none";
        
        const gameWrapper = document.createElement('div');
        gameWrapper.id = "active-matching-game";
        gameWrapper.className = "matching-wrapper";
        
        // --- LOGIC: Check if this is a Graph Match or Text Match ---
        const isGraphMatch = task.matchingData[0].bbox !== undefined;
        const instructions = isGraphMatch ? "შეუსაბამეთ გრაფიკები განტოლებებს:" : "შეუსაბამეთ შესაბამისი მნიშვნელობები:";

        gameWrapper.innerHTML = `
            <div style="width: 100%; text-align: center; margin-bottom: 20px;">
                <p style="font-weight: bold; color: var(--text-primary); font-size: 1.1em; margin: 0;">
                    ${instructions}
                </p>
            </div>
            <div style="display: flex; justify-content: space-around; align-items: flex-start; gap: 20px;">
                <div class="match-col" style="flex: 1;"><div id="card-draggables"></div></div>
                <div class="match-col" style="flex: 1;"><div id="card-targets"></div></div>
            </div>
        `;
        
        if (mainContent) {
            mainContent.appendChild(gameWrapper);
        } else {
            taskTextContainer.parentElement.appendChild(gameWrapper);
        }

        // --- BRANCHING LOGIC ---
        if (isGraphMatch) {
            // Your existing function that uses JSXGraph
            renderMatchingGameLogic(task.matchingData);
        } else {
            // New function for Radian/Text matching (we need to create this below)
            renderTextMatchingLogic(task.matchingData);
        }

    } else {
        taskTextContainer.innerHTML = task.q || "";
        answerText.innerHTML = "პასუხი: " + (task.a || "");
    }

    // ... rest of your code (task numbering and math rendering) ...
    const taskNumEl = document.getElementById('task-number');
    if (taskNumEl) taskNumEl.innerText = `${currentTaskIndex + 1} / ${card.tasks.length}`;
    if (navControls) navControls.style.visibility = (card.tasks.length > 1) ? "visible" : "hidden";

    if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.getElementById('task-modal'), {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ]
        });
    }
}

function renderTextMatchingLogic(data) {
    const draggablesContainer = document.getElementById('card-draggables');
    const targetsContainer = document.getElementById('card-targets');
    
    // Clear them out first to be safe
    draggablesContainer.innerHTML = "";
    targetsContainer.innerHTML = "";

    // Shuffle the right column so it's a real game
    const shuffledTargets = [...data].sort(() => Math.random() - 0.5);

    // Create Left Column (Degrees)
    data.forEach(item => {
        const d = document.createElement('div');
        d.className = "match-btn clickable-item"; // Add a class that has 'cursor: pointer'
        d.innerHTML = item.eq; 
        d.dataset.id = item.id;
        
        // This is the missing piece! The click event:
        d.onclick = () => handleMatchSelection(d, 'left'); 
        
        draggablesContainer.appendChild(d);
    });

    // Create Right Column (Radians)
    shuffledTargets.forEach(item => {
        const t = document.createElement('div');
        t.className = "match-btn clickable-item";
        t.innerHTML = item.func; 
        t.dataset.id = item.id;
        
        // And for the right side:
        t.onclick = () => handleMatchSelection(t, 'right');
        
        targetsContainer.appendChild(t);
    });
    const gameArea = document.getElementById('active-matching-game');
    if (typeof renderMathInElement === 'function' && gameArea) {
        renderMathInElement(gameArea);
    }
}
// Helper to handle the actual Drag/Drop and JSXGraph
function renderMatchingGameLogic(matchingData) {
    const dragCont = document.getElementById('card-draggables');
    const targetCont = document.getElementById('card-targets');

    // 1. Create Draggables
    [...matchingData].sort(() => Math.random() - 0.5).forEach(item => {
        const div = document.createElement('div');
        div.className = 'drag-item small';
        div.draggable = true;
        div.id = `drag-${item.id}`;
        div.innerHTML = `\\(${item.eq}\\)`;
        div.addEventListener('dragstart', (e) => e.dataTransfer.setData("text", e.target.id));
        dragCont.appendChild(div);
    });

    // 2. Create Targets
    matchingData.forEach(item => {
        const zone = document.createElement('div');
        zone.className = 'drop-zone card-zone';
        zone.id = `target-${item.id}`;
        zone.innerHTML = `<div id="board-${item.id}" class="mini-graph-card"></div><div class="snap-slot">ჩააგდეთ აქ</div>`;
        
        zone.addEventListener('dragover', (e) => e.preventDefault());
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text");
            if (draggedId.split('-')[1] === item.id) {
                const draggedEl = document.getElementById(draggedId);
                zone.querySelector('.snap-slot').innerHTML = draggedEl.innerHTML;
                zone.classList.add('correct-match');
                draggedEl.style.visibility = 'hidden';
            }
        });
        targetCont.appendChild(zone);

        // 3. Initialize Graph
        setTimeout(() => {
            const board = JXG.JSXGraph.initBoard(`board-${item.id}`, {
                boundingbox: item.bbox || [-5, 5, 5, -5], 
                axis: true, showCopyright: false, showNavigation: false
            });
            board.create('functiongraph', [new Function('x', `return ${item.func}`)], {strokeWidth: 2});
        }, 100);
    });
    const gameArea = document.getElementById('active-matching-game');
    if (typeof renderMathInElement === 'function' && gameArea) {
        renderMathInElement(gameArea);
    }
}

let selectedLeft = null;
let selectedRight = null;

function handleMatchSelection(element, side) {
    // 1. Handle selection highlighting
    if (side === 'left') {
        if (selectedLeft) selectedLeft.classList.remove('selected');
        selectedLeft = (selectedLeft === element) ? null : element;
    } else {
        if (selectedRight) selectedRight.classList.remove('selected');
        selectedRight = (selectedRight === element) ? null : element;
    }
    
    if (element === selectedLeft || element === selectedRight) {
        element.classList.add('selected');
    }

    // 2. Check for match
    if (selectedLeft && selectedRight) {
        if (selectedLeft.dataset.id === selectedRight.dataset.id) {
            // SUCCESS
            selectedLeft.classList.add('matched-correct');
            selectedRight.classList.add('matched-correct');
            selectedLeft.onclick = null; // Disable clicks on found pairs
            selectedRight.onclick = null;
            selectedLeft = null;
            selectedRight = null;
        } else {
            // ERROR
            const l = selectedLeft;
            const r = selectedRight;
            l.classList.add('matched-wrong');
            r.classList.add('matched-wrong');
            
            setTimeout(() => {
                l.classList.remove('selected', 'matched-wrong');
                r.classList.remove('selected', 'matched-wrong');
            }, 500);
            
            selectedLeft = null;
            selectedRight = null;
        }
    }
}

function toggleTaskAnswer() {
    const ansText = document.getElementById('task-answer-text');
    const btn = document.getElementById('show-task-answer-btn');
    if (!ansText || !btn) return;

    if (ansText.style.display === "none" || ansText.style.display === "") {
        ansText.style.display = "block";
        btn.innerText = "პასუხის დამალვა";
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(ansText, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    } else {
        ansText.style.display = "none";
        btn.innerText = "პასუხის ნახვა";
    }
}

function toggleHint() {
    const hintText = document.getElementById('task-hint-text');
    if (!hintText) return;

    if (hintText.style.display === "none") {
        hintText.style.display = "block";
        
        // This is vital: Render the math equations inside the hint
        if (typeof renderMathInElement === 'function') {
            renderMathInElement(hintText, {
                delimiters: [
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false}
                ],
                throwOnError: false
            });
        }
    } else {
        hintText.style.display = "none";
    }
}

function changeTask(direction) {
    const card = currentStack[currentIndex];
    currentTaskIndex = (currentTaskIndex + direction + card.tasks.length) % card.tasks.length;
    displayTask();
}

function closeTask() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.style.display = "none";
}

// Modal closing behavior
window.onclick = function(event) {
    const tModal = document.getElementById('theory-modal');
    const taskModal = document.getElementById('task-modal');
    if (event.target == tModal) closeTheory();
    if (event.target == taskModal) closeTask();
};

// 7. INITIALIZE
loadData();
