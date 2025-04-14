import tkinter as tk
from tkinter import messagebox, simpledialog
import json
import os
import random
from datetime import datetime, timedelta

# --- Configuration ---
DATA_FILE = "flashcards_data.json"
STATS_FILE = "flashcards_stats.json"

# --- Data Management ---
def load_data():
    """Loads decks and cards from the JSON file."""
    if not os.path.exists(DATA_FILE):
        return {"decks": {"Default": {"cards": []}}}
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
        return {"decks": {"Default": {"cards": []}}}

def save_data(data):
    """Saves decks and cards to the JSON file."""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except IOError:
        messagebox.showerror("Error", f"Could not save data to {DATA_FILE}.")

# --- Statistics Management ---
def load_stats():
    """Loads review statistics from the JSON file."""
    if not os.path.exists(STATS_FILE):
        return [] # Return empty list if file doesn't exist
    try:
        with open(STATS_FILE, 'r', encoding='utf-8') as f:
            stats = json.load(f)
            # Basic validation: ensure it's a list
            return stats if isinstance(stats, list) else []
    except (json.JSONDecodeError, FileNotFoundError):
        # Don't show error on startup for stats, just start fresh
        print(f"Could not load stats from {STATS_FILE}. Starting with empty stats.")
        return []

def save_stats(stats):
    """Saves review statistics to the JSON file."""
    try:
        with open(STATS_FILE, 'w', encoding='utf-8') as f:
            json.dump(stats, f, indent=4, ensure_ascii=False)
    except IOError:
        messagebox.showerror("Error", f"Could not save stats to {STATS_FILE}.")

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
        self.stats = load_stats() # Load statistics
        self.current_deck_name = "Default"
        self.current_card = None
        self.showing_answer = False
        self.question_shown_time = None # To record when question was shown
        self.answer_shown_time = None # To record when answer was shown
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

        # Show Answer Button (Initially visible)
        self.show_answer_button = tk.Button(self.controls_frame, text="Show Answer / Spacebar", command=self.show_answer)
        self.show_answer_button.pack(pady=(0, 5))

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

        # Response Time Label (Initially hidden)
        self.thinking_time_label = tk.Label(self.controls_frame, text="", font=("Arial", 10))
        # Packed below review buttons when answer is shown

        # --- Menu Bar ---
        self.menu_bar = tk.Menu(root)
        self.root.config(menu=self.menu_bar)

        # File Menu
        self.file_menu = tk.Menu(self.menu_bar, tearoff=0)
        self.menu_bar.add_cascade(label="File", menu=self.file_menu)
        self.file_menu.add_command(label="Save", command=self.save_all_data)
        self.file_menu.add_separator()
        self.file_menu.add_command(label="Show Stats", command=self.show_stats_window, accelerator="Ctrl+I")
        self.file_menu.add_separator()
        self.file_menu.add_command(label="Exit", command=self.on_closing)

        # Manage Menu (updated name)
        self.manage_menu = tk.Menu(self.menu_bar, tearoff=0)
        self.menu_bar.add_cascade(label="Manage", menu=self.manage_menu)
        self.manage_menu.add_command(label="Add Card", command=self.add_card_dialog)
        self.manage_menu.add_command(label="Add Deck", command=self.add_deck_dialog)
        self.manage_menu.add_separator()
        self.manage_menu.add_command(label="Review All Today", command=self.review_all_cards_in_deck)
        self.manage_menu.add_separator()
        self.manage_menu.add_command(label="Delete Current Card", command=self.delete_current_card)
        self.manage_menu.add_command(label="Delete Current Deck", command=self.delete_current_deck)

        # --- Initial Load ---
        self.load_scheduled_cards()
        self.display_next_card()

        # --- Bindings ---
        self.root.bind("<Control-i>", self.show_stats_window)
        self.root.bind("<Control-I>", self.show_stats_window)
        self.root.bind("<space>", self.handle_spacebar) # Add spacebar binding

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
            self.load_scheduled_cards()
            self.display_next_card()

    def load_scheduled_cards(self):
        """Loads cards from the current deck that are scheduled for review."""
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
        print(f"Found {len(self.due_cards)} scheduled cards.") # Updated print

    def display_next_card(self):
        """Displays the front of the next due card."""
        self.question_shown_time = None # Reset timer for question display
        self.answer_shown_time = None # Reset timer for answer display
        self.thinking_time_label.config(text="") # Clear time label
        self.thinking_time_label.pack_forget() # Hide time label
        self.review_buttons_frame.pack_forget() # Hide review buttons
        self.show_answer_button.pack(pady=(0, 5)) # Make sure show answer button is visible again

        if self.due_cards:
            self.current_card = self.due_cards[0]
            self.card_label.config(text=self.current_card.get("front", "N/A"))
            self.showing_answer = False
            self.question_shown_time = datetime.now() # <<< Record time when question is shown
        else:
            self.current_card = None
            self.card_label.config(text=f"No more cards due in '{self.current_deck_name}' deck for now!")
            self.show_answer_button.pack_forget() # No card, hide button

    def show_answer(self):
        """Reveals the answer side of the current card and shows thinking time."""
        if self.current_card and not self.showing_answer:
            thinking_time = None
            if self.question_shown_time:
                thinking_time = (datetime.now() - self.question_shown_time).total_seconds()
                self.thinking_time_label.config(text=f"Thinking time: {thinking_time:.2f}s")
            else:
                self.thinking_time_label.config(text="") # Clear if no start time

            self.card_label.config(text=self.current_card.get("back", "N/A"))
            self.showing_answer = True
            self.answer_shown_time = datetime.now() # Record time when answer is revealed
            self.show_answer_button.pack_forget() # Hide "Show Answer"
            # Pack review buttons first, then the time label below them
            self.review_buttons_frame.pack(pady=5)
            self.thinking_time_label.pack(pady=(0, 5)) # Show thinking time label

    def rate_card(self, quality):
        """Rates the card difficulty, logs stats, and schedules the next review."""
        if self.current_card and self.showing_answer:
            thinking_time = None
            if self.question_shown_time:
                 thinking_time = (self.answer_shown_time - self.question_shown_time).total_seconds() if self.answer_shown_time else None

            rating_time = None
            if self.answer_shown_time:
                rating_time = (datetime.now() - self.answer_shown_time).total_seconds()
                # Optional: uncomment below if you want to update the label with rating time too
                # self.thinking_time_label.config(text=f"Thinking: {thinking_time:.2f}s, Rating: {rating_time:.2f}s")

            # --- Logging --- 
            card_copy_for_logging = self.current_card.copy()
            update_card_schedule(self.current_card, quality) # Update schedule *before* getting new interval
            stat_card_id = card_copy_for_logging.get("id", "N/A")
            stat_front = card_copy_for_logging.get("front", "")[:50]
            new_interval = self.current_card.get("interval")
            self.log_review_stat(stat_card_id, stat_front, quality, thinking_time, rating_time, new_interval)
            # --- End logging ---

            # Remove the reviewed card from the due list
            card_id_to_remove = self.current_card.get("id")
            self.due_cards = [card for card in self.due_cards if card.get("id") != card_id_to_remove]

            # Immediately display the next card
            self.display_next_card()

            # Auto-save
            self.save_all_data()

    def log_review_stat(self, card_id, card_front, quality, thinking_time, rating_time, new_interval):
        """Adds a record to the statistics."""
        stat_entry = {
            "timestamp": datetime.now().isoformat(),
            "card_id": card_id,
            "deck": self.current_deck_name,
            "front": card_front,
            "quality": quality,
            "thinking_time_sec": round(thinking_time, 2) if thinking_time is not None else None,
            "rating_time_sec": round(rating_time, 2) if rating_time is not None else None,
            "new_interval_days": new_interval
        }
        self.stats.append(stat_entry)
        # print(f"Logged stat: {stat_entry}") # Debugging

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
                self.save_all_data()
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
                        self.load_scheduled_cards() # Reloading is simpler to maintain order

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
                    self.save_all_data()
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

    def delete_current_card(self):
        """Deletes the currently displayed card after confirmation."""
        if not self.current_card:
            messagebox.showinfo("No Card", "No card is currently selected to delete.")
            return

        card_front = self.current_card.get("front", "this card")[:50] # Get first 50 chars
        if messagebox.askyesno("Confirm Delete", f"Are you sure you want to delete this card?\n\nFront: {card_front}..."):
            card_id_to_delete = self.current_card.get("id")

            # Remove from the main deck data
            if self.current_deck_name in self.decks and "cards" in self.decks[self.current_deck_name]:
                deck_cards = self.decks[self.current_deck_name]["cards"]
                self.decks[self.current_deck_name]["cards"] = [card for card in deck_cards if card.get("id") != card_id_to_delete]

            # Remove from the current due list (if present)
            self.due_cards = [card for card in self.due_cards if card.get("id") != card_id_to_delete]

            print(f"Deleted card ID: {card_id_to_delete} from deck '{self.current_deck_name}'")
            self.save_all_data() # Save changes
            self.display_next_card() # Show the next card
        else:
            print("Card deletion cancelled.")

    def delete_current_deck(self):
        """Deletes the currently selected deck after confirmation."""
        deck_to_delete = self.current_deck_name

        if deck_to_delete == "Default":
            messagebox.showerror("Cannot Delete", "The 'Default' deck cannot be deleted.")
            return

        if deck_to_delete not in self.decks:
             messagebox.showerror("Error", f"Deck '{deck_to_delete}' not found.")
             return

        if messagebox.askyesno("Confirm Delete Deck", f"Are you sure you want to delete the entire deck '{deck_to_delete}' and all its cards?"):
            del self.decks[deck_to_delete]
            print(f"Deleted deck: {deck_to_delete}")

            # Update UI - switch to Default deck
            self.current_deck_name = "Default" # Switch active deck
            self.update_deck_menu() # Update dropdown options
            self.deck_var.set(self.current_deck_name) # Update dropdown display

            self.load_scheduled_cards() # Load cards from the new current deck (Default)
            self.display_next_card() # Display card from Default deck
            self.save_all_data() # Save changes
        else:
            print("Deck deletion cancelled.")

    def save_all_data(self):
        """Saves both card/deck data and statistics."""
        self.data["decks"] = self.decks
        save_data(self.data)
        save_stats(self.stats)
        # print("Data and stats saved.") # Debugging

    def show_stats_window(self, event=None): # Accept event argument
        """Displays the statistics in a new window."""
        print("Ctrl+I detected, attempting to show stats...") # Debug print
        stats_win = tk.Toplevel(self.root)
        stats_win.title("Review Statistics")
        stats_win.geometry("800x500")
        stats_win.grab_set() # Make modal

        txt_frame = tk.Frame(stats_win)
        txt_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        txt_widget = tk.Text(txt_frame, wrap=tk.WORD, height=25, width=90)
        v_scroll = tk.Scrollbar(txt_frame, orient=tk.VERTICAL, command=txt_widget.yview)
        h_scroll = tk.Scrollbar(stats_win, orient=tk.HORIZONTAL, command=txt_widget.xview)
        txt_widget.configure(yscrollcommand=v_scroll.set, xscrollcommand=h_scroll.set)

        v_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        txt_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        h_scroll.pack(side=tk.BOTTOM, fill=tk.X)

        # Prepare stats text (consider formatting improvements later)
        stats_text = f"Total Reviews Logged: {len(self.stats)}\n{'-'*40}\n\n"
        # Display most recent first
        for entry in reversed(self.stats):
            ts = entry.get("timestamp", "")
            try: # Nicer timestamp formatting
                ts_dt = datetime.fromisoformat(ts)
                ts = ts_dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                pass # Keep original string if format fails

            q_map = {0: "Fail", 1: "Hard", 2: "Good", 3: "Easy", None: "N/A"}
            quality_str = q_map.get(entry.get("quality"), "Unknown")
            response_time_str = f"{entry.get('response_time_sec', 'N/A')} sec"
            interval_str = f"{entry.get('new_interval_days', 'N/A')} days"
            front_preview = entry.get("front", "N/A")

            stats_text += f"Time: {ts}\n"
            stats_text += f"  Deck: {entry.get('deck', 'N/A')}\n"
            stats_text += f"  Card Front: {front_preview}...\n"
            stats_text += f"  Rating: {quality_str}\n"
            stats_text += f"  Response Time: {response_time_str}\n"
            stats_text += f"  Next Interval: {interval_str}\n"
            stats_text += f"---\n"

        txt_widget.insert(tk.END, stats_text)
        txt_widget.config(state=tk.DISABLED) # Make read-only

        close_button = tk.Button(stats_win, text="Close", command=stats_win.destroy)
        close_button.pack(pady=5)

        stats_win.wait_window()

    def on_closing(self):
        """Handles window close event."""
        self.save_all_data()
        self.root.destroy()

    # Handle Spacebar press
    def handle_spacebar(self, event=None):
        """Handles the spacebar press event."""
        # If answer is not showing, show it.
        if self.current_card and not self.showing_answer:
            self.show_answer()
        # Optional: Add logic here if you want spacebar to also rate the card
        # (e.g., if self.showing_answer: self.rate_card(2) # Rate as 'Good')

    # --- New method for reviewing all cards --- 
    def review_all_cards_in_deck(self):
        """Loads all cards from the current deck for review, ignoring schedule."""
        deck_content = self.decks.get(self.current_deck_name, None)
        if deck_content and "cards" in deck_content:
            all_cards = list(deck_content["cards"]) # Get a copy
            if not all_cards:
                messagebox.showinfo("Empty Deck", f"The deck '{self.current_deck_name}' has no cards to review.")
                return
            
            random.shuffle(all_cards)
            self.due_cards = all_cards
            print(f"Starting review session for all {len(self.due_cards)} cards in deck '{self.current_deck_name}'.")
            self.display_next_card()
        else:
            messagebox.showerror("Error", f"Could not find deck '{self.current_deck_name}'.")


if __name__ == "__main__":
    root = tk.Tk()
    app = FlashcardApp(root)
    root.mainloop() 