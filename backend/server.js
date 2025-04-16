const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer'); // Import multer
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3

const app = express();
const PORT = process.env.PORT || 5001; // Port for the backend server

// --- Configuration ---
const DATA_DIR = path.join(__dirname, 'data');
const MEDIA_DIR = path.join(__dirname, 'user_media'); // Directory for user uploads
const CARDS_DATA_FILE = path.join(DATA_DIR, 'flashcards_data.json');
const STATS_DATA_FILE = path.join(DATA_DIR, 'flashcards_stats.json');
const DEFAULT_CARDS_DATA = { decks: { Default: { cards: [] } } };
const DEFAULT_STATS_DATA = [];

// --- Database Setup ---
const DB_FILE = path.join(__dirname, 'flashcards.db');
const db = new sqlite3.Database(DB_FILE, (err) => {
	if (err) {
		console.error("Error opening database", err.message);
	} else {
		console.log('Connected to the SQLite database.');
		initDB(); // Initialize tables after connection
	}
});

// Function to initialize database tables
async function initDB() {
	// Use async/await with db.run for cleaner syntax (requires wrapping db methods)
	const run = (query, params = []) => new Promise((resolve, reject) => {
		db.run(query, params, function (err) { // Use function() to access this.lastID
			if (err) reject(err);
			else resolve({ lastID: this.lastID, changes: this.changes });
		});
	});

	try {
		console.log("Initializing database tables if they don't exist...");
		await run(`
			CREATE TABLE IF NOT EXISTS decks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL UNIQUE
			)
		`);
		console.log("'decks' table verified/created.");

		await run(`
			CREATE TABLE IF NOT EXISTS cards (
				id INTEGER PRIMARY KEY AUTOINCREMENT, 
				deck_id INTEGER NOT NULL, 
				front_type TEXT NOT NULL DEFAULT 'text', 
				front_content TEXT NOT NULL, 
				back_type TEXT NOT NULL DEFAULT 'text', 
				back_content TEXT NOT NULL, 
				due_date TEXT NOT NULL,  -- ISO8601 string
				interval REAL NOT NULL DEFAULT 1.0, -- Use REAL for potential fractional days
				ease_factor REAL NOT NULL DEFAULT 2.5, 
				mod INTEGER NOT NULL DEFAULT (strftime('%s', 'now')), -- Modification timestamp (unix epoch)
				FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
			)
		`);
		console.log("'cards' table verified/created.");

		// Create revlog table
		await run(`
			CREATE TABLE IF NOT EXISTS revlog (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				card_id INTEGER NOT NULL,          -- ID of the card reviewed
				review_time TEXT NOT NULL,       -- ISO8601 timestamp of the review
				quality INTEGER NOT NULL,          -- Rating (0=Again, 1=Hard, 2=Good, 3=Easy)
				last_interval REAL NOT NULL,       -- Interval before this review (days)
				new_interval REAL NOT NULL,        -- Interval after this review (days)
				new_ease_factor REAL NOT NULL,     -- Ease factor after this review
				time_taken INTEGER             -- Time taken for review in ms (optional, add later)
				-- Removed foreign key for simplicity, card_id is enough
			)
		`);
		console.log("'revlog' table verified/created.");

		// Add indexes for performance
		await run(`CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards (deck_id)`);
		await run(`CREATE INDEX IF NOT EXISTS idx_cards_due_date ON cards (due_date)`);
		await run(`CREATE INDEX IF NOT EXISTS idx_revlog_card_id ON revlog (card_id)`); // Index for revlog
		console.log("Indexes verified/created.");

		console.log("Database initialization complete.");

	} catch (err) {
		console.error("Error initializing database:", err.message);
		// Consider exiting if DB init fails?
	}
}

// --- Middleware ---
app.use(cors()); // Allow requests from frontend (React app)
app.use(express.json({ limit: '50mb' })); // Allow large Excalidraw data
app.use('/media', express.static(MEDIA_DIR));

// --- Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, MEDIA_DIR);
	},
	filename: function (req, file, cb) {
		// Add timestamp prefix to avoid name collisions
		const uniquePrefix = Date.now() + '-';
		cb(null, uniquePrefix + file.originalname);
	}
});

