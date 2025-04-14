import React, { useState, useEffect, useCallback, useRef } from 'react';
import DeckBrowser from './DeckBrowser'; // Import the new component
import StudySession from './StudySession'; // Import the new component
import './App.css';
import { Deck, Card } from './types';

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
      // alert(`Deck "${newDeck.name}" added successfully!`); // Maybe handle success feedback differently
      return true; // Indicate success
    } catch (err: any) {
      console.error('Add deck error:', err);
      alert(`Error adding deck: ${err.message}`); // Keep alert for now
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
      showSuccessMessage(`Deck "${deckName}" deleted!`, 'deck');
      return true; // Indicate success
    } catch (err: any) {
      console.error('Delete deck error:', err);
      alert(`Error deleting deck: ${err.message}`);
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
        showSuccessMessage('Card added successfully!', 'card');
        return true;
      } catch (e: any) {
        console.error('Add card error:', e);
        alert(`Error adding card: ${e.message}`);
        return false;
      }
    },
    []
  );

  // Now takes cardId and quality from StudySession, returns success boolean
  const handleRateCard = async (
    cardId: string | number,
    quality: number
  ): Promise<boolean> => {
    // const currentCard = cards[currentCardIndex]; // No longer use state index directly
    if (!selectedDeck) {
      console.error('Cannot rate card: No deck selected.');
      alert('Error: No deck selected.');
      return false;
    }
    if (cardId === undefined) {
      console.error('Cannot rate card: Card ID is missing.');
      alert('Error: Card ID is missing.');
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
      alert(`Error rating card: ${err.message}`);
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
        return result.filename; // Return filename on success
      } catch (e: any) {
        console.error('File upload error:', e);
        alert(`Upload error: ${e.message}`);
        return null;
      }
    },
    []
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

  // --- Render Logic based on currentView ---
  const renderCurrentView = () => {
    switch (currentView) {
      case 'study-session':
        return (
          <StudySession
            deckName={selectedDeck || 'Unknown Deck'}
            cards={dueCards}
            isLoading={isCardsLoading}
            error={cardsError}
            onRateCard={handleRateCard}
            onGoBack={handleGoToDecks}
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
    if (!showStats) return null;

    const qualityMap: { [key: number]: string } = {
      0: 'Fail',
      1: 'Hard',
      2: 'Good',
      3: 'Easy',
    };

    return (
      <div className="stats-modal-backdrop" onClick={() => setShowStats(false)}>
        <div
          className="stats-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          <h2>Review Statistics</h2>
          <button
            onClick={() => setShowStats(false)}
            className="close-stats-button"
          >
            &times;
          </button>
          {isStatsLoading && <p>Loading stats...</p>}
          {statsError && <p className="error-message">{statsError}</p>}
          {!isStatsLoading &&
            !statsError &&
            (statsData.length === 0 ? (
              <p>No statistics recorded yet.</p>
            ) : (
              <div className="stats-table-container">
                {' '}
                {/* Added container for potential scroll */}
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
                        <td>{stat.cardId}</td>
                        <td>
                          {qualityMap[stat.quality] || 'Unknown'} (
                          {stat.quality})
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
      </div>
    );
  };

  return (
    <div className="App">
      {/* Header might be static or change based on view */}
      <header className="App-header">
        <h1>Flashcard App</h1>
        {/* Conditionally show buttons based on view? */}
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
      </header>
      <main>
        {renderCurrentView()} {/* Render the component for the current view */}
      </main>
      {/* Statistics modal rendering is now handled within renderCurrentView when view is 'stats' */}
    </div>
  );
}

export default App;
