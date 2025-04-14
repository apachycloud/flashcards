export interface Card {
	id: number | string;
	front_type: 'text' | 'image';
	front_content: string;
	back_type: 'text' | 'image';
	back_content: string;
	due_date?: string;
	interval?: number;
	ease_factor?: number;
}

export interface Deck {
	name: string;
	card_count?: number;
	due_count?: number;
	new_count?: number;
} 