const upload = multer({ storage: storage });

// --- Utility Functions ---

// Ensure data directory exists
const ensureDataDirExists = async () => {
	try {
		await fs.access(DATA_DIR);
	} catch (error) {
		if (error.code === 'ENOENT') {
			await fs.mkdir(DATA_DIR);
			console.log(`Created data directory: ${DATA_DIR}`);
		} else {
			console.error("Error checking data directory:", error);
			throw error; // Re-throw other errors
		}
	}
};

// Load data from a JSON file, create if not exists
const loadJsonFile = async (filePath, defaultData) => {
	await ensureDataDirExists(); // Make sure directory exists first
	try {
		const rawData = await fs.readFile(filePath, 'utf-8');
		return JSON.parse(rawData);
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.log(`File not found: ${filePath}. Creating with default data.`);
			await saveJsonFile(filePath, defaultData);
			return defaultData;
		} else if (error instanceof SyntaxError) {
			console.error(`Error parsing JSON from ${filePath}:`, error);
			// Decide how to handle corrupted JSON (e.g., return default, throw error)
			console.log('Returning default data due to JSON parse error.');
			await saveJsonFile(filePath, defaultData); // Overwrite corrupted file
			return defaultData;
		} else {
			console.error(`Error reading file ${filePath}:`, error);
			throw error; // Re-throw other errors
		}
	}
};

// Save data to a JSON file
const saveJsonFile = async (filePath, data) => {
	await ensureDataDirExists();
	try {
		const jsonData = JSON.stringify(data, null, 4); // Pretty print JSON
		await fs.writeFile(filePath, jsonData, 'utf-8');
	} catch (error) {
		console.error(`Error writing file ${filePath}:`, error);
		throw error;
	}
};

// Simplified Spaced Repetition Logic (Ported from Python)
const updateCardSchedule = (card, quality) => {
	const now = new Date();
	let interval = card.interval || 1;
	let easeFactor = card.ease_factor || 2.5;
	let dueDateISO;

	if (quality < 2) { // 0: Again, 1: Hard
		// Reset interval for both Again and Hard, as session handles immediate review
		interval = 1;
		// Reduce ease factor
		easeFactor = Math.max(1.3, easeFactor - (quality === 0 ? 0.20 : 0.15));
		// Set due date slightly in the future to ensure it's picked up if needed,
		// but session logic primarily controls 'Again' cards now.
		// Use a longer delay for Hard than Again. 
		const delayMinutes = quality === 0 ? 1 : 5; // e.g., 1 min for Again, 5 mins for Hard
		dueDateISO = new Date(now.getTime() + delayMinutes * 60 * 1000).toISOString();

	} else { // 2: Good, 3: Easy
		if (interval <= 1) { // First successful review or coming from reset
			interval = quality === 2 ? 1 : 4; // 1 day for Good, 4 days for Easy
		} else {
			// Apply ease factor for subsequent reviews
			// Ensure interval increases reasonably, especially with high ease factors
			const newInterval = Math.round(interval * easeFactor);
			// Prevent excessively long jumps initially - maybe cap increase?
			interval = Math.max(interval + 1, newInterval); // Ensure interval increases by at least 1 day
		}
		easeFactor = easeFactor + (quality === 3 ? 0.15 : 0); // Slightly larger boost for Easy? Adjusted from 0.1
		// Calculate due date based on the new interval (in days)
		dueDateISO = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();
	}

	// Assign updated values back to the card object
	card.interval = interval;
	card.ease_factor = easeFactor;
	card.due_date = dueDateISO;
	// console.log(`Updated Card Schedule: Quality=${quality}, Interval=${card.interval}d, Ease=${card.ease_factor.toFixed(2)}, Due=${card.due_date}`);
};

// --- API Endpoints (Refactoring for SQLite) ---

// Helper function to run SELECT queries that return multiple rows
const all = (query, params = []) => new Promise((resolve, reject) => {
	db.all(query, params, (err, rows) => {
		if (err) reject(err);
		else resolve(rows);
	});
});

