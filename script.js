
function setAppTheme(themeMode) {
    const body = document.body;
    const thumb = document.getElementById('theme-slider-thumb');
    const nodes = document.querySelectorAll('.theme-slider-node');
    
    // Fallback indicator checking to support your legacy components safely
    const legacyIcon = document.getElementById('theme-icon');

    // 1. Synchronize Slider Track Positioning (if slider nodes exist in the active view)
    if (nodes.length === 3 && thumb) {
        nodes.forEach(node => node.classList.remove('active'));
        
        if (themeMode === 'light') {
            thumb.style.left = "2px";
            nodes[0].classList.add('active');
        } else if (themeMode === 'system') {
            thumb.style.left = "45px";
            nodes[1].classList.add('active');
        } else if (themeMode === 'dark') {
            thumb.style.left = "88px";
            nodes[2].classList.add('active');
        }
    }

    // 2. Evaluate Active Dark State Condition
    let isDark = false;
    if (themeMode === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
        isDark = (themeMode === 'dark');
    }

    // 3. Apply Target CSS Classes & Attributes to DOM
    if (isDark) {
        body.classList.add('dark-mode');
        document.documentElement.setAttribute('data-theme', 'dark');
        if (legacyIcon) legacyIcon.innerText = '☀️';
    } else {
        body.classList.remove('dark-mode');
        document.documentElement.setAttribute('data-theme', 'light');
        if (legacyIcon) legacyIcon.innerText = '🌙';
    }

    // 4. Save Selection State to Legacy LocalStorage Key
    localStorage.setItem('user-theme', themeMode);

    // 5. Dynamic Update Rule for JSXGraph Boards
    if (typeof board !== 'undefined' && board !== null) {
        board.containerObj.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
    }
}

/**
 * Legacy bridge fallback to prevent breaking structural anchors
 */
function toggleTheme() {
    const isCurrentlyDark = document.body.classList.contains('dark-mode');
    setAppTheme(isCurrentlyDark ? 'light' : 'dark');
}

// 6. Automated Initialize hook on DOM Load
window.addEventListener('DOMContentLoaded', () => {
    // Falls back to light mode if running for the first time
    const savedTheme = localStorage.getItem('user-theme') || 'light';
    setAppTheme(savedTheme);
});

// =========================================================================
// 1. GLOBAL STATE & LOADING
// =========================================================================
let data = {}; // This will hold your JSON content
let currentStack = [];
let currentIndex = 0;
let board = null;
let currentTaskIndex = 0;

// 📦 Initialize or grab saved bookmarks from browser cache memory
let bookmarkedCards = JSON.parse(localStorage.getItem('math_bookmarks')) || [];

// 🔄 Updates the visual state of the star button based on current card save status
function updateBookmarkUI() {
    if (!currentStack || currentStack.length === 0) return;
    
    const currentCard = currentStack[currentIndex];
    const starSvg = document.getElementById('bookmark-star-svg');
    
    if (!starSvg) return;
    
    const isSaved = bookmarkedCards.some(card => card.q === currentCard.q);
    
    if (isSaved) {
        starSvg.setAttribute('fill', '#f59e0b');   // Gold fill
        starSvg.style.stroke = '#f59e0b';          // Gold outline
    } else {
        starSvg.setAttribute('fill', 'none');       // Empty fill
        starSvg.style.stroke = '#2c3e50';          // Return to default dark outline
    }
}

