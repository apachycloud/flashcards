const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer'); // Import multer

const app = express();
const PORT = process.env.PORT || 5001; // Port for the backend server

// --- Configuration ---
const DATA_DIR = path.join(__dirname, 'data');
const MEDIA_DIR = path.join(__dirname, 'user_media'); // Directory for user uploads
const CARDS_DATA_FILE = path.join(DATA_DIR, 'flashcards_data.json');
const STATS_DATA_FILE = path.join(DATA_DIR, 'flashcards_stats.json');
const DEFAULT_CARDS_DATA = { decks: { Default: { cards: [] } } };
const DEFAULT_STATS_DATA = [];

// --- Middleware ---
app.use(cors()); // Allow requests from frontend (React app)
app.use(express.json()); // Parse JSON request bodies

// --- Static File Serving ---
// Serve uploaded media files statically from the /media path
app.use('/media', express.static(MEDIA_DIR));

// Ensure media directory exists
const ensureMediaDirExists = async () => {
	try {
		await fs.access(MEDIA_DIR);
	} catch (error) {
		if (error.code === 'ENOENT') {
			await fs.mkdir(MEDIA_DIR);
			console.log(`Created media directory: ${MEDIA_DIR}`);
		} else {
			console.error("Error checking media directory:", error);
			throw error;
		}
	}
};

// --- Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		ensureMediaDirExists().then(() => cb(null, MEDIA_DIR)).catch(err => cb(err));
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

	if (quality < 2) { // 0: Fail, 1: Hard
		interval = 1; // Reset interval
		// For quality 0 (Again), make it due almost immediately (e.g., now + 1 second)
		// For quality 1 (Hard), keep the 10-minute delay for within-session review logic (if implemented later)
		const delayMilliseconds = quality === 0 ? 1000 : 10 * 60000; // 1 second for Again, 10 mins for Hard
		dueDateISO = new Date(now.getTime() + delayMilliseconds).toISOString();
		easeFactor = Math.max(1.3, easeFactor - (quality === 0 ? 0.2 : 0.15));
	} else { // 2: Good, 3: Easy
		if (interval <= 1) { // First successful review or reset
			interval = quality === 2 ? 1 : 4;
		} else {
			interval = Math.round(interval * easeFactor);
		}
		easeFactor = easeFactor + (quality === 3 ? 0.1 : 0);
		dueDateISO = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();
	}

	// Ensure due_date is always in the future from 'now' for active scheduling if quality >= 2
	// Also ensure 'Hard' cards appear later than 'Again' cards if delays are very short
	if (quality >= 1 && new Date(dueDateISO) <= now) {
		// If calculated due date is in the past/now (e.g., for Hard with short delay), push it slightly
		dueDateISO = new Date(now.getTime() + (quality === 1 ? 5 * 60 * 1000 : 1 * 24 * 60 * 60 * 1000)).toISOString(); // 5 mins for Hard, 1 day for Good/Easy if somehow past
	}

	card.interval = interval;
	card.ease_factor = easeFactor;
	card.due_date = dueDateISO;
	// console.log(`Updated Card Schedule: Quality=${quality}, Interval=${card.interval}d, Ease=${card.ease_factor.toFixed(2)}, Due=${card.due_date}`);
};


// --- API Endpoints ---

// Get all deck objects for frontend, including due/new counts
app.get('/api/decks', async (req, res) => {
	try {
		const data = await loadJsonFile(CARDS_DATA_FILE, DEFAULT_CARDS_DATA);
		const now = new Date(); // Get current time once

		const decks = Object.entries(data.decks || {}).map(([name, deckObj]) => {
			const cards = Array.isArray(deckObj.cards) ? deckObj.cards : [];
			const total_count = cards.length;
			let due_count = 0;
			let new_count = 0;

			cards.forEach(card => {
				const dueDate = new Date(card.due_date || 0);
				if (dueDate <= now) {
					due_count++;
					// A card is considered new if it's due and has the initial interval (or no interval)
					if (card.interval === 1 || card.interval === undefined || card.interval === null) {
						new_count++;
					}
				}
			});

			return {
				name,
				card_count: total_count, // Keep total count
				due_count: due_count,
				new_count: new_count,
			};
		});

		res.json(decks);
	} catch (error) {
		res.status(500).json({ message: "Error loading decks", error: error.message });
	}
});