// Helper function to run SELECT query that returns a single row
const get = (query, params = []) => new Promise((resolve, reject) => {
	db.get(query, params, (err, row) => {
		if (err) reject(err);
		else resolve(row);
	});
});

// Helper function to run INSERT/UPDATE/DELETE queries
const run = (query, params = []) => new Promise((resolve, reject) => {
	db.run(query, params, function (err) { // Use function() to access this.lastID/changes
		if (err) reject(err);
		// For INSERT, return lastID. For UPDATE/DELETE, return changes.
		else resolve({ lastID: this.lastID, changes: this.changes });
	});
});

// Get all decks (names and counts - refactored for SQLite)
app.get('/api/decks', async (req, res) => {
	console.log('GET /api/decks request received');
	try {
		// Query to get deck names and count cards for each deck
		const query = `
			SELECT 
				d.id, 
				d.name, 
				COUNT(c.id) as card_count,
				SUM(CASE WHEN date(c.due_date) <= date('now') THEN 1 ELSE 0 END) as due_count,
				SUM(CASE WHEN date(c.due_date) <= date('now') AND c.interval <= 1 THEN 1 ELSE 0 END) as new_count
			FROM decks d
			LEFT JOIN cards c ON d.id = c.deck_id
			GROUP BY d.id, d.name
			ORDER BY d.name COLLATE NOCASE;
		`;
		const decksWithCounts = await all(query);

		// Map to expected frontend format (id is not usually needed on frontend deck list)
		const frontendDecks = decksWithCounts.map(d => ({
			name: d.name,
			card_count: d.card_count || 0,
			due_count: d.due_count || 0,
			new_count: d.new_count || 0
		}));

		res.json(frontendDecks);

	} catch (error) {
		console.error("Error loading decks from DB:", error.message);
		res.status(500).json({ message: "Error loading decks", error: error.message });
	}
});

// Create a new deck (refactored for SQLite)
app.post('/api/decks', async (req, res) => {
	console.log('POST /api/decks request received');
	const deckName = req.body.name; // Assuming name comes in body.name now

	if (!deckName || typeof deckName !== 'string' || deckName.trim() === '') {
		return res.status(400).json({ error: "Invalid or missing deck name" });
	}
	const trimmedDeckName = deckName.trim();

	try {
		// Check if deck already exists
		const existingDeck = await get(`SELECT id FROM decks WHERE name = ?`, [trimmedDeckName]);
		if (existingDeck) {
			return res.status(409).json({ error: `Deck '${trimmedDeckName}' already exists` }); // 409 Conflict
		}

		// Insert the new deck
		const result = await run(`INSERT INTO decks (name) VALUES (?)`, [trimmedDeckName]);
		console.log(`Added new deck: '${trimmedDeckName}' with ID ${result.lastID}`);

		// Return the newly created deck info (matching the GET format)
		res.status(201).json({
			name: trimmedDeckName,
			card_count: 0,
			due_count: 0,
			new_count: 0
		});

	} catch (error) {
		console.error("Error adding deck to DB:", error.message);
		// Check for UNIQUE constraint error specifically
		if (error.message.includes('UNIQUE constraint failed')) {
			return res.status(409).json({ error: `Deck '${trimmedDeckName}' already exists` });
		}
		res.status(500).json({ message: "Error adding deck", error: error.message });
	}
});

// Get all cards for a specific deck (refactored for SQLite)
app.get('/api/decks/:deckName/cards/all', async (req, res) => {
	const { deckName } = req.params;
	console.log(`GET /api/decks/${deckName}/cards/all request received`);

	try {
		// 1. Find the deck ID
		const deck = await get(`SELECT id FROM decks WHERE name = ?`, [deckName]);
		if (!deck) {
			return res.status(404).json({ error: `Deck '${deckName}' not found` });
		}
		const deckId = deck.id;

		// 2. Get all cards for this deck
		const cards = await all(`SELECT * FROM cards WHERE deck_id = ? ORDER BY id`, [deckId]);
		console.log(`Found ${cards.length} total cards for deck '${deckName}' (Study All)`);

		// Optional: Shuffle cards before sending?
		// Fisher-Yates shuffle:
		for (let i = cards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[cards[i], cards[j]] = [cards[j], cards[i]];
		}

		res.json(cards);

	} catch (error) {
		console.error(`Error loading all cards for deck '${deckName}':`, error.message);
		res.status(500).json({ message: "Error loading cards", error: error.message });
	}
});