// ⭐️ Toggles adding/removing cards when the user clicks the bookmark button chip
function toggleCurrentBookmark(event) {
    if (event) event.stopPropagation(); // Stops card from flipping over accidentally
    if (!currentStack || currentStack.length === 0) return;
    
    const currentCard = currentStack[currentIndex];
    const cardIndex = bookmarkedCards.findIndex(card => card.q === currentCard.q);
    
    if (cardIndex > -1) {
        // Already exists? Remove it!
        bookmarkedCards.splice(cardIndex, 1);
    } else {
        // New card? Clone it cleanly alongside its structural properties
        const savedItem = {
            q: currentCard.q,
            a: currentCard.a,
            help: currentCard.help || "",
            tasks: currentCard.tasks || null,
            jxg: currentCard.jxg || null
        };
        bookmarkedCards.push(savedItem);
    }
    
    // Save updated array list straight back into localStorage memory cache
    localStorage.setItem('math_bookmarks', JSON.stringify(bookmarkedCards));
    updateBookmarkUI();
}


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
        
        // ---------------------------------------------------------
        // 📊 STATS COUNTER LOGIC (ADDED HERE)
        // ---------------------------------------------------------
        let totalFlashcards = 0;
        let totalMCQs = 0;

        // Loop through every category key inside your loaded data object
        for (let category in data) {
            data[category].forEach(card => {
                // Count the parent card as a flashcard
                totalFlashcards++;

                // If sub-tasks exist, look inside them
                if (card.tasks && card.tasks.length > 0) {
                    card.tasks.forEach(task => {
                        if (task.options && task.options.length > 0) {
                            totalMCQs++; // It has options, it's an MCQ
                        } else {
                            totalFlashcards++; // No options, it's a flashcard task
                        }
                    });
                }
            });
        }

        let grandTotal = totalFlashcards + totalMCQs;

        // Display the calculated stats in your HTML placeholder element
        const statEl = document.getElementById('stat-counter');
        if (statEl) {
            statEl.innerHTML = `სულ: ${grandTotal} | 🗂️ ბარათი: ${totalFlashcards} | 📝 ამოცანა: ${totalMCQs}`;
        }
        // ---------------------------------------------------------
        
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
    updateBookmarkUI();
    
    // 1. IMMEDIATELY reset the flip state so the animation starts
    if (flashcard) {
        flashcard.classList.remove('flipped');
        flashcard.onclick = toggleFlip; 
        
        // 📱 Setup Touch Swipe Gestures for Mobile & Tablets Safely
        setupSwipeGestures(flashcard);
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

    // Clean up any dynamically generated elements from previous runs
    const oldGame = document.getElementById('active-matching-game');
    if (oldGame) oldGame.remove();
    
    const oldOptions = document.getElementById('active-quiz-options');
    if (oldOptions) oldOptions.remove();

    taskTextContainer.style.display = "block";
    
    // --- BRANCHING LOGIC FOR TASK TYPES ---
    if (task.type === "matching" && task.matchingData) {
        taskTextContainer.style.display = "none";
        if (answerWrapper) answerWrapper.style.display = "none";
        
        const gameWrapper = document.createElement('div');
        gameWrapper.id = "active-matching-game";
        gameWrapper.className = "matching-wrapper";
        
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

        if (isGraphMatch) {
            renderMatchingGameLogic(task.matchingData);
        } else {
            renderTextMatchingLogic(task.matchingData);
        }

    } else if (task.options && Array.isArray(task.options) && task.options.length > 0) {
        // --- MULTIPLE CHOICE TASK TYPE ---
        taskTextContainer.innerHTML = task.q || "";
        
        // Hide standard answer button and text wrapper (the buttons will handle showing the result)
        if (answerWrapper) answerWrapper.style.display = "none";
        
        // Create a wrapper for our MCQ buttons
        const optionsWrapper = document.createElement('div');
        optionsWrapper.id = "active-quiz-options";
        optionsWrapper.className = "quiz-options-container"; // Reference your CSS styles
        optionsWrapper.style.cssText = "display: flex; flex-direction: column; gap: 12px; margin: 20px 0; width: 100%;";

        // Generate choices dynamically
        task.options.forEach((optionText, index) => {
            const btn = document.createElement('button');
            btn.className = "option-btn"; // Reference your MCQ button CSS
            btn.innerHTML = optionText;
            btn.onclick = () => handleOptionSelection(btn, index, task.correct, task.options);
            optionsWrapper.appendChild(btn);
        });

        // Insert buttons inside the modal main content area
        if (mainContent) {
            mainContent.appendChild(optionsWrapper);
        } else {
            taskTextContainer.parentElement.appendChild(optionsWrapper);
        }

    } else {
        // --- STANDARD TASK TYPE (Traditional Fallback) ---
        if (answerWrapper) answerWrapper.style.display = "block";
        answerBtn.style.display = "inline-block";
        answerText.style.display = "none";
        answerBtn.innerText = "პასუხის ნახვა";
        
        taskTextContainer.innerHTML = task.q || "";
        answerText.innerHTML = "პასუხი: " + (task.a || "");
    }

    const taskNumEl = document.getElementById('task-number');
    if (taskNumEl) taskNumEl.innerText = `${currentTaskIndex + 1} / ${card.tasks.length}`;
    if (navControls) navControls.style.visibility = (card.tasks.length > 1) ? "visible" : "hidden";

    if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.getElementById('task-modal'), {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}
            ]
        });
    }
}
function handleOptionSelection(clickedButton, selectedIndex, correctIndex, optionsArray) {
    const parentContainer = document.getElementById('active-quiz-options');
    const buttons = parentContainer.querySelectorAll('.option-btn');
    
    // Disable all options so they can't change their mind
    buttons.forEach((button, index) => {
        button.disabled = true;
        
        if (index === correctIndex) {
            button.classList.add('correct'); // Highlights the correct choice in green
        } else if (index === selectedIndex) {
            button.classList.add('wrong'); // Highlights their wrong choice in red
        }
    });

    // Dynamically inject/reveal the final response below the options
    let feedbackDiv = document.getElementById('mcq-feedback-banner');
    if (!feedbackDiv) {
        feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'mcq-feedback-banner';
        feedbackDiv.style.cssText = "margin-top: 15px; padding: 12px; border-radius: 8px; font-weight: bold; font-size: 1.05em; text-align: center;";
        parentContainer.appendChild(feedbackDiv);
    }

    if (selectedIndex === correctIndex) {
        feedbackDiv.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
        feedbackDiv.style.color = "#065f46";
        feedbackDiv.innerHTML = `🎉 სწორია! პასუხია: ${optionsArray[correctIndex]}`;
    } else {
        feedbackDiv.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
        feedbackDiv.style.color = "#991b1b";
        feedbackDiv.innerHTML = `❌ არასწორია. სწორი პასუხია: ${optionsArray[correctIndex]}`;
    }

    // Parse the math inside the feedback banner instantly
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(feedbackDiv, {
            delimiters: [
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}
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

// =========================================================================
// GLOBAL STATE VARIABLES (Add to top of script.js)
// =========================================================================
let testQuestions = [];
let currentTestIndex = 0;
let testScore = 0;
let testTimerInterval = null;
let testTimeRemaining = 0; 
let totalTestTime = 0;

// =========================================================================
// RE-CONFIGURED CORE FUNCTIONS (Replace existing ones)
// =========================================================================

/**
 * Builds the visual menu options inside your existing .menu-container
 */
function createCategoryMenu() {
    const menuContainer = document.getElementById('menu');
    if (!menuContainer) return;

    // Clears the menu container dynamically
    menuContainer.innerHTML = ""; 

    // Create cards for each main math branch
    Object.keys(data).forEach(categoryName => {
        const btn = document.createElement('button');
        btn.className = 'category-btn menu-card'; 
        
        btn.innerHTML = `
            <span class="card-content" style="display: block;">${categoryName}</span>
        `;

        btn.onclick = () => startStack(categoryName);
        menuContainer.appendChild(btn);
    });
}

/**
 * Returns UI back to the main dashboard state safely
 */
function goHome() {
    const searchBackBtn = document.getElementById('back-to-search-btn');
    if (searchBackBtn) searchBackBtn.style.display = 'none';
    
    const searchInput = document.getElementById('app-search');
    if (searchInput) searchInput.value = "";
    
    // Hide test elements and card players
    document.getElementById('test-player').style.display = 'none';
    document.getElementById('test-results').style.display = 'none';
    document.getElementById('player').style.display = 'none';

    // Show top navigation controls and the menu grid
    document.querySelector('.top-nav-bar').style.display = 'flex';
    const menuContainer = document.getElementById('menu');
    menuContainer.style.display = 'grid'; 
    menuContainer.classList.remove('searching');
    
    createCategoryMenu();
}

// =========================================================================
// MIXED TEST ENGINE (Paste at the bottom of script.js)
// =========================================================================
// =========================================================================
// MIXED TEST ENGINE & SIDEBAR ROUTING
// =========================================================================

/**
 * Gathers all matching MCQs across all categories and starts a random test
 * @param {number} numQuestions - Total number of questions to pull
 */
function startRandomTest(numQuestions = 10) {
    testQuestions = [];
    
    // 1. Gather all tasks that have structural multiple-choice options
    Object.keys(data).forEach(categoryName => {
        const categorySource = Array.isArray(data[categoryName]) ? data[categoryName] : data[categoryName].cards;
        
        categorySource.forEach(card => {
            if (card.tasks && Array.isArray(card.tasks)) {
                card.tasks.forEach(task => {
                    if (task.options && Array.isArray(task.options) && task.options.length > 0) {
                        testQuestions.push(task);
                    }
                });
            }
        });
    });

    // 2. Error handling if no multiple-choice items exist
    if (testQuestions.length === 0) {
        showAppAlert("ტესტები ვერ მოიძებნა! დარწმუნდით, რომ ფაილში გაქვთ 'options' ველის მქონე კითხვები.");
        return;
    }

    // 3. Shuffle arrays cleanly using existing helper or fallback random sort
    if (typeof shuffleArray === 'function') {
        shuffleArray(testQuestions);
    } else {
        testQuestions.sort(() => Math.random() - 0.5);
    }
    
    // Slice down to requested constraint length
    testQuestions = testQuestions.slice(0, Math.min(numQuestions, testQuestions.length));

    // 4. Reset engine states & compute structural timers (90s per question)
    currentTestIndex = 0;
    testScore = 0;
    testTimeRemaining = testQuestions.length * 90; 
    totalTestTime = testTimeRemaining;

    // 5. De-render standard view panels and activate test viewport
    document.getElementById('menu').style.display = 'none';
    if (document.querySelector('.top-nav-bar')) {
        document.querySelector('.top-nav-bar').style.display = 'none';
    }
    document.getElementById('player').style.display = 'none';
    document.getElementById('test-results').style.display = 'none';
    document.getElementById('test-player').style.display = 'block';

    startTestTimer();
    displayTestQuestion();
}

/**
 * Renders the active test question state to the DOM and builds choice options
 */
function displayTestQuestion() {
    const task = testQuestions[currentTestIndex];
    
    document.getElementById('test-next-btn').style.display = "none";
    const optionsContainer = document.getElementById('test-options');
    optionsContainer.innerHTML = "";
    
    document.getElementById('test-question-text').innerHTML = task.q;
    document.getElementById('test-progress-text').innerText = `კითხვა: ${currentTestIndex + 1} / ${testQuestions.length}`;
    
    const progressPercent = (currentTestIndex / testQuestions.length) * 100;
    document.getElementById('test-progress-bar').style.width = `${progressPercent}%`;

    // Generate option elements dynamically
    task.options.forEach((optionText, index) => {
        const btn = document.createElement('button');
        btn.className = "option-btn";
        btn.style.cssText = "width: 100%; text-align: left; margin-bottom: 8px;";
        btn.innerHTML = optionText;
        
        btn.onclick = () => submitTestAnswer(btn, index, task.correct);
        optionsContainer.appendChild(btn);
    });

    // Fire LaTeX compiling post-render
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.getElementById('test-player'), {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}
            ],
            throwOnError: false
        });
    }
}