// Get cards due for review in a specific deck
app.get('/api/decks/:deckName/cards/due', async (req, res) => {
	const deckName = req.params.deckName;
	try {
		const data = await loadJsonFile(CARDS_DATA_FILE, DEFAULT_CARDS_DATA);
		if (!data.decks || !data.decks[deckName]) {
			return res.status(404).json({ message: `Deck '${deckName}' not found` });
		}

		const now = new Date();
		const allCards = data.decks[deckName].cards || [];
		const dueCards = allCards.filter(card => {
			const dueDateStr = card.due_date || now.toISOString();
			try {
				// Ensure due_date is in the past or present
				return new Date(dueDateStr) <= now;
			} catch (e) {
				console.warn(`Invalid due date format for card id ${card.id || 'N/A'} in deck ${deckName}: ${dueDateStr}. Considering it due.`);
				card.due_date = now.toISOString(); // Correct invalid date in data
				return true; // Treat invalid date as due
			}
		});

		// TODO: Maybe add validation ensure card has id, front, back?

		// Shuffle due cards (Fisher-Yates shuffle)
		for (let i = dueCards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[dueCards[i], dueCards[j]] = [dueCards[j], dueCards[i]];
		}

		console.log(`Found ${dueCards.length} due cards for deck '${deckName}'`);
		res.json(dueCards);
	} catch (error) {
		res.status(500).json({ message: `Error loading due cards for deck '${deckName}'`, error: error.message });
	}
});

// Get ALL cards in a specific deck (for 'Study All' functionality)
app.get('/api/decks/:deckName/cards/all', async (req, res) => {
	const deckName = req.params.deckName;
	try {
		const data = await loadJsonFile(CARDS_DATA_FILE, DEFAULT_CARDS_DATA);
		if (!data.decks || !data.decks[deckName]) {
			return res.status(404).json({ message: `Deck '${deckName}' not found` });
		}

		const allCards = data.decks[deckName].cards || [];

		// Shuffle all cards (Fisher-Yates shuffle)
		for (let i = allCards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[allCards[i], allCards[j]] = [allCards[j], allCards[i]];
		}

		console.log(`Found ${allCards.length} total cards for deck '${deckName}' (Study All)`);
		res.json(allCards);
	} catch (error) {
		res.status(500).json({ message: `Error loading all cards for deck '${deckName}'`, error: error.message });
	}
});

