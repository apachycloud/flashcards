import tkinter as tk
from tkinter import messagebox
import json
import os
import random
from datetime import datetime, timedelta

# --- Configuration ---
DATA_FILE = "flashcards_data.json"

# --- Data Management ---
def load_data():
    """Loads decks and cards from the JSON file."""
    if not os.path.exists(DATA_FILE):
        return {"decks": {"Default": {"cards": []}}} # Return default structure if file doesn't exist
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Ensure basic structure integrity
            if "decks" not in data:
                data["decks"] = {"Default": {"cards": []}}
            for deck_name, deck_content in data["decks"].items():
                if "cards" not in deck_content:
                    deck_content["cards"] = []
                for card in deck_content.get("cards", []):
                    # Ensure cards have necessary fields (add defaults if missing)
                    card.setdefault("id", random.randint(10000, 99999)) # Simple unique ID
                    card.setdefault("front", "")
                    card.setdefault("back", "")
                    card.setdefault("due_date", datetime.now().isoformat())
                    card.setdefault("interval", 1) # Initial interval in days
                    card.setdefault("ease_factor", 2.5)
            return data
    except (json.JSONDecodeError, FileNotFoundError):
        messagebox.showerror("Error", f"Could not load data from {DATA_FILE}. Starting with an empty deck.")
        return {"decks": {"Default": {"cards": []}}} # Return default structure on error

def save_data(data):
    """Saves decks and cards to the JSON file."""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except IOError:
        messagebox.showerror("Error", f"Could not save data to {DATA_FILE}.")

# --- Spaced Repetition Logic (Simplified) ---
def update_card_schedule(card, quality):
    """Updates card's due date based on review quality (0=Fail, 1=Hard, 2=Good, 3=Easy)."""
    now = datetime.now()

    if quality < 2: # Failed or Hard - Reset or reduce interval
        card["interval"] = 1 # Reset interval for failed, keep small for hard
        card["due_date"] = (now + timedelta(minutes=5 if quality == 0 else 10)).isoformat() # Show again soon
        card["ease_factor"] = max(1.3, card.get("ease_factor", 2.5) - 0.2 if quality == 0 else card.get("ease_factor", 2.5) - 0.15)
    else: # Good or Easy - Increase interval
        if card.get("interval", 1) == 1:
            card["interval"] = 1 if quality == 2 else 4 # First successful review
        else:
             # Simple exponential backoff based on ease factor
            card["interval"] = round(card.get("interval", 1) * card.get("ease_factor", 2.5))

        card["ease_factor"] = card.get("ease_factor", 2.5) + (0.1 if quality == 3 else 0) # Increase ease slightly for "Easy"
        card["due_date"] = (now + timedelta(days=card["interval"])).isoformat()

    # Ensure due_date is always in the future from 'now' for active scheduling
    if datetime.fromisoformat(card["due_date"]) <= now and quality >= 2:
         card["due_date"] = (now + timedelta(days=1)).isoformat() # Ensure it's at least 1 day out if calculated past

    # print(f"Updated Card Schedule: Quality={quality}, Interval={card['interval']}d, Ease={card['ease_factor']:.2f}, Due={card['due_date']}") # Debugging