/**
 * Handles processing choice submission, tracking scoring accuracy, and styling nodes
 */
function submitTestAnswer(clickedBtn, selectedIndex, correctIndex) {
    const optionsContainer = document.getElementById('test-options');
    const buttons = optionsContainer.querySelectorAll('.option-btn');

    buttons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === correctIndex) {
            btn.classList.add('correct');
        } else if (index === selectedIndex) {
            btn.classList.add('wrong');
        }
    });

    if (selectedIndex === correctIndex) {
        testScore++;
    }

    document.getElementById('test-next-btn').style.display = "block";
}

/**
 * Navigates to the next test item or cleanly calls evaluation completion sequences
 */
function nextTestQuestion() {
    currentTestIndex++;
    if (currentTestIndex < testQuestions.length) {
        displayTestQuestion();
    } else {
        finishTest();
    }
}

/**
 * Runs execution loops for the countdown manager engine
 */
function startTestTimer() {
    if (testTimerInterval) clearInterval(testTimerInterval);
    updateTimerDisplay();
    
    testTimerInterval = setInterval(() => {
        testTimeRemaining--;
        updateTimerDisplay();
        
        if (testTimeRemaining <= 0) {
            clearInterval(testTimerInterval);
            showAppAlert("დრო ამოიწურა!");
            finishTest();
        }
    }, 1000);
}

