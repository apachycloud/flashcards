import React, { useState, useEffect, useCallback, useRef } from 'react';
import DeckBrowser from './DeckBrowser'; // Import the new component
import StudySession from './StudySession'; // Import the new component
import './App.css';
import { Deck, Card } from './types';
import Notification from './Notification'; // Import the new component
// import { updateCardInDeck, saveData } from './utils'; // Assuming utility functions - REMOVED

// Define the base URL for the backend API
const API_BASE_URL = 'http://localhost:5001/api';
const MEDIA_BASE_URL = 'http://localhost:5001'; // Base URL for media files

// Updated Card interface
export interface StatEntry {
  timestamp: string;
  cardId: number | string;
  deck: string;
  quality: number;
  thinking_time_sec?: number | null;
  rating_time_sec?: number | null;
  new_interval_days?: number;
  // front?: string; // Can add this if needed
}

type View = 'deck-browser' | 'study-session' | 'stats'; // Define possible views

function App() {
  // --- State ---
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [dueCards, setDueCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);

  // State for Add Card form (Updated)
  const [newCardFrontType, setNewCardFrontType] = useState<'text' | 'image'>(
    'text'
  );
  const [newCardFrontContent, setNewCardFrontContent] = useState<string>('');
  const [newCardBackType, setNewCardBackType] = useState<'text' | 'image'>(
    'text'
  );
  const [newCardBackContent, setNewCardBackContent] = useState<string>('');
  const [addCardError, setAddCardError] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState<boolean>(false);

  // State for Add Deck form
  const [newDeckName, setNewDeckName] = useState<string>('');
  const [addDeckError, setAddDeckError] = useState<string | null>(null);
  const [isAddingDeck, setIsAddingDeck] = useState<boolean>(false);

  // Loading/Error states
  const [isDecksLoading, setIsDecksLoading] = useState<boolean>(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [isCardsLoading, setIsCardsLoading] = useState<boolean>(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // State for success messages (will disappear after a timeout)
  const [deckSuccessMessage, setDeckSuccessMessage] = useState<string | null>(
    null
  );
  const [cardSuccessMessage, setCardSuccessMessage] = useState<string | null>(
    null
  );

  // State for Statistics
  const [statsData, setStatsData] = useState<StatEntry[]>([]);
  const [showStats, setShowStats] = useState<boolean>(false);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Refs for file inputs
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  // State to control the current view
  const [currentView, setCurrentView] = useState<View>('deck-browser'); // Start with deck browser

  // State for adding a deck (Moved to DeckBrowser)
  // const [newDeckName, setNewDeckName] = useState<string>('');
  // const [isAddingDeck, setIsAddingDeck] = useState<boolean>(false);
  // const [addDeckError, setAddDeckError] = useState<string | null>(null);

  // State for adding a card
  const [selectedDeckForAdd, setSelectedDeckForAdd] = useState<string>(''); // Track selected deck

  // State for Notifications
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // --- Effects ---

  // Fetch decks on component mount
  const fetchDecks = useCallback(async (selectDeckAfterFetch?: string) => {
    setIsDecksLoading(true);
    setDecksError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/decks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Deck[] = await response.json();
      setDecks(data);
      if (
        selectDeckAfterFetch &&
        data.some((deck) => deck.name === selectDeckAfterFetch)
      ) {
        setSelectedDeck(selectDeckAfterFetch);
      }
    } catch (e: any) {
      console.error('Failed to fetch decks:', e);
      setDecksError('Failed to load decks. Is the backend running?');
    } finally {
      setIsDecksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentView === 'deck-browser') {
      fetchDecks(); // Fetch decks when returning to browser
    }
  }, [fetchDecks, currentView]); // Re-fetch if view changes back to deck-browser

  // Fetch due cards when a deck is selected for study
  const startStudySession = useCallback(async (deckName: string) => {
    if (!deckName) return;
    console.log(`Starting study session for: ${deckName}`);
    setSelectedDeck(deckName);
    setIsCardsLoading(true);
    setCardsError(null);
    setDueCards([]);
    try {
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards/due`
      );
      if (!response.ok) {
        if (response.status === 404) {
          setCardsError(`Deck '${deckName}' not found on backend.`);
          setIsCardsLoading(false);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Card[] = await response.json();
      setDueCards(data);
      console.log(`Loaded ${data.length} due cards.`);
      setCurrentView('study-session'); // Switch view only after successful load
    } catch (e: any) {
      console.error('Failed to fetch due cards:', e);
      setCardsError('Failed to load cards for this deck.');
    } finally {
      setIsCardsLoading(false);
    }
  }, []);

  // Fetch ALL cards when a deck is selected for 'Study All'
  const startStudyAllSession = useCallback(async (deckName: string) => {
    if (!deckName) return;
    console.log(`Starting study ALL session for: ${deckName}`);
    setSelectedDeck(deckName);
    setIsCardsLoading(true);
    setCardsError(null);
    setDueCards([]); // Reset cards
    try {
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards/all` // Call the new endpoint
      );
      if (!response.ok) {
        if (response.status === 404) {
          setCardsError(`Deck '${deckName}' not found on backend.`);
          setIsCardsLoading(false);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Card[] = await response.json();
      setDueCards(data);
      console.log(`Loaded ${data.length} total cards for Study All.`);
      setCurrentView('study-session'); // Switch view only after successful load
    } catch (e: any) {
      console.error('Failed to fetch all cards:', e);
      setCardsError('Failed to load all cards for this deck.');
    } finally {
      setIsCardsLoading(false);
    }
  }, []); // Dependencies: API_BASE_URL (constant), other setters

  // Helper function to show a temporary success message
  const showSuccessMessage = (message: string, type: 'deck' | 'card') => {
    if (type === 'deck') {
      setDeckSuccessMessage(message);
      setTimeout(() => setDeckSuccessMessage(null), 3000); // Clear after 3 seconds
    } else {
      setCardSuccessMessage(message);
      setTimeout(() => setCardSuccessMessage(null), 3000);
    }
  };

  // Helper to show notification
  const showNotification = useCallback(
    (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000); // Hide after 3 seconds
    },
    [setNotification]
  ); // Dependency: setNotification (stable)

  // --- HANDLERS TO PASS DOWN ---

  // Now takes deckName directly from DeckBrowser, returns success boolean
  const handleAddDeck = async (deckName: string): Promise<boolean> => {
    // Validation is now done in DeckBrowser before calling this
    // setIsAddingDeck(true); // State managed by DeckBrowser
    // setAddDeckError(null); // State managed by DeckBrowser

    try {
      const response = await fetch(`${API_BASE_URL}/decks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deckName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to add deck: ${response.statusText}`
        );
      }
      const newDeck = await response.json();
      setDecks([...decks, newDeck]); // Assuming response contains the Deck object
      // setNewDeckName(''); // State managed by DeckBrowser
      showNotification(`Deck "${newDeck.name}" added successfully!`, 'success');
      return true; // Indicate success
    } catch (err: any) {
      console.error('Add deck error:', err);
      showNotification(`Error adding deck: ${err.message}`, 'error');
      // setAddDeckError(err.message); // State managed by DeckBrowser
      return false; // Indicate failure
    } finally {
      // setIsAddingDeck(false); // State managed by DeckBrowser
    }
  };

  // Now returns success boolean
  const handleDeleteDeck = async (deckName: string): Promise<boolean> => {
    if (
      !window.confirm(`Are you sure you want to delete the deck "${deckName}"?`)
    ) {
      return false; // User cancelled
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}`,
        {
          method: 'DELETE',
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to delete deck: ${response.statusText}`
        );
      }
      setDecks(decks.filter((d) => d.name !== deckName));
      if (selectedDeck === deckName) setSelectedDeck(null);
      showNotification(`Deck "${deckName}" deleted!`, 'success');
      return true; // Indicate success
    } catch (err: any) {
      console.error('Delete deck error:', err);
      showNotification(`Error deleting deck: ${err.message}`, 'error');
      return false; // Indicate failure
    }
  };

  // Corrected signature for adding a card (expects data from child)
  const handleAddCard = useCallback(
    async (
      deckName: string,
      cardData: Omit<Card, 'id' | 'due_date' | 'interval' | 'ease_factor'>
    ): Promise<boolean> => {
      console.log(`Adding card to ${deckName}:`, cardData);
      try {
        const response = await fetch(
          `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData),
          }
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            err.message || `HTTP error! status: ${response.status}`
          );
        }
        showNotification('Card added successfully!', 'success');
        return true;
      } catch (e: any) {
        console.error('Add card error:', e);
        showNotification(`Error adding card: ${e.message}`, 'error');
        return false;
      }
    },
    [showNotification] // Add dependency
  );

  // Now takes cardId and quality from StudySession, returns success boolean
  const handleRateCard = async (
    cardId: string | number,
    quality: number
  ): Promise<boolean> => {
    // const currentCard = cards[currentCardIndex]; // No longer use state index directly
    if (!selectedDeck) {
      console.error('Cannot rate card: No deck selected.');
      showNotification('Error: No deck selected.', 'error');
      return false;
    }
    if (cardId === undefined) {
      console.error('Cannot rate card: Card ID is missing.');
      showNotification('Error: Card ID is missing.', 'error');
      return false;
    }

    console.log(
      `Rating card ID ${cardId} in deck ${selectedDeck} with quality ${quality}`
    ); // Log with cardId

    try {
      const response = await fetch(`${API_BASE_URL}/cards/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quality, deckName: selectedDeck }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to rate card: ${response.statusText}`
        );
      }

      // const { nextReview } = await response.json(); // Optional: use nextReview if needed
      console.log(`Card ${cardId} rated successfully.`);

      // StudySession component handles moving to the next card or ending the session
      // We don't need to manage currentCardIndex or showingAnswer here anymore

      // Re-fetch stats after rating? Or maybe only when showing stats view?
      // fetchStats(); // Optional: update stats immediately

      return true; // Indicate success
    } catch (err: any) {
      console.error('Rate card error:', err);
      showNotification(`Error rating card: ${err.message}`, 'error');
      return false; // Indicate failure
    }
  };

  // Handler for file upload (signature is correct)
  const handleFileUpload = useCallback(
    async (file: File): Promise<string | null> => {
      console.log('Uploading image:', file.name);
      const formData = new FormData();
      formData.append('imageFile', file);
      try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || 'Upload failed');
        }
        const result = await response.json();
        showNotification('File uploaded successfully!', 'success');
        return result.filename; // Return filename on success
      } catch (e: any) {
        console.error('File upload error:', e);
        showNotification(`Upload error: ${e.message}`, 'error');
        return null;
      }
    },
    [showNotification] // Add dependency
  );

  // Restore handleShowStats
  const handleShowStats = async () => {
    setCurrentView('stats');
    setIsStatsLoading(true);
    setStatsError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: StatEntry[] = await response.json();
      setStatsData(data);
    } catch (e: any) {
      console.error('Failed to fetch stats:', e);
      setStatsError('Failed to load statistics.');
    } finally {
      setIsStatsLoading(false);
    }
  };

  // Handler for returning to deck browser (signature is correct)
  const handleGoToDecks = () => {
    setCurrentView('deck-browser');
    setSelectedDeck(null);
    setDueCards([]);
    setCardsError(null);
  };

  // Handler to update a card's content (e.g., after editing Excalidraw)
  const handleUpdateCard = async (
    cardId: string | number,
    side: 'front' | 'back',
    newContent: string
  ): Promise<boolean> => {
    setNotification(null);

    // Get deckName from state
    const deckName = selectedDeck;
    if (!deckName) {
      console.error('Cannot update card: No deck selected');
      setNotification({
        message: 'Cannot update card: No deck selected.',
        type: 'error',
      });
      return false;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards/${cardId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ side, newContent }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to parse error response' })); // Handle cases where error response is not JSON
        throw new Error(
          errorData.error || `Failed to update card: ${response.statusText}`
        );
      }

      const updatedCard = await response.json(); // Keep this line in case you need the result later

      // REMOVE Update local state logic - it's handled in StudySession for the current view
      /*
      setDecks(prevDecks => {
          const deckIndex = prevDecks.findIndex(d => d.name === deckName);
          if (deckIndex === -1) return prevDecks; 

          const cardIndex = prevDecks[deckIndex].cards.findIndex(c => c.id === cardId); 
          if (cardIndex === -1) return prevDecks;

          const newDecks = [...prevDecks];
          const newDeck = { ...newDecks[deckIndex] };
          const newCards = [...newDeck.cards];
          // Replace the card with the updated one from the API response
          newCards[cardIndex] = updatedCard; 
          
          newDeck.cards = newCards;
          newDecks[deckIndex] = newDeck;
          return newDecks;
      });
      */

      setNotification({
        message: 'Card updated successfully!',
        type: 'success',
      });
      return true; // Indicate success
    } catch (error: any) {
      console.error('Error updating card:', error);
      setNotification({
        message: `Error updating card: ${error.message}`,
        type: 'error',
      });
      return false; // Indicate failure
    }
  };

  // --- Render Logic based on currentView ---
  const renderCurrentView = () => {
    switch (currentView) {
      case 'study-session':
        if (!selectedDeck || !decks.find((d) => d.name === selectedDeck)) {
          // Handle case where deck is somehow not selected or not found
          setCurrentView('deck-browser');
          return null;
        }
        return (
          <StudySession
            deckName={selectedDeck}
            cards={dueCards}
            isLoading={isCardsLoading}
            error={cardsError}
            onRateCard={handleRateCard}
            onGoBack={handleGoToDecks}
            onStudyAll={startStudyAllSession}
            onUpdateCard={handleUpdateCard}
          />
        );
      case 'stats':
        return renderStats();
      case 'deck-browser':
      default:
        return (
          <DeckBrowser
            decks={decks}
            isLoading={isDecksLoading}
            error={decksError}
            onAddDeck={handleAddDeck}
            onDeleteDeck={handleDeleteDeck}
            onStudyDeck={startStudySession}
            onShowStats={handleShowStats}
            onAddCard={handleAddCard}
            onUploadFile={handleFileUpload}
          />
        );
    }
  };

  const renderStats = () => {
    // Removed the check for `showStats` as rendering is controlled by `currentView` now
    // if (!showStats) return null;

    const qualityMap: { [key: number]: string } = {
      0: 'Fail',
      1: 'Hard',
      2: 'Good',
      3: 'Easy',
    };

    return (
      // Use a dedicated class for the stats view container if needed
      <div className="stats-view-container">
        <h2>Review Statistics</h2>
        {/* Button to go back is now in the header, but keep one here for clarity? */}
        {/* <button onClick={handleGoToDecks}>Back to Decks</button> */}

        {isStatsLoading && <p>Loading stats...</p>}
        {statsError && <p className="error-message">{statsError}</p>}
        {!isStatsLoading &&
          !statsError &&
          (statsData.length === 0 ? (
            <p>No statistics recorded yet.</p>
          ) : (
            <div className="stats-table-container">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Deck</th>
                    <th>Card ID</th>
                    <th>Rating</th>
                    <th>Think (s)</th>
                    <th>Rate (s)</th>
                    <th>New Interval (d)</th>
                  </tr>
                </thead>
                <tbody>
                  {statsData.map((stat, index) => (
                    <tr key={`${stat.timestamp}-${index}`}>
                      <td>{new Date(stat.timestamp).toLocaleString()}</td>
                      <td>{stat.deck}</td>
                      {/* Use stat.card_id if that's the actual field name from JSON */}
                      <td>{stat.cardId || (stat as any).card_id || 'N/A'}</td>
                      <td>
                        {qualityMap[stat.quality] || 'Unknown'} ({stat.quality})
                      </td>
                      <td>
                        {stat.thinking_time_sec !== undefined &&
                        stat.thinking_time_sec !== null
                          ? stat.thinking_time_sec.toFixed(1)
                          : '-'}
                      </td>
                      <td>
                        {stat.rating_time_sec !== undefined &&
                        stat.rating_time_sec !== null
                          ? stat.rating_time_sec.toFixed(1)
                          : '-'}
                      </td>
                      <td>{stat.new_interval_days ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="App">
      {/* Header might be static or change based on view */}
      {/* <header className="App-header">
        <h1>Flashcard App</h1>
        { Conditionally show buttons based on view? }
        {currentView === 'deck-browser' && (
          <button onClick={handleShowStats} className="header-button">
            Show Stats
          </button>
        )}
        {currentView === 'study-session' && (
          <button onClick={handleGoToDecks} className="header-button">
            Back to Decks
          </button>
        )}
        {currentView === 'stats' && (
          <button onClick={handleGoToDecks} className="header-button">
            Back to Decks
          </button>
        )}
      </header> */}
      <main>
        {renderCurrentView()} {/* Render the component for the current view */}
      </main>
      {/* Statistics modal rendering is now handled within renderCurrentView when view is 'stats' */}
      {notification && (
        <Notification message={notification.message} type={notification.type} />
      )}
    </div>
  );
}

export default App;
