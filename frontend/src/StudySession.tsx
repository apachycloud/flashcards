import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from './types';

// Import Excalidraw directly
import { Excalidraw } from '@excalidraw/excalidraw';
// Potentially import types if needed, though might not be necessary for viewing
// import { ExcalidrawElement, AppState } from '@excalidraw/excalidraw';

// Define props that this component will receive from App
interface StudySessionProps {
  deckName: string;
  cards: Card[];
  isLoading: boolean;
  error: string | null;
  onRateCard: (cardId: string | number, quality: number) => Promise<boolean>;
  onGoBack: () => void;
  onStudyAll: (deckName: string) => void;
  onUpdateCard: (
    cardId: string | number,
    side: 'front' | 'back',
    newContent: string
  ) => Promise<boolean>;
}

const StudySession: React.FC<StudySessionProps> = (props) => {
  const {
    deckName,
    cards,
    isLoading,
    error,
    onRateCard,
    onGoBack,
    onStudyAll,
    onUpdateCard,
  } = props;

  // Internal state for the study session
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [showingAnswer, setShowingAnswer] = useState<boolean>(false);
  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  // Local copy of cards for the session to allow reordering
  const [sessionCards, setSessionCards] = useState<Card[]>([]);

  // State for Edit Modal
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingSide, setEditingSide] = useState<'front' | 'back' | null>(null);
  const [editingContent, setEditingContent] = useState<string>(''); // Store the JSON string being edited
  const [editingError, setEditingError] = useState<string | null>(null);
  const editExcalidrawApiRef = useRef<any | null>(null); // Ref for Excalidraw API in modal

  // Initialize/Reset session cards and state when props.cards changes
  useEffect(() => {
    setSessionCards([...props.cards]); // Create a copy
    setCurrentCardIndex(0);
    setShowingAnswer(false);
    setStartTime(Date.now());
    setElapsedTime(null);
  }, [props.cards]);

  // Start timer for subsequent cards (when index changes relative to current sessionCards)
  useEffect(() => {
    // Only reset timer if index is valid for current sessionCards
    if (currentCardIndex < sessionCards.length) {
      setShowingAnswer(false);
      setStartTime(Date.now());
      setElapsedTime(null);
    }
    // If index is out of bounds (e.g., after moving last card with 'Again'),
    // handleRateClick should have handled session end.
  }, [currentCardIndex, sessionCards]); // Depend on sessionCards as well

  const handleShowAnswerClick = useCallback(() => {
    if (!showingAnswer && startTime) {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);
      setShowingAnswer(true);
    }
  }, [showingAnswer, startTime]);

  const handleRateClick = useCallback(
    async (quality: number) => {
      // Use sessionCards for current card info
      const currentCard = sessionCards[currentCardIndex];
      if (!currentCard) return;

      const success = await onRateCard(currentCard.id, quality);

      if (success) {
        if (quality === 0) {
          // AGAIN
          // Move card to the end of the session queue
          const cardToMove = sessionCards[currentCardIndex];
          // Create new array: filter out the current card, then add it to the end
          const newSessionCards = sessionCards.filter(
            (_, index) => index !== currentCardIndex
          );
          newSessionCards.push(cardToMove);
          setSessionCards(newSessionCards);

          // Index remains the same, but points to the *next* card now
          // Check if we were already at the end (relative to the *original* size before moving)
          // If current index is now >= new length, session is over
          if (currentCardIndex >= newSessionCards.length) {
            console.log("Session finished after moving last card with 'Again'");
            onGoBack();
          } else {
            // Reset timer for the card that is now at currentCardIndex
            setShowingAnswer(false);
            setStartTime(Date.now());
            setElapsedTime(null);
          }
        } else {
          // HARD, GOOD, EASY
          const nextIndex = currentCardIndex + 1;
          if (nextIndex < sessionCards.length) {
            setCurrentCardIndex(nextIndex); // Will trigger useEffect to reset timer
          } else {
            // Session finished!
            console.log('Session finished normally');
            onGoBack();
          }
        }
      } else {
        // Error occurred
      }
      // Dependencies for useCallback
    },
    [
      sessionCards,
      currentCardIndex,
      onRateCard,
      setSessionCards,
      onGoBack,
      setStartTime,
      setElapsedTime,
      setShowingAnswer,
    ]
  );

  // Add keydown listener for Spacebar and auto-rating
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keydown events if the edit modal is open
      if (showEditModal) return;

      if (event.code === 'Space') {
        event.preventDefault(); // Prevent scrolling/button activation
        if (!showingAnswer) {
          // First space press: Show answer
          handleShowAnswerClick();
        } else {
          // Second space press (answer is showing): Auto-rate based on time
          if (elapsedTime !== null) {
            const quality = elapsedTime < 1000 ? 3 : 0; // Easy if < 1s, else Again
            console.log(
              `Auto-rating with quality ${quality} based on time ${elapsedTime}ms`
            );
            handleRateClick(quality);
          } else {
            console.warn('Space pressed again, but elapsedTime is null?');
            handleRateClick(0); // Fallback to Again
          }
        }
      }
      // TODO: Add number keys 1-4 for manual rating?
      // else if (!showEditModal && showingAnswer && event.key >= '1' && event.key <= '4') { // Also check !showEditModal here
      //    const quality = parseInt(event.key, 10) - 1; // 1->0, 2->1, 3->2, 4->3
      //    handleRateClick(quality);
      // }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Update dependencies to include showEditModal
  }, [
    showingAnswer,
    handleShowAnswerClick,
    elapsedTime,
    handleRateClick,
    showEditModal,
  ]);

  // --- Edit Logic ---

  // Function to handle opening the edit modal
  const handleEditClick = () => {
    if (!currentCard) return;

    const sideToEdit = showingAnswer ? 'back' : 'front';
    const type =
      sideToEdit === 'front' ? currentCard.front_type : currentCard.back_type;
    const content =
      sideToEdit === 'front'
        ? currentCard.front_content
        : currentCard.back_content;

    if (type === 'excalidraw') {
      console.log(
        `Opening edit modal for ${sideToEdit} side of card ${currentCard.id}`
      );
      setEditingSide(sideToEdit);
      setEditingContent(content); // Load current content into state
      setEditingError(null);
      setShowEditModal(true);
    } else {
      console.log('Cannot edit non-Excalidraw content directly here.');
    }
  };

  // Function to save changes from the edit modal
  const handleModalSave = async () => {
    if (!currentCard || !editingSide || !editExcalidrawApiRef.current) return;

    setEditingError(null);
    try {
      const elements = editExcalidrawApiRef.current.getSceneElements();
      const appState = editExcalidrawApiRef.current.getAppState();
      // Optionally minimize appState here like in DeckBrowser
      const minimalAppState = {
        viewBackgroundColor: appState.viewBackgroundColor,
        // Add other relevant appState properties if needed
      };
      const updatedJson = JSON.stringify({
        elements,
        appState: minimalAppState,
      });

      // Call the update handler passed from App
      const success = await onUpdateCard(
        currentCard.id,
        editingSide,
        updatedJson
      );

      if (success) {
        // Update local session state immediately
        setSessionCards((prevSessionCards) =>
          prevSessionCards.map((card) => {
            if (card.id === currentCard.id) {
              return {
                ...card,
                [editingSide === 'front' ? 'front_content' : 'back_content']:
                  updatedJson,
              };
            }
            return card;
          })
        );
        setShowEditModal(false); // Close modal on success
        setEditingSide(null);
        setEditingContent('');
      } else {
        // Error message handled by notification in App.tsx
        setEditingError('Failed to save changes. Check notifications.');
      }
    } catch (error) {
      console.error('Error saving card edits:', error);
      setEditingError('An error occurred while saving.');
    }
  };

  // Helper to render card content (including Excalidraw)
  const renderCardContent = (
    type: 'text' | 'image' | 'excalidraw',
    content: string
  ) => {
    const MEDIA_BASE_URL = 'http://localhost:5001';

    if (type === 'image') {
      const imageUrl = `${MEDIA_BASE_URL}/media/${encodeURIComponent(content)}`;
      return (
        <img
          src={imageUrl}
          alt="Card content"
          style={{ maxWidth: '100%', maxHeight: '400px' }}
        />
      );
    } else if (type === 'excalidraw') {
      try {
        const excalidrawProps = JSON.parse(content);
        // Use content string as key to force re-mount on change
        const key = content;
        return (
          <div key={key} style={{ height: '400px', width: '100%' }}>
            <Excalidraw
              initialData={{
                ...excalidrawProps,
                scrollToContent: true,
              }}
              viewModeEnabled={true}
              zenModeEnabled={true}
              gridModeEnabled={false}
            />
          </div>
        );
      } catch (e) {
        console.error('Error rendering Excalidraw content:', e);
        return <p className="error-message">Error loading drawing</p>;
      }
    } else {
      // Default to text
      return <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>;
    }
  };

  // --- Render Logic ---
  // Use sessionCards for rendering and checks
  const currentCard =
    sessionCards.length > 0 ? sessionCards[currentCardIndex] : null;
  // Session finished logic is handled within handleRateClick now
  // const sessionFinished = sessionCards.length > 0 && currentCardIndex >= sessionCards.length;

  // Determine if the *currently visible* side is editable (i.e., is Excalidraw)
  const isCurrentSideEditable =
    currentCard &&
    ((showingAnswer && currentCard.back_type === 'excalidraw') ||
      (!showingAnswer && currentCard.front_type === 'excalidraw'));

  // --- Debug Log ---
  /* // REMOVED DEBUG LOG
  if (currentCard) {
    console.log('StudySession Debug:',
      {
        showingAnswer,
        front_type: currentCard.front_type,
        back_type: currentCard.back_type,
        isCurrentSideEditable 
      }
    );
  } else {
      console.log('StudySession Debug: No currentCard')
  }
  */
  // --- End Debug Log ---

  if (isLoading) {
    return <p>Loading cards...</p>;
  }

  if (error) {
    return (
      <div className="study-finished-view">
        <h3>Error</h3>
        <p className="error-message">{error}</p>
        <button
          onClick={onGoBack}
          className="anki-button"
          style={{ marginTop: 20 }}
        >
          Back to Decks
        </button>
      </div>
    );
  }

  if (
    (props.cards.length === 0 && !isLoading) ||
    (sessionCards.length === 0 && !isLoading)
  ) {
    return (
      <div className="study-finished-view">
        <h3>Congratulations!</h3>
        <p>You have finished this deck for now.</p>
        <button
          onClick={() => onStudyAll(deckName)}
          className="anki-button"
          style={{ marginRight: 10 }}
        >
          Study All Cards
        </button>
        <button
          onClick={onGoBack}
          className="anki-button anki-button-secondary"
        >
          Back to Decks
        </button>
      </div>
    );
  }

  return (
    <section className="study-session-view study-area anki-study-area">
      <div className="study-header">
        <span>Studying: {deckName}</span>
        <span>
          Card {currentCardIndex + 1} / {sessionCards.length}
        </span>
      </div>
      {currentCard ? (
        <div className="card study-card anki-study-card">
          <div className="card-content">
            {showingAnswer
              ? renderCardContent(
                  currentCard.back_type,
                  currentCard.back_content
                )
              : renderCardContent(
                  currentCard.front_type,
                  currentCard.front_content
                )}
          </div>
          {/* Display elapsed time when answer is shown */}
          {showingAnswer && elapsedTime !== null && (
            <div
              className="elapsed-time-display"
              style={{ textAlign: 'center', color: 'grey', marginTop: '10px' }}
            >
              Time: {(elapsedTime / 1000).toFixed(1)}s
            </div>
          )}
        </div>
      ) : (
        <p>Loading card...</p>
      )}
      <div className="study-controls anki-study-controls">
        {!showingAnswer ? (
          <button
            onClick={handleShowAnswerClick}
            className="anki-button show-answer-button-anki"
          >
            Show Answer (Space)
          </button>
        ) : (
          <div className="rating-buttons anki-style-ratings">
            <button
              onClick={() => handleRateClick(0)}
              className="rate-button rate-again"
            >
              Again
              <br />
              <span className="time-hint">1m</span>
            </button>
            <button
              onClick={() => handleRateClick(1)}
              className="rate-button rate-hard"
            >
              Hard
              <br />
              <span className="time-hint">10m</span>
            </button>
            <button
              onClick={() => handleRateClick(2)}
              className="rate-button rate-good"
            >
              Good
              <br />
              <span className="time-hint">1d</span>
            </button>
            <button
              onClick={() => handleRateClick(3)}
              className="rate-button rate-easy"
            >
              Easy
              <br />
              <span className="time-hint">4d</span>
            </button>
          </div>
        )}
      </div>
      <div className="study-footer-buttons">
        {/* Show Edit button only if current side is Excalidraw */}
        {isCurrentSideEditable && (
          <button className="anki-button" onClick={handleEditClick}>
            Edit Drawing
          </button>
        )}
        <button className="anki-button" onClick={onGoBack}>
          Back to Decks
        </button>
        <button
          className="anki-button"
          onClick={() => alert('More options not implemented')}
        >
          More
        </button>
      </div>

      {/* --- Excalidraw Edit Modal --- */}
      {showEditModal && editingSide && (
        <div
          className="modal-backdrop excalidraw-modal-backdrop"
          onClick={() => setShowEditModal(false)} // Close on backdrop click
        >
          <div
            className="modal-content excalidraw-modal-content"
            style={{
              width: '90vw',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            <h3>Editing {editingSide} side</h3>
            {editingError && <p className="error-message">{editingError}</p>}
            <div style={{ flexGrow: 1, height: 'calc(100% - 80px)' }}>
              {' '}
              {/* Adjust height for title and buttons */}
              <Excalidraw
                excalidrawAPI={(api) => (editExcalidrawApiRef.current = api)}
                initialData={(() => {
                  // Use IIFE to parse safely
                  try {
                    if (editingContent) {
                      return JSON.parse(editingContent);
                    }
                  } catch (e) {
                    console.error(
                      'Error parsing editing content for Excalidraw:',
                      e
                    );
                    setEditingError('Error loading existing drawing data.');
                  }
                  // Return default empty state if no content or parse error
                  return {
                    elements: [],
                    appState: { viewBackgroundColor: '#ffffff' },
                  };
                })()}
                // We are editing, so don't enable view mode
                viewModeEnabled={false}
              />
            </div>
            <div className="modal-actions excalidraw-actions">
              <button onClick={handleModalSave} className="anki-button">
                Save Changes
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="anki-button anki-button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default StudySession;