// Rate a card
app.post('/api/cards/rate', async (req, res) => {
	const { cardId, quality, deckName } = req.body; // Expect cardId, quality (0-3), and deckName

	// Validate input
	if (cardId === undefined || quality === undefined || deckName === undefined) {
		return res.status(400).json({ message: "Missing cardId, quality, or deckName in request body" });
	}
	if (typeof quality !== 'number' || quality < 0 || quality > 3) {
		return res.status(400).json({ message: "Invalid quality value. Must be a number between 0 and 3." });
	}
	if (typeof deckName !== 'string' || deckName.trim() === '') {
		return res.status(400).json({ message: "Invalid or missing deckName." });
	}

	let cardFound = false;
	let updatedCardData;

	try {
		const cardsData = await loadJsonFile(CARDS_DATA_FILE, DEFAULT_CARDS_DATA);
		updatedCardData = JSON.parse(JSON.stringify(cardsData)); // Deep copy to modify

		if (updatedCardData.decks && updatedCardData.decks[deckName] && updatedCardData.decks[deckName].cards) {
			const cardIndex = updatedCardData.decks[deckName].cards.findIndex(card => card.id == cardId); // Use == for potential type difference

			if (cardIndex !== -1) {
				const cardToUpdate = updatedCardData.decks[deckName].cards[cardIndex];
				console.log(`Rating card ID ${cardId} in deck '${deckName}' with quality ${quality}`);
				updateCardSchedule(cardToUpdate, quality); // Update the card's schedule
				cardFound = true;
				// Save the updated card data
				await saveJsonFile(CARDS_DATA_FILE, updatedCardData);

				// Now update stats
				try {
					const statsData = await loadJsonFile(STATS_DATA_FILE, DEFAULT_STATS_DATA);
					const newStat = {
						timestamp: new Date().toISOString(),
						cardId: cardId,
						deck: deckName,
						// front: cardToUpdate.front.substring(0, 50), // Maybe add later if needed
						quality: quality,
						new_interval_days: cardToUpdate.interval,
						// TODO: Add thinking/rating time later
					};
					statsData.push(newStat);
					await saveJsonFile(STATS_DATA_FILE, statsData);
				} catch (statsError) {
					console.error("Error updating stats file:", statsError);
					// Decide if this should be a fatal error for the request
					// For now, we'll just log it and still return success for the card rating itself
				}

			} else {
				console.warn(`Card ID ${cardId} not found in deck '${deckName}' during rating.`);
			}
		} else {
			console.warn(`Deck '${deckName}' not found during rating.`);
		}

		if (!cardFound) {
			return res.status(404).json({ message: `Card with ID ${cardId} not found in deck '${deckName}'` });
		}

		res.status(200).json({ message: "Card rated successfully" });

	} catch (error) {
		console.error("Error rating card:", error);
		res.status(500).json({ message: "Error rating card", error: error.message });
	}
});

// Add a new card to a specific deck
app.post('/api/decks/:deckName/cards', async (req, res) => {
	const deckName = req.params.deckName;
	// Expect new structure: { front_type, front_content, back_type, back_content }
	const { front_type, front_content, back_type, back_content } = req.body;

	// Validate input
	if (!front_type || !front_content || !back_type || !back_content) {
		return res.status(400).json({ message: "Missing card content fields (front/back type or content)" });
	}
	if (!['text', 'image'].includes(front_type) || !['text', 'image'].includes(back_type)) {
		return res.status(400).json({ message: "Invalid content type. Must be 'text' or 'image'." });
	}
	if (typeof deckName !== 'string' || deckName.trim() === '') {
		return res.status(400).json({ message: "Invalid or missing deckName." });
	}

	try {
		const cardsData = await loadJsonFile(CARDS_DATA_FILE, DEFAULT_CARDS_DATA);
		const updatedCardData = JSON.parse(JSON.stringify(cardsData));

		if (!updatedCardData.decks || !updatedCardData.decks[deckName]) {
			return res.status(404).json({ message: `Deck '${deckName}' not found` });
		}
		if (!Array.isArray(updatedCardData.decks[deckName].cards)) {
			updatedCardData.decks[deckName].cards = [];
		}

		// Create the new card object with new structure
		const newCard = {
			id: Date.now(),
			front_type: front_type,
			front_content: front_content,
			back_type: back_type,
			back_content: back_content,
			due_date: new Date().toISOString(),
			interval: 1,
			ease_factor: 2.5
		};

		updatedCardData.decks[deckName].cards.push(newCard);
		console.log(`Added card to deck '${deckName}':`, newCard);

		await saveJsonFile(CARDS_DATA_FILE, updatedCardData);
		res.status(201).json(newCard);

	} catch (error) {
		console.error(`Error adding card to deck '${deckName}':`, error);
		res.status(500).json({ message: "Error adding card", error: error.message });
	}
});

// Add a new deck
app.post('/api/decks', async (req, res) => {
	const deckName = req.body.deckName || req.body.name;

	if (!deckName || typeof deckName !== 'string' || deckName.trim() === '') {
		return res.status(400).json({ message: "Invalid or missing deck name" });
	}

	const trimmedDeckName = deckName.trim();

	try {
		const cardsData = await loadJsonFile(CARDS_DATA_FILE, DEFAULT_CARDS_DATA);
		const updatedCardData = JSON.parse(JSON.stringify(cardsData)); // Deep copy

		if (updatedCardData.decks && updatedCardData.decks[trimmedDeckName]) {
			return res.status(409).json({ message: `Deck '${trimmedDeckName}' already exists` }); // 409 Conflict
		}

		// Ensure decks object exists
		if (!updatedCardData.decks) {
			updatedCardData.decks = {};
		}

		// Add the new deck
		updatedCardData.decks[trimmedDeckName] = { cards: [] };
		console.log(`Added new deck: '${trimmedDeckName}'`);

		// Save the updated data
		await saveJsonFile(CARDS_DATA_FILE, updatedCardData);

		res.status(201).json({ name: trimmedDeckName, card_count: 0 });

	} catch (error) {
		console.error("Error adding deck:", error);
		res.status(500).json({ message: "Error adding deck", error: error.message });
	}
});

// Delete a deck
app.delete('/api/decks/:deckName', async (req, res) => {
	const deckName = req.params.deckName;

	if (deckName === 'Default') {
		return res.status(400).json({ message: "Cannot delete the 'Default' deck" });
	}
	if (typeof deckName !== 'string' || deckName.trim() === '') {
		return res.status(400).json({ message: "Invalid deck name provided" });
	}

	try {
		const cardsData = await loadJsonFile(CARDS_DATA_FILE, DEFAULT_CARDS_DATA);
		const updatedCardData = JSON.parse(JSON.stringify(cardsData)); // Deep copy

		if (!updatedCardData.decks || !updatedCardData.decks[deckName]) {
			return res.status(404).json({ message: `Deck '${deckName}' not found` });
		}

		// Delete the deck
		delete updatedCardData.decks[deckName];
		console.log(`Deleted deck: '${deckName}'`);

		// Save the updated data
		await saveJsonFile(CARDS_DATA_FILE, updatedCardData);

		res.status(200).json({ message: `Deck '${deckName}' deleted successfully` });

	} catch (error) {
		console.error(`Error deleting deck '${deckName}':`, error);
		res.status(500).json({ message: "Error deleting deck", error: error.message });
	}
});

// File Upload Endpoint
app.post('/api/upload', upload.single('imageFile'), (req, res) => {
	// 'imageFile' is the name of the field in the FormData
	if (!req.file) {
		return res.status(400).send({ message: 'No file uploaded.' });
	}
	console.log('File uploaded:', req.file);
	// Return the path or filename so frontend can use it
	res.status(200).json({
		message: 'File uploaded successfully',
		filename: req.file.filename, // Send back the generated filename
		filePath: `/media/${req.file.filename}` // Send back the URL path
	});
});

// Get review statistics
app.get('/api/stats', async (req, res) => {
	try {
		// Load stats, defaulting to an empty array if file doesn't exist or is invalid
		const statsData = await loadJsonFile(STATS_DATA_FILE, DEFAULT_STATS_DATA);
		// Return stats, maybe newest first?
		res.json(statsData.slice().reverse()); // Send a reversed copy (newest first)
	} catch (error) {
		console.error("Error loading stats:", error);
		res.status(500).json({ message: "Error loading statistics", error: error.message });
	}
});

// --- Add more endpoints later for: ---
// - Deleting cards
// - Handling images (uploading/serving)

// --- Start Server ---
app.listen(PORT, async () => { // Make startup async
	console.log(`Backend server running on http://localhost:${PORT}`);
	try {
		await ensureDataDirExists();
		await ensureMediaDirExists(); // Ensure media dir also exists
		console.log("Data and media directories verified.");
	} catch (err) {
		console.error("Failed to ensure directories exist on startup:", err);
	}
}); 