// Get due cards for a specific deck (refactored for SQLite)
app.get('/api/decks/:deckName/cards/due', async (req, res) => {
	const { deckName } = req.params;
	console.log(`GET /api/decks/${deckName}/cards/due request received`);

	try {
		// 1. Find the deck ID
		const deck = await get(`SELECT id FROM decks WHERE name = ?`, [deckName]);
		if (!deck) {
			return res.status(404).json({ error: `Deck '${deckName}' not found` });
		}
		const deckId = deck.id;

		// 2. Get due cards for this deck
		const dueCards = await all(
			`SELECT * FROM cards WHERE deck_id = ? AND date(due_date) <= date('now') ORDER BY due_date`,
			[deckId]
		);
		console.log(`Found ${dueCards.length} due cards for deck '${deckName}'`);

		// Optional: Shuffle due cards?
		for (let i = dueCards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[dueCards[i], dueCards[j]] = [dueCards[j], dueCards[i]];
		}

		res.json(dueCards);

	} catch (error) {
		console.error(`Error loading due cards for deck '${deckName}':`, error.message);
		res.status(500).json({ message: "Error loading due cards", error: error.message });
	}
});

// Add a new card to a deck (refactored for SQLite)
app.post('/api/decks/:deckName/cards', async (req, res) => {
	const { deckName } = req.params;
	const { front_type, front_content, back_type, back_content } = req.body;
	console.log(`POST /api/decks/${deckName}/cards request received`);

	// Validate input
	if (!front_type || !front_content || !back_type || !back_content) {
		return res.status(400).json({ error: "Missing card content fields" });
	}
	if (!['text', 'image', 'excalidraw'].includes(front_type) || !['text', 'image', 'excalidraw'].includes(back_type)) {
		return res.status(400).json({ error: "Invalid content type" });
	}

	try {
		// 1. Find the deck ID
		const deck = await get(`SELECT id FROM decks WHERE name = ?`, [deckName]);
		if (!deck) {
			return res.status(404).json({ error: `Deck '${deckName}' not found` });
		}
		const deckId = deck.id;

		// 2. Prepare content (minify Excalidraw)
		let final_front_content = front_content;
		if (front_type === 'excalidraw') {
			try { final_front_content = JSON.stringify(JSON.parse(front_content)); } catch (e) { /* ignore parse error, save as is */ }
		}
		let final_back_content = back_content;
		if (back_type === 'excalidraw') {
			try { final_back_content = JSON.stringify(JSON.parse(back_content)); } catch (e) { /* ignore parse error, save as is */ }
		}

		// 3. Set initial scheduling values
		const initialDueDate = new Date().toISOString();
		const initialInterval = 1.0;
		const initialEaseFactor = 2.5;

		// 4. Insert the new card
		const query = `
			INSERT INTO cards 
			(deck_id, front_type, front_content, back_type, back_content, due_date, interval, ease_factor)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`;
		const params = [
			deckId,
			front_type, final_front_content,
			back_type, final_back_content,
			initialDueDate, initialInterval, initialEaseFactor
		];
		const result = await run(query, params);
		const newCardId = result.lastID;

		console.log(`Added card with ID ${newCardId} to deck '${deckName}' (ID: ${deckId})`);

		// 5. Retrieve and return the newly created card
		const newCard = await get(`SELECT * FROM cards WHERE id = ?`, [newCardId]);
		if (!newCard) {
			// This should not happen if insert succeeded
			throw new Error("Failed to retrieve newly created card.");
		}
		res.status(201).json(newCard);

	} catch (error) {
		console.error(`Error adding card to deck '${deckName}':`, error.message);
		res.status(500).json({ message: "Error adding card", error: error.message });
	}
});