/**
 * Syncs the internal time remaining integer state safely to visual layouts
 */
function updateTimerDisplay() {
    const minutes = Math.floor(testTimeRemaining / 60);
    const seconds = testTimeRemaining % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('test-timer').innerText = `⏱️ ${formattedTime}`;
}

/**
 * Halts timers, compiles performance metrics, and serves final results screen
 */
function finishTest() {
    clearInterval(testTimerInterval);
    document.getElementById('test-progress-bar').style.width = "100%";

    const timeSpentSeconds = totalTestTime - testTimeRemaining;
    const spentMinutes = Math.floor(timeSpentSeconds / 60);
    const spentSeconds = timeSpentSeconds % 60;
    const formattedSpentTime = `${String(spentMinutes).padStart(2, '0')}:${String(spentSeconds).padStart(2, '0')}`;

    document.getElementById('results-score').innerText = `სწორი პასუხები: ${testScore} / ${testQuestions.length}`;
    document.getElementById('results-time').innerText = `გახარჯული დრო: ${formattedSpentTime}`;

    document.getElementById('test-player').style.display = 'none';
    document.getElementById('test-results').style.display = 'block';
}

/**
 * Safeguards users against accidental state destruction mid-test
 */
function exitTest() {
    if (confirm("ნამდვილად გსურთ ტესტირების შეწყვეტა? მიმდინარე პროგრესი დაიკარგება.")) {
        clearInterval(testTimerInterval);
        goHomeFromTest();
    }
}