# --- GUI Application ---
class FlashcardApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Flashcard App")
        self.root.geometry("600x400")

        self.data = load_data()
        self.decks = self.data.get("decks", {"Default": {"cards": []}})
        self.current_deck_name = "Default" # Start with the default deck
        self.current_card = None
        self.showing_answer = False
        self.due_cards = []

        # --- UI Elements ---
        # Deck Selection
        self.deck_frame = tk.Frame(root)
        self.deck_frame.pack(pady=10)
        tk.Label(self.deck_frame, text="Deck:").pack(side=tk.LEFT)
        self.deck_var = tk.StringVar(root)
        self.deck_options = list(self.decks.keys()) if self.decks else ["Default"]
        if not self.deck_options: # Ensure there's always at least a Default deck option visible
             self.deck_options = ["Default"]
        if self.current_deck_name not in self.deck_options:
             self.current_deck_name = self.deck_options[0] # Fallback if loaded deck name doesn't exist

        self.deck_var.set(self.current_deck_name)
        self.deck_menu = tk.OptionMenu(self.deck_frame, self.deck_var, *self.deck_options, command=self.change_deck)
        self.deck_menu.pack(side=tk.LEFT, padx=5)

        # Card Display
        self.card_frame = tk.Frame(root, bd=2, relief=tk.GROOVE)
        self.card_frame.pack(pady=20, padx=20, fill=tk.BOTH, expand=True)
        self.card_label = tk.Label(self.card_frame, text="Loading...", font=("Arial", 24), wraplength=550)
        self.card_label.pack(pady=50, padx=10)

        # Control Buttons Frame
        self.controls_frame = tk.Frame(root)
        self.controls_frame.pack(pady=10)

        # Review Buttons (Initially hidden)
        self.review_buttons_frame = tk.Frame(self.controls_frame)
        self.fail_button = tk.Button(self.review_buttons_frame, text="Fail (0)", command=lambda: self.rate_card(0), bg="#FF9999")
        self.fail_button.pack(side=tk.LEFT, padx=5)
        self.hard_button = tk.Button(self.review_buttons_frame, text="Hard (1)", command=lambda: self.rate_card(1), bg="#FFCC99")
        self.hard_button.pack(side=tk.LEFT, padx=5)
        self.good_button = tk.Button(self.review_buttons_frame, text="Good (2)", command=lambda: self.rate_card(2), bg="#99FF99")
        self.good_button.pack(side=tk.LEFT, padx=5)
        self.easy_button = tk.Button(self.review_buttons_frame, text="Easy (3)", command=lambda: self.rate_card(3), bg="#99CCFF")
        self.easy_button.pack(side=tk.LEFT, padx=5)
        # self.review_buttons_frame.pack() # Packed when answer is shown

        # Show Answer Button (Initially visible)
        self.show_answer_button = tk.Button(self.controls_frame, text="Show Answer", command=self.show_answer)
        self.show_answer_button.pack()

        # --- Menu Bar ---
        self.menu_bar = tk.Menu(root)
        self.root.config(menu=self.menu_bar)

        # File Menu
        self.file_menu = tk.Menu(self.menu_bar, tearoff=0)
        self.menu_bar.add_cascade(label="File", menu=self.file_menu)
        self.file_menu.add_command(label="Save", command=self.save_current_data)
        self.file_menu.add_separator()
        self.file_menu.add_command(label="Exit", command=root.quit)

        # Edit Menu
        self.edit_menu = tk.Menu(self.menu_bar, tearoff=0)
        self.menu_bar.add_cascade(label="Manage", menu=self.edit_menu)
        self.edit_menu.add_command(label="Add Card", command=self.add_card_dialog)
        self.edit_menu.add_command(label="Add Deck", command=self.add_deck_dialog)
        # Add more options like Edit Card, Delete Card, Delete Deck later

        # --- Initial Load ---
        self.load_due_cards()
        self.display_next_card()

        # --- Save on Close ---
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def update_deck_menu(self):
        """Updates the OptionMenu with current deck names."""
        menu = self.deck_menu["menu"]
        menu.delete(0, "end")
        self.deck_options = list(self.decks.keys())
        if not self.deck_options: # Ensure Default exists if all are deleted
            self.deck_options = ["Default"]
            self.decks["Default"] = {"cards": []}

        for deck_name in self.deck_options:
            menu.add_command(label=deck_name, command=tk._setit(self.deck_var, deck_name, self.change_deck))

        if self.current_deck_name not in self.deck_options:
             self.current_deck_name = self.deck_options[0] # Fallback if current deck was deleted

        self.deck_var.set(self.current_deck_name) # Update displayed deck name

    def change_deck(self, selected_deck_name):
        """Handles switching to a different deck."""
        if selected_deck_name != self.current_deck_name:
            print(f"Changing deck to: {selected_deck_name}") # Debugging
            self.current_deck_name = selected_deck_name
            self.load_due_cards()
            self.display_next_card()

    def load_due_cards(self):
        """Loads cards from the current deck that are due for review."""
        self.due_cards = []
        deck = self.decks.get(self.current_deck_name, {"cards": []})
        now = datetime.now()
        # print(f"\nLoading due cards for deck: {self.current_deck_name} at {now.isoformat()}") # Debugging
        cards_in_deck = deck.get("cards", [])
        # print(f"Total cards in deck: {len(cards_in_deck)}") # Debugging

        for card in cards_in_deck:
            # Ensure card has a due_date, default to now if missing for comparison
            due_date_str = card.get("due_date", now.isoformat())
            try:
                due_date = datetime.fromisoformat(due_date_str)
            except ValueError:
                 # Handle potential invalid format, default to now
                print(f"Warning: Invalid due date format for card {card.get('id', 'N/A')}. Using current time.")
                due_date = now
                card["due_date"] = now.isoformat() # Correct the format in data

            # print(f"Card ID {card.get('id', 'N/A')}: Due='{due_date_str}', Now='{now.isoformat()}', Is Due={due_date <= now}") # Debugging
            if due_date <= now:
                self.due_cards.append(card)

        random.shuffle(self.due_cards) # Randomize the order of due cards
        print(f"Found {len(self.due_cards)} due cards.") # Debugging

    def display_next_card(self):
        """Displays the front of the next due card."""
        self.show_answer_button.pack() # Make sure show answer button is visible
        self.review_buttons_frame.pack_forget() # Hide review buttons

        if self.due_cards:
            self.current_card = self.due_cards[0] # Get the next card without removing yet
            self.card_label.config(text=self.current_card.get("front", "N/A"))
            self.showing_answer = False
        else:
            self.current_card = None
            self.card_label.config(text=f"No more cards due in '{self.current_deck_name}' deck for now!")
            self.show_answer_button.pack_forget() # No card, hide button

    def show_answer(self):
        """Reveals the answer side of the current card."""
        if self.current_card and not self.showing_answer:
            self.card_label.config(text=self.current_card.get("back", "N/A"))
            self.showing_answer = True
            self.show_answer_button.pack_forget() # Hide "Show Answer"
            self.review_buttons_frame.pack(pady=5) # Show review buttons

    def rate_card(self, quality):
        """Rates the card difficulty and schedules the next review."""
        if self.current_card and self.showing_answer:
            # Update card scheduling based on quality
            update_card_schedule(self.current_card, quality)

            # Remove the reviewed card from the due list
            if self.due_cards and self.due_cards[0] == self.current_card:
                 self.due_cards.pop(0)

            # Immediately display the next card
            self.display_next_card()

            # Auto-save after rating a card
            self.save_current_data()

    def add_card_dialog(self):
        """Opens a dialog window to add a new card."""
        dialog = tk.Toplevel(self.root)
        dialog.title("Add New Card")
        dialog.geometry("400x300") # Increased height slightly for better spacing

        # Make dialog modal
        dialog.grab_set()
        dialog.transient(self.root)

        tk.Label(dialog, text="Front:").pack(pady=(10,0))
        front_entry = tk.Text(dialog, height=5, width=45, wrap=tk.WORD)
        front_entry.pack(padx=10, pady=2)

        tk.Label(dialog, text="Back:").pack(pady=(10,0))
        back_entry = tk.Text(dialog, height=5, width=45, wrap=tk.WORD)
        back_entry.pack(padx=10, pady=2)

        # Deck selection for the new card
        deck_frame_dialog = tk.Frame(dialog)
        deck_frame_dialog.pack(pady=(10,0))
        tk.Label(deck_frame_dialog, text="Add to Deck:").pack(side=tk.LEFT, padx=5)
        deck_var_dialog = tk.StringVar(dialog)
        deck_options_dialog = list(self.decks.keys()) if self.decks else ["Default"]
        if not deck_options_dialog: deck_options_dialog = ["Default"] # Failsafe
        deck_var_dialog.set(self.current_deck_name) # Default to current deck
        # Ensure options list is not empty for OptionMenu
        options_to_use = deck_options_dialog if deck_options_dialog else ["Default"]
        deck_menu_dialog = tk.OptionMenu(deck_frame_dialog, deck_var_dialog, *options_to_use)
        deck_menu_dialog.pack(side=tk.LEFT)

        # Button Frame for Dialog
        button_frame_dialog = tk.Frame(dialog)
        button_frame_dialog.pack(pady=15)

        def save_new_card():
            front = front_entry.get("1.0", tk.END).strip()
            back = back_entry.get("1.0", tk.END).strip()
            target_deck = deck_var_dialog.get()

            # Ensure target deck exists (might be empty string if options were empty initially)
            if not target_deck and options_to_use == ["Default"]:
                target_deck = "Default"
                if target_deck not in self.decks:
                     self.decks[target_deck] = {"cards": []} # Ensure default deck exists if needed
                     self.update_deck_menu()

            if front and back and target_deck in self.decks:
                new_card = {
                    "id": random.randint(10000, 99999), # Simple unique ID
                    "front": front,
                    "back": back,
                    "due_date": datetime.now().isoformat(), # Due immediately
                    "interval": 1,
                    "ease_factor": 2.5
                }
                self.decks[target_deck].setdefault("cards", []).append(new_card)
                print(f"Added card to deck '{target_deck}': {front[:20]}...") # Debugging
                self.save_current_data()
                # If the card was added to the current deck, refresh the due cards
                if target_deck == self.current_deck_name:
                    # Check if the new card is now due (it should be)
                    new_card_is_due = False
                    try:
                        if datetime.fromisoformat(new_card["due_date"]) <= datetime.now():
                            new_card_is_due = True
                    except ValueError:
                        pass # Already handled during loading, but double check

                    if new_card_is_due and new_card not in self.due_cards:
                        # Add to front of due list for immediate review if desired, or just reload
                        # self.due_cards.insert(0, new_card)
                        self.load_due_cards() # Reloading is simpler to maintain order

                    # If no card was being displayed OR the only due card was just added
                    if self.current_card is None or (len(self.due_cards) == 1 and self.due_cards[0] == new_card):
                        self.display_next_card()

                dialog.destroy()
            elif not front or not back:
                messagebox.showwarning("Missing Info", "Please enter text for both Front and Back.", parent=dialog)
            elif target_deck not in self.decks:
                 messagebox.showwarning("Invalid Deck", f"Selected deck '{target_deck}' does not exist.", parent=dialog)

        save_button = tk.Button(button_frame_dialog, text="Save Card", command=save_new_card)
        save_button.pack(side=tk.LEFT, padx=10)
        cancel_button = tk.Button(button_frame_dialog, text="Cancel", command=dialog.destroy)
        cancel_button.pack(side=tk.LEFT, padx=10)

        dialog.wait_window() # Wait for the dialog to close

    def add_deck_dialog(self):
        """Opens a dialog to add a new deck."""
        dialog = tk.Toplevel(self.root)
        dialog.title("Add New Deck")
        dialog.geometry("300x150")

        dialog.grab_set()
        dialog.transient(self.root)

        tk.Label(dialog, text="New Deck Name:").pack(pady=(10,0))
        deck_name_entry = tk.Entry(dialog, width=30)
        deck_name_entry.pack(pady=5)
        deck_name_entry.focus_set() # Set focus to the entry field

        # Button Frame for Dialog
        button_frame_dialog = tk.Frame(dialog)
        button_frame_dialog.pack(pady=15)

        def save_new_deck():
            new_deck_name = deck_name_entry.get().strip()
            if new_deck_name:
                if new_deck_name not in self.decks:
                    self.decks[new_deck_name] = {"cards": []}
                    self.update_deck_menu() # Refresh the dropdown
                    self.deck_var.set(new_deck_name) # Optionally switch to the new deck
                    self.change_deck(new_deck_name) # Load the (empty) new deck
                    self.save_current_data()
                    print(f"Added new deck: {new_deck_name}") # Debugging
                    dialog.destroy()
                else:
                    messagebox.showwarning("Deck Exists", f"A deck named '{new_deck_name}' already exists.", parent=dialog)
            else:
                messagebox.showwarning("Invalid Name", "Please enter a name for the new deck.", parent=dialog)

        save_button = tk.Button(button_frame_dialog, text="Create Deck", command=save_new_deck)
        save_button.pack(side=tk.LEFT, padx=10)
        cancel_button = tk.Button(button_frame_dialog, text="Cancel", command=dialog.destroy)
        cancel_button.pack(side=tk.LEFT, padx=10)

        dialog.wait_window()

    def save_current_data(self):
        """Saves the current state of all decks and cards."""
        self.data["decks"] = self.decks # Update the main data object
        save_data(self.data)
        # print("Data saved.") # Debugging

    def on_closing(self):
        """Handles window close event."""
        self.save_current_data()
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    app = FlashcardApp(root)
    root.mainloop() 