// Rate a card and update its review schedule (refactored for SQLite)
app.post('/api/decks/:deckName/cards/:cardId/rate', async (req, res) => {
	const { deckName, cardId: cardIdString } = req.params;
	const { quality, timeTakenMs } = req.body;
	const cardId = parseInt(cardIdString, 10);

	console.log(`POST /api/decks/${deckName}/cards/${cardId}/rate request received with quality ${quality}, time: ${timeTakenMs}`);

	// Validate input
	if (quality === undefined || typeof quality !== 'number' || quality < 0 || quality > 3) {
		return res.status(400).json({ error: 'Invalid quality value. Must be a number between 0 and 3.' });
	}
	if (isNaN(cardId)) {
		return res.status(400).json({ error: 'Invalid card ID.' });
	}

	try {
		// 1. Get the current card data from DB to get last interval etc.
		const currentCard = await get(`SELECT * FROM cards WHERE id = ?`, [cardId]);
		if (!currentCard) {
			return res.status(404).json({ error: `Card with ID ${cardId} not found.` });
		}
		const lastInterval = currentCard.interval; // Store before modification

		// 2. Calculate the new schedule using the helper function
		// Make a copy to update, so we have original for logging
		const cardToUpdate = { ...currentCard };
		updateCardSchedule(cardToUpdate, quality);
		const newInterval = cardToUpdate.interval;
		const newEaseFactor = cardToUpdate.ease_factor;
		const newDueDate = cardToUpdate.due_date;

		// 3. Update the card in the database
		const updateQuery = `
			UPDATE cards 
			SET due_date = ?, interval = ?, ease_factor = ?, mod = strftime('%s', 'now')
			WHERE id = ?
		`;
		const updateParams = [newDueDate, newInterval, newEaseFactor, cardId];
		const updateResult = await run(updateQuery, updateParams);
		if (updateResult.changes === 0) {
			throw new Error("Card update failed, no rows affected.");
		}
		console.log(`Successfully updated schedule for card ID ${cardId}`);

		// 4. Record review in revlog table, including time_taken
		const reviewTime = new Date().toISOString();
		const revlogQuery = `
			INSERT INTO revlog (card_id, review_time, quality, last_interval, new_interval, new_ease_factor, time_taken)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`;
		const revlogParams = [
			cardId,
			reviewTime,
			quality,
			lastInterval,
			newInterval,
			newEaseFactor,
			timeTakenMs // Add time_taken value here
		];
		await run(revlogQuery, revlogParams);
		console.log(`Recorded review for card ID ${cardId} in revlog (time: ${timeTakenMs}ms).`);

		// 5. Send success response 
		res.status(200).json({ message: "Card rated successfully" });

	} catch (error) {
		console.error(`Error rating card ${cardId} in deck ${deckName}:`, error.message);
		res.status(500).json({ message: "Error rating card", error: error.message });
	}
});

