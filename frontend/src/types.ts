export interface Card {
	id: number | string;
	front_type: 'text' | 'image' | 'excalidraw';
	front_content: string;
	back_type: 'text' | 'image' | 'excalidraw';
	back_content: string;
	due_date: string;
	interval: number;
	ease_factor: number;
}

export interface Deck {
	name: string;
	cards: Card[];
	card_count?: number;
	due_count?: number;
	new_count?: number;
} 