/**
 * Disconnects operational view state frames of active testing to fallback home templates
 */
function goHomeFromTest() {
    document.getElementById('test-player').style.display = 'none';
    document.getElementById('test-results').style.display = 'none';
    goHome();
}

/**
 * Opens or closes the slide-out sidebar navigation menu
 * @param {boolean} isOpen 
 */
function toggleSidebar(isOpen) {
    const sidebar = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;
    
    if (isOpen) {
        overlay.style.display = "block";
        void overlay.offsetWidth; // Force reflow to ensure CSS transition triggers smoothly
        overlay.style.opacity = "1";
        sidebar.style.left = "0px";
    } else {
        sidebar.style.left = "-280px";
        overlay.style.opacity = "0";
        
        // Hide overlay container after fade-out transition completes
        setTimeout(() => {
            if (sidebar.style.left === "-280px") {
                overlay.style.display = "none";
            }
        }, 300);
    }
}

/**
 * Central routing processor executing actions called directly from sidebar navigation items
 * @param {string} actionType - Identifies target route paths
 */
function handleSidebarAction(actionType) {
    toggleSidebar(false); // Cleanly stow drawer panels out of frame first
    
    // 🎯 CASE 1: ROUTE ROUTINES TO RANDOM GENERATION ENGINE
    if (actionType === 'test') {
        startRandomTest(10);
    } 
    // 🎯 CASE 2: ROUTE SYSTEM TO SAVED BOOKMARKS VIEWER CAROUSEL
    else if (actionType === 'bookmarks') {
        if (!bookmarkedCards || bookmarkedCards.length === 0) {
            showAppAlert("სანიშნეების სია ცარიელია! მონიშნეთ ბარათები ვარსკვლავით.");
            return;
        }  
        
        currentStack = [...bookmarkedCards];
        currentIndex = 0;
        
        document.getElementById('menu').style.display = 'none';
        document.getElementById('player').style.display = 'block';
        if (document.getElementById('test-player')) {
            document.getElementById('test-player').style.display = 'none';
        }
        if (document.getElementById('test-results')) {
            document.getElementById('test-results').style.display = 'none';
        }
        
        document.getElementById('category-title').innerText = "⭐ ჩემი სანიშნეები";
        updateCard();
    }
}