// Update card content (refactored for SQLite)
app.patch('/api/decks/:deckName/cards/:cardId', async (req, res) => {
	const { deckName, cardId: cardIdString } = req.params;
	const { side, newContent } = req.body; // side: 'front' | 'back'
	const cardId = parseInt(cardIdString, 10); // Assume IDs are numbers from DB

	console.log(`PATCH /api/decks/${deckName}/cards/${cardId} request received for side: ${side}`);

	// Validate input
	if (!side || newContent === undefined || newContent === null) { // Allow empty string for content
		return res.status(400).json({ error: 'Missing side or newContent in request body' });
	}
	if (side !== 'front' && side !== 'back') {
		return res.status(400).json({ error: 'Invalid side parameter' });
	}
	if (isNaN(cardId)) {
		return res.status(400).json({ error: 'Invalid card ID.' });
	}

	try {
		// 1. Get the current card data to check its type
		const cardToUpdate = await get(`SELECT id, front_type, back_type, deck_id FROM cards WHERE id = ?`, [cardId]);

		if (!cardToUpdate) {
			return res.status(404).json({ error: `Card with ID ${cardId} not found.` });
		}

		// Optional: Verify deck name?
		// const deck = await get(`SELECT id FROM decks WHERE name = ?`, [deckName]);
		// if (!deck || deck.id !== cardToUpdate.deck_id) { ... }

		// 2. Prepare content (minify Excalidraw)
		const typeKey = side === 'front' ? 'front_type' : 'back_type';
		const updateKey = side === 'front' ? 'front_content' : 'back_content';
		let contentToSave = newContent;

		if (cardToUpdate[typeKey] === 'excalidraw') {
			try {
				const parsed = JSON.parse(newContent);
				contentToSave = JSON.stringify(parsed); // Minified
				console.log(`Minified Excalidraw content for card ${cardId}, side ${side}.`);
			} catch (e) {
				console.warn(`Failed to parse/minify Excalidraw content for card ${cardId}, side ${side}. Saving as is. Error: ${e.message}`);
				contentToSave = newContent; // Save original if parse fails
			}
		}

		// 3. Update the card content and modification time in the database
		const updateQuery = `
			UPDATE cards 
			SET 
				${updateKey} = ?,
				mod = strftime('%s', 'now')
			WHERE id = ?
		`;
		const updateParams = [contentToSave, cardId];

		const result = await run(updateQuery, updateParams);

		if (result.changes === 0) {
			// Should not happen if the card was found earlier
			throw new Error("Card update failed, no rows affected.");
		}

		console.log(`Successfully updated ${updateKey} for card ID ${cardId}`);

		// 4. Retrieve and return the full updated card
		const updatedCard = await get(`SELECT * FROM cards WHERE id = ?`, [cardId]);
		if (!updatedCard) {
			throw new Error("Failed to retrieve updated card data after update.");
		}
		res.status(200).json(updatedCard);

	} catch (error) {
		console.error(`Error updating content for card ${cardId}:`, error.message);
		res.status(500).json({ message: "Error updating card content", error: error.message });
	}
});

// Delete a single card (added)
app.delete('/api/decks/:deckName/cards/:cardId', async (req, res) => {
	const { deckName, cardId: cardIdString } = req.params;
	const cardId = parseInt(cardIdString, 10);
	console.log(`DELETE /api/decks/${deckName}/cards/${cardId} request received`);

	if (isNaN(cardId)) {
		return res.status(400).json({ error: 'Invalid card ID.' });
	}

	try {
		// 1. Verify card exists and belongs to the deck
		const card = await get(
			`SELECT id, deck_id FROM cards WHERE id = ?`,
			[cardId]
		);
		if (!card) {
			return res.status(404).json({ error: `Card with ID ${cardId} not found.` });
		}

		const deck = await get(
			`SELECT id FROM decks WHERE name = ?`,
			[deckName]
		);
		if (!deck || deck.id !== card.deck_id) {
			return res.status(404).json({ error: `Card with ID ${cardId} not found in deck '${deckName}'.` });
		}

		// 2. Delete the card
		const result = await run(
			`DELETE FROM cards WHERE id = ?`,
			[cardId]
		);
		if (result.changes === 0) {
			throw new Error('Card deletion failed, no rows affected.');
		}

		console.log(`Successfully deleted card ID ${cardId} from deck '${deckName}'.`);
		res.status(200).json({ message: `Card ${cardId} deleted successfully.` });
	} catch (error) {
		console.error(`Error deleting card ${cardId} in deck '${deckName}':`, error.message);
		res.status(500).json({ message: 'Error deleting card', error: error.message });
	}
});

// Delete a deck (refactored for SQLite)
app.delete('/api/decks/:deckName', async (req, res) => {
	const { deckName } = req.params;
	console.log(`DELETE /api/decks/${deckName} request received`);

	if (deckName === 'Default') {
		return res.status(400).json({ error: "Cannot delete the 'Default' deck" });
	}
	if (typeof deckName !== 'string' || deckName.trim() === '') {
		return res.status(400).json({ error: "Invalid deck name provided" });
	}

	try {
		// 1. Find the deck ID
		const deck = await get(`SELECT id FROM decks WHERE name = ?`, [deckName]);
		if (!deck) {
			return res.status(404).json({ error: `Deck '${deckName}' not found` });
		}
		const deckId = deck.id;

		// 2. Delete the deck (cards are deleted by CASCADE)
		const result = await run(`DELETE FROM decks WHERE id = ?`, [deckId]);

		if (result.changes === 0) {
			// Should not happen if the deck was found earlier
			throw new Error("Deck deletion failed, no rows affected.");
		}

		console.log(`Successfully deleted deck '${deckName}' (ID: ${deckId}) and its cards.`);

		// 3. TODO: Delete associated media files? (More complex)

		// 4. Send success response
		res.status(200).json({ message: `Deck '${deckName}' deleted successfully` });

	} catch (error) {
		console.error(`Error deleting deck '${deckName}':`, error.message);
		res.status(500).json({ message: "Error deleting deck", error: error.message });
	}
});

// File Upload Endpoint
// ... (rest of the POST /api/upload endpoint code) ...

// Get review statistics (refactored for SQLite)
app.get('/api/stats', async (req, res) => {
	console.log('GET /api/stats request received');
	try {
		// --- Aggregated Stats ---

		// 1. Reviews in the last 7 days
		const reviewsLast7DaysResult = await get(
			`SELECT COUNT(*) as count FROM revlog WHERE date(review_time) >= date('now', '-7 days')`
		);
		const reviewsLast7Days = reviewsLast7DaysResult.count || 0;

		// 2. Total reviews
		const totalReviewsResult = await get(
			`SELECT COUNT(*) as count FROM revlog`
		);
		const totalReviews = totalReviewsResult.count || 0;

		// 3. Average time taken (optional, requires time_taken to be populated)
		const avgTimeResult = await get(
			`SELECT AVG(time_taken) as avg_ms FROM revlog WHERE time_taken IS NOT NULL AND time_taken > 0`
		);
		const averageTimeSec = avgTimeResult.avg_ms ? (avgTimeResult.avg_ms / 1000).toFixed(1) : null;

		// --- Raw Recent Logs (Optional - keep for detailed view?) ---
		const recentLogsQuery = `
			SELECT 
				r.id, r.card_id, r.review_time, r.quality, r.last_interval, 
				r.new_interval, r.new_ease_factor, r.time_taken,
				c.front_content AS card_front, d.name as deck_name -- Join to get card and deck info
			FROM revlog r
			JOIN cards c ON r.card_id = c.id
			JOIN decks d ON c.deck_id = d.id
			ORDER BY r.review_time DESC
			LIMIT 50 -- Limit recent logs
		`;
		const recentLogsRaw = await all(recentLogsQuery);

		// Format recent logs for frontend
		const formattedRecentLogs = recentLogsRaw.map(row => ({
			timestamp: row.review_time,
			cardId: row.card_id,
			deck: row.deck_name,
			quality: row.quality,
			new_interval_days: row.new_interval,
			new_ease_factor: row.new_ease_factor,
			time_taken_sec: row.time_taken ? (row.time_taken / 1000).toFixed(1) : null,
			front: row.card_front?.substring(0, 50) + (row.card_front?.length > 50 ? '...' : '') // Truncate front
		}));

		// --- Combine and Send Response ---
		res.json({
			summary: {
				reviewsLast7Days: reviewsLast7Days,
				totalReviews: totalReviews,
				averageTimeSec: averageTimeSec
			},
			recentReviews: formattedRecentLogs // Send recent logs as well
		});

	} catch (error) {
		console.error("Error loading stats from DB:", error.message);
		res.status(500).json({ message: "Error loading statistics", error: error.message });
	}
});

// --- Start Server ---
app.listen(PORT, () => {
	console.log(`Backend server running on http://localhost:${PORT}`);
	// Removed directory verification logic as it was tied to JSON files
});

// Graceful shutdown
process.on('SIGINT', () => {
	db.close((err) => {
		if (err) {
			return console.error(err.message);
		}
		console.log('Closed the database connection.');
		process.exit(0);
	});
});