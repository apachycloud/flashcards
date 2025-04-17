import React, { useState, useEffect, useCallback, useRef } from 'react'; // Restored useRef
import DeckBrowser from './DeckBrowser'; // Import the new component
import StudySession from './StudySession'; // Import the new component
import './App.css';
import { Deck, Card /*, StatEntry */ } from './types'; // Restored Card
import Notification from './Notification'; // Import the new component
import CardBrowser from './CardBrowser'; // Import the new CardBrowser component
// import { updateCardInDeck, saveData } from './utils'; // REMOVED

// Define StatEntry locally
interface StatEntry {
  // Using interface locally
  timestamp: string;
  cardId: number | string;
  quality: number;
  deck?: string; // Optional: Add if JOIN is implemented in stats endpoint
  new_interval_days?: number;
  new_ease_factor?: number;
  thinking_time_sec?: number | null; // Optional
  rating_time_sec?: number | null; // Optional
  // Add other potential fields from revlog if needed
}

// Define StatSummary and potentially a RecentReviewEntry type locally
interface StatSummary {
  reviewsLast7Days: number;
  totalReviews: number;
  averageTimeSec: string | null;
}

interface RecentReviewEntry {
  timestamp: string;
  cardId: number | string;
  deck: string;
  quality: number;
  new_interval_days?: number;
  new_ease_factor?: number;
  time_taken_sec?: string | null; // Changed to string due to .toFixed()
  front?: string; // Truncated front content
}

// Define the base URL for the backend API
const API_BASE_URL = 'http://localhost:5001/api';
// const MEDIA_BASE_URL = 'http://localhost:5001'; // REMOVED: Unused

// Define possible views
type View = 'deck-browser' | 'study-session' | 'stats' | 'card-browser';

function App() {
  // --- State ---
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null); // For studying
  const [browsedDeckName, setBrowsedDeckName] = useState<string | null>(null); // For browsing cards
  const [dueCards, setDueCards] = useState<Card[]>([]); // Cards for current study session
  const [browseCards, setBrowseCards] = useState<Card[]>([]); // All cards for card browser
  // const [currentCardIndex, setCurrentCardIndex] = useState<number>(0); // REMOVED: Unused

  // State for Add Card form (REMOVED - Handled in DeckBrowser)
  /*
  const [newCardFrontType, setNewCardFrontType] = useState<'text' | 'image'>('text');
  const [newCardFrontContent, setNewCardFrontContent] = useState<string>('');
  const [newCardBackType, setNewCardBackType] = useState<'text' | 'image'>('text');
  const [newCardBackContent, setNewCardBackContent] = useState<string>('');
  const [addCardError, setAddCardError] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState<boolean>(false);
  */

  // State for Add Deck form (REMOVED - Handled in DeckBrowser)
  /*
  const [newDeckName, setNewDeckName] = useState<string>('');
  const [addDeckError, setAddDeckError] = useState<string | null>(null);
  const [isAddingDeck, setIsAddingDeck] = useState<boolean>(false);
  */

  // Loading/Error states
  const [isDecksLoading, setIsDecksLoading] = useState<boolean>(false);
  const [decksError, setDecksError] = useState<string | null>(null);
  const [isCardsLoading, setIsCardsLoading] = useState<boolean>(false); // For study session cards
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [isBrowseCardsLoading, setIsBrowseCardsLoading] =
    useState<boolean>(false); // For browse cards
  const [browseCardsError, setBrowseCardsError] = useState<string | null>(null);

  // State for success messages (REMOVED - Use Notification)
  /*
  const [deckSuccessMessage, setDeckSuccessMessage] = useState<string | null>(null);
  const [cardSuccessMessage, setCardSuccessMessage] = useState<string | null>(null);
  */

  // State for Statistics
  const [statsData, setStatsData] = useState<StatEntry[]>([]); // Use local StatEntry
  // const [showStats, setShowStats] = useState<boolean>(false); // REMOVED: Unused
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Refs for file inputs (REMOVED - Handled in DeckBrowser)
  /*
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  */

  // State to control the current view
  const [currentView, setCurrentView] = useState<View>('deck-browser');

  // State for adding a card (REMOVED - Handled in DeckBrowser)
  // const [selectedDeckForAdd, setSelectedDeckForAdd] = useState<string>('');

  // State for Notifications
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Separate state for summary and recent reviews
  const [statsSummary, setStatsSummary] = useState<StatSummary | null>(null);
  const [recentReviews, setRecentReviews] = useState<RecentReviewEntry[]>([]);

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

  // Helper function to show a temporary success message (REMOVED - Use Notification)
  /*
  const showSuccessMessage = (message: string, type: 'deck' | 'card') => {
    if (type === 'deck') {
      setDeckSuccessMessage(message);
      setTimeout(() => setDeckSuccessMessage(null), 3000); // Clear after 3 seconds
    } else {
      setCardSuccessMessage(message);
      setTimeout(() => setCardSuccessMessage(null), 3000);
    }
  };
  */

  // Helper to show notification
  const showNotification = useCallback(
    (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000); // Hide after 3 seconds
    },
    [setNotification]
  );

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
  const handleAddCard = async (
    deckName: string,
    cardData: {
      front_type: 'text' | 'image' | 'excalidraw';
      front_content: string;
      back_type: 'text' | 'image' | 'excalidraw';
      back_content: string;
    }
  ): Promise<boolean> => {
    setNotification(null);
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
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to add card' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      const newCard = await response.json();
      console.log('Card added:', newCard);
      // No need to update local state 'decks', maybe just refetch counts?
      fetchDecks(); // Refetch decks to update counts
      showNotification('Card added successfully!', 'success');
      return true;
    } catch (err: any) {
      console.error('Add card error:', err);
      showNotification(`Error adding card: ${err.message}`, 'error');
      return false;
    }
  };

  // Handler to rate a card
  const handleRateCard = async (
    cardId: string | number,
    quality: number,
    elapsedTimeMs?: number | null // Add elapsedTimeMs argument
  ): Promise<boolean> => {
    setNotification(null);
    const deckName = selectedDeck;
    if (!deckName) {
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
      `Rating card ID ${cardId} in deck ${deckName} with quality ${quality}, time: ${elapsedTimeMs}ms`
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(
          deckName
        )}/cards/${cardId}/rate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quality, timeTakenMs: elapsedTimeMs }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.statusText}` }));
        throw new Error(
          errorData.error || `Failed to rate card: ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log(`Card ${cardId} rated successfully:`, result.message);

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

  // Handler to fetch stats and switch view
  const handleShowStats = async () => {
    setCurrentView('stats');
    setIsStatsLoading(true);
    setStatsError(null);
    setStatsSummary(null); // Clear previous stats
    setRecentReviews([]);
    try {
      const response = await fetch(`${API_BASE_URL}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // Expect { summary: StatSummary, recentReviews: RecentReviewEntry[] }
      const data = await response.json();
      setStatsSummary(data.summary);
      setRecentReviews(data.recentReviews);
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
    setSelectedDeck(null); // Clear study deck
    setBrowsedDeckName(null); // Clear browsed deck
    setDueCards([]);
    setBrowseCards([]); // Clear browse cards
    setStatsSummary(null); // Clear stats state
    setRecentReviews([]);
    setCardsError(null);
    setStatsError(null);
    setBrowseCardsError(null); // Clear browse error
  };

  // Handler to open Card Browser for a specific deck
  const handleBrowseDeck = useCallback(async (deckName: string) => {
    if (!deckName) return;
    console.log(`Browsing deck: ${deckName}`);
    setBrowsedDeckName(deckName);
    setIsBrowseCardsLoading(true);
    setBrowseCardsError(null);
    setBrowseCards([]);
    try {
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards/all` // Fetch all cards
      );
      if (!response.ok) {
        if (response.status === 404) {
          setBrowseCardsError(`Deck '${deckName}' not found on backend.`);
          setIsBrowseCardsLoading(false);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Card[] = await response.json();
      setBrowseCards(data);
      console.log(`Loaded ${data.length} cards for browsing.`);
      setCurrentView('card-browser'); // Switch view
    } catch (e: any) {
      console.error('Failed to fetch cards for browsing:', e);
      setBrowseCardsError('Failed to load cards for this deck.');
    } finally {
      setIsBrowseCardsLoading(false);
    }
  }, []);

  // Handler to delete a specific card
  const handleDeleteCard = async (
    deckName: string,
    cardId: string | number
  ): Promise<boolean> => {
    console.log(
      '[App.tsx] handleDeleteCard called for deck:',
      deckName,
      'cardId:',
      cardId
    ); // Log entry
    console.log(`Deleting card ID ${cardId} from deck ${deckName}`);
    setNotification(null);
    try {
      console.log('[App.tsx] Sending DELETE request to API...'); // Log before fetch
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards/${cardId}`,
        { method: 'DELETE' }
      );
      console.log(
        '[App.tsx] API response status:',
        response.status,
        response.statusText
      ); // Log status
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.statusText}` }));
        console.error('[App.tsx] API error data:', errorData);
        throw new Error(
          errorData.error || `Failed to delete card: ${response.statusText}`
        );
      }
      // Remove card from the browseCards state
      console.log('[App.tsx] Updating browseCards state...'); // Log before state update
      setBrowseCards((prevCards) =>
        prevCards.filter((card) => card.id !== cardId)
      );
      showNotification('Card deleted successfully!', 'success');
      return true;
    } catch (err: any) {
      console.error('[App.tsx] Delete card error catch block:', err); // Log caught error
      showNotification(`Error deleting card: ${err.message}`, 'error');
      return false;
    }
  };

  // Handler to update a card's content (now expects full card data)
  const handleUpdateCard = async (
    deckName: string, // Pass deckName explicitly now
    cardId: string | number,
    updatedCardData: {
      front_type: 'text' | 'image' | 'excalidraw';
      front_content: string;
      back_type: 'text' | 'image' | 'excalidraw';
      back_content: string;
    }
  ): Promise<boolean> => {
    setNotification(null);
    if (!deckName) {
      console.error('Cannot update card: Deck name is missing.');
      showNotification('Error: Could not identify deck.', 'error');
      return false;
    }
    if (cardId === undefined) {
      console.error('Cannot update card: Card ID is missing.');
      showNotification('Error: Card ID is missing.', 'error');
      return false;
    }

    console.log(`Updating card ID ${cardId} in deck ${deckName}`);

    try {
      const response = await fetch(
        `${API_BASE_URL}/decks/${encodeURIComponent(deckName)}/cards/${cardId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedCardData), // Send the whole data object
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.statusText}` }));
        throw new Error(
          errorData.error || `Failed to update card: ${response.statusText}`
        );
      }
      const updatedCardFromServer = await response.json(); // Assuming backend returns the updated card
      console.log('Card updated:', updatedCardFromServer);

      // Update the card in the browseCards state
      setBrowseCards((prevCards) =>
        prevCards.map((card) =>
          card.id === cardId
            ? { ...card, ...updatedCardFromServer } // Merge with server response or updatedCardData
            : card
        )
      );

      showNotification('Card updated successfully!', 'success');
      return true;
    } catch (err: any) {
      console.error('Update card error:', err);
      showNotification(`Error updating card: ${err.message}`, 'error');
      return false;
    }
  };

  // --- Render Logic based on currentView ---
  const renderCurrentView = () => {
    switch (currentView) {
      case 'study-session':
        if (!selectedDeck) return <p>Error: No deck selected for study.</p>; // Should not happen
        return (
          <StudySession
            deckName={selectedDeck}
            cards={dueCards}
            isLoading={isCardsLoading}
            error={cardsError}
            onRateCard={handleRateCard}
            onGoBack={handleGoToDecks}
            onStudyAll={startStudyAllSession}
            onUpdateCard={(cardId, data) =>
              handleUpdateCard(selectedDeck, cardId, data)
            }
          />
        );
      case 'card-browser': // New case for Card Browser
        if (!browsedDeckName)
          return <p>Error: No deck selected for browsing.</p>; // Should not happen
        return (
          <CardBrowser
            deckName={browsedDeckName}
            cards={browseCards}
            isLoading={isBrowseCardsLoading}
            error={browseCardsError}
            onUpdateCard={(cardId, data) =>
              handleUpdateCard(browsedDeckName, cardId, data)
            }
            onDeleteCard={handleDeleteCard}
            onAddCard={handleAddCard}
            onGoBack={handleGoToDecks}
            onUploadFile={handleFileUpload}
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
            onBrowseDeck={handleBrowseDeck}
            onShowStats={handleShowStats}
            onAddCard={handleAddCard}
            onUploadFile={handleFileUpload}
          />
        );
    }
  };

  const renderStats = () => {
    return (
      <div className="stats-view anki-like-view">
        <div className="stats-header">
          <h2>Statistics</h2>
          <button
            onClick={handleGoToDecks}
            className="anki-button anki-button-secondary"
          >
            Back to Decks
          </button>
        </div>

        {isStatsLoading && <p>Loading statistics...</p>}
        {statsError && <p className="error-message">{statsError}</p>}

        {!isStatsLoading && !statsError && (
          <>
            {/* Summary Section */}
            {statsSummary && (
              <div className="stats-summary anki-group-box">
                <h3>Summary</h3>
                <p>Total Reviews: {statsSummary.totalReviews}</p>
                <p>Reviews Last 7 Days: {statsSummary.reviewsLast7Days}</p>
                <p>
                  Average Answer Time:{' '}
                  {statsSummary.averageTimeSec
                    ? `${statsSummary.averageTimeSec}s`
                    : 'N/A'}
                </p>
                {/* Add more summary stats here if calculated on backend */}
              </div>
            )}

            {/* Recent Reviews Section */}
            <div className="recent-reviews anki-group-box">
              <h3>Recent Reviews</h3>
              {recentReviews.length > 0 ? (
                <table className="anki-table stats-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Deck</th>
                      <th>Card Front (Start)</th>
                      <th>Quality</th>
                      <th>Time Taken</th>
                      {/* Add other columns like New Interval if desired */}
                    </tr>
                  </thead>
                  <tbody>
                    {recentReviews.map((review, index) => (
                      <tr key={index}>
                        <td>{new Date(review.timestamp).toLocaleString()}</td>
                        <td>{review.deck}</td>
                        <td>{review.front || '(N/A)'}</td>
                        <td>
                          {['Again', 'Hard', 'Good', 'Easy'][review.quality] ||
                            'Unknown'}
                        </td>
                        <td>
                          {review.time_taken_sec
                            ? `${review.time_taken_sec}s`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No review history found.</p>
              )}
            </div>
          </>
        )}
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