/**
 * Serves app alert message down into structural modal overlay templates
 * @param {string} message - Text context targeted for structural distribution
 */
function showAppAlert(message) {
    const alertText = document.getElementById('app-alert-text');
    const alertModal = document.getElementById('app-alert-modal');
    if (alertText && alertModal) {
        alertText.innerText = message;
        alertModal.style.display = 'flex';
    }
}

/**
 * Removes custom alert box overlay structures out of layout rendering frames
 */
function closeAppAlert() {
    const alertModal = document.getElementById('app-alert-modal');
    if (alertModal) {
        alertModal.style.display = 'none';
    }
}

// =========================================================================
// GESTURE ENGINE: MOBILE TOUCH EVENTS WITH VISUAL SHUFFLE ANIMATION
// =========================================================================
let touchStartX = 0;
let touchEndX = 0;

function setupSwipeGestures(cardElement) {
    cardElement.removeEventListener('touchstart', handleTouchStart);
    cardElement.removeEventListener('touchend', handleTouchEnd);

    cardElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    cardElement.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(event) {
    touchStartX = event.changedTouches[0].screenX;
}

function handleTouchEnd(event) {
    touchEndX = event.changedTouches[0].screenX;
    handleSwipeThreshold();
}

function handleSwipeThreshold() {
    const swipeThreshold = 60; // Minimum distance in pixels
    const swipeDistance = touchEndX - touchStartX;

    // Guard against running shifts if overlay interaction fields are active
    const tModal = document.getElementById('theory-modal');
    const taskModal = document.getElementById('task-modal');
    if ((tModal && tModal.style.display === 'block') || (taskModal && taskModal.style.display === 'block')) {
        return;
    }

    const flashcard = document.querySelector('.flashcard');
    if (!flashcard) return;

    if (swipeDistance < -swipeThreshold) {
        // ➡️ Swiped Left: Animate out to the left
        animateAndChangeCard(flashcard, 'left', nextCard);
    } else if (swipeDistance > swipeThreshold) {
        // ⬅️ Swiped Right: Animate out to the right
        animateAndChangeCard(flashcard, 'right', prevCard);
    }
}

/**
 * Handles the smooth slide-out, state swap, and slide-in transition mechanics
 */
/**
 * Handles the smooth slide-out, state swap, and slide-in transition mechanics
 */
function animateAndChangeCard(cardElement, direction, changeCardStateFunction) {
    // 1. Prepare fast transitions for the exit
    cardElement.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
    
    // 2. Throw the card off-screen in the correct direction
    const shiftX = direction === 'left' ? '-120%' : '120%';
    cardElement.style.transform = `translateX(${shiftX}) rotate(${direction === 'left' ? '-10deg' : '10deg'})`;
    cardElement.style.opacity = '0';

    // 3. Wait for the exit animation to finish
    setTimeout(() => {
        // Cut off transitions temporarily so changes happen invisibly
        cardElement.style.transition = 'none';
        
        // Load the actual next/prev data state
        changeCardStateFunction(); 
        
        // Reposition the card on the opposite side off-screen immediately
        const resetX = direction === 'left' ? '120%' : '-120%';
        cardElement.style.transform = `translateX(${resetX})`;

        // 4. Force a tiny DOM layout calculation pause, then slide it beautifully back to center
        requestAnimationFrame(() => {
            setTimeout(() => {
                // Re-enable smooth transitions for sliding in
                cardElement.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.15), opacity 0.3s ease';
                cardElement.style.transform = 'translateX(0) rotate(0deg)';
                cardElement.style.opacity = '1';
                
                // 🛠️ FIX: Clean up inline styles completely after slide-in finishes (300ms)
                // This unlocks the element so your standard CSS flip mechanics can work flawlessly!
                setTimeout(() => {
                    cardElement.style.transform = '';
                    cardElement.style.transition = '';
                    cardElement.style.opacity = '';
                }, 300); 

            }, 20);
        });
    }, 250);
}



// 7. AUTOMATED FILE DATA INITIALIZATION TRIGGER
loadData();