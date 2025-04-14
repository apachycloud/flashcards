import { Deck, Card } from './types';

const API_BASE_URL = '/api'; // Adjust if your API base URL is different

export const fetchDecks = async (): Promise<Deck[]> => {
	console.log('Fetching decks...');
	// Placeholder: Replace with actual API call
	// Example:
	// const response = await fetch(`${API_BASE_URL}/decks`);
	// if (!response.ok) throw new Error('Failed to fetch decks');
	// const data = await response.json();
	// return data.decks; // Assuming the API returns { decks: Deck[] }
	await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
	// Return mock data until API is implemented
	return [
		{ name: 'Default Deck', card_count: 3 },
		{ name: 'Spanish Verbs', card_count: 10 },
	];
};

export const addDeck = async (deckName: string): Promise<boolean> => {
	console.log(`Adding deck: ${deckName}`);
	// Placeholder: Replace with actual API call
	// Example:
	// const response = await fetch(`${API_BASE_URL}/decks`, {
	//   method: 'POST',
	//   headers: { 'Content-Type': 'application/json' },
	//   body: JSON.stringify({ name: deckName })
	// });
	// return response.ok;
	await new Promise(resolve => setTimeout(resolve, 300));
	return true; // Assume success for now
};

export const deleteDeck = async (deckName: string): Promise<boolean> => {
	console.log(`Deleting deck: ${deckName}`);
	// Placeholder: Replace with actual API call
	// Example:
	// const response = await fetch(`${API_BASE_URL}/decks/${encodeURIComponent(deckName)}`, {
	//   method: 'DELETE'
	// });
	// return response.ok;
	await new Promise(resolve => setTimeout(resolve, 300));
	return true; // Assume success for now
};

export const fetchCards = async (deckName: string): Promise<Card[]> => {
	console.log(`Fetching cards for deck: ${deckName}`);
	// Placeholder: Replace with actual API call
	// Example:
	// const response = await fetch(`${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards`);
	// if (!response.ok) throw new Error('Failed to fetch cards');
	// const data = await response.json();
	// return data.cards; // Assuming the API returns { cards: Card[] }
	await new Promise(resolve => setTimeout(resolve, 500));
	// Return mock data
	return [
		{ id: '1', front_type: 'text', front_content: 'Hello', back_type: 'text', back_content: 'Hola' },
		{ id: '2', front_type: 'text', front_content: 'Goodbye', back_type: 'text', back_content: 'Adiós' },
		{ id: '3', front_type: 'text', front_content: 'Thank you', back_type: 'text', back_content: 'Gracias' },
	];
};

export const rateCard = async (cardId: string | number, quality: number): Promise<boolean> => {
	console.log(`Rating card ${cardId} with quality ${quality}`);
	// Placeholder: Replace with actual API call
	// Example:
	// const response = await fetch(`${API_BASE_URL}/cards/${cardId}/rate`, {
	//   method: 'POST',
	//   headers: { 'Content-Type': 'application/json' },
	//   body: JSON.stringify({ quality })
	// });
	// return response.ok;
	await new Promise(resolve => setTimeout(resolve, 200));
	return true; // Assume success for now
}; 