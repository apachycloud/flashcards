import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { Card } from './types';

// Dynamically import Excalidraw for viewing
const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
);

// Define props that this component will receive from App
interface StudySessionProps {
  deckName: string;
  cards: Card[];
  isLoading: boolean;
  error: string | null;
  onRateCard: (cardId: string | number, quality: number) => Promise<boolean>;
  onGoBack: () => void;
  onStudyAll: (deckName: string) => void;
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
  } = props;

  // Internal state for the study session
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [showingAnswer, setShowingAnswer] = useState<boolean>(false);
  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  // Local copy of cards for the session to allow reordering
  const [sessionCards, setSessionCards] = useState<Card[]>([]);

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

  const handleRateClick = async (quality: number) => {
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
  };

  // Add keydown listener for Spacebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !showingAnswer) {
        event.preventDefault(); // Prevent scrolling
        handleShowAnswerClick();
      }
      // TODO: Add number keys 1-4 for rating?
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showingAnswer, handleShowAnswerClick]); // Re-bind if showingAnswer or handler changes

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
          alt="Card image"
          style={{ maxWidth: '100%', maxHeight: '400px' }}
        />
      );
    } else if (type === 'excalidraw') {
      try {
        const excalidrawProps = JSON.parse(content);
        // Use content string as key to force re-mount on change
        const key = content;
        return (
          <Suspense fallback={<div>Loading Drawing...</div>}>
            {/* Add key prop to the container */}
            <div key={key} style={{ height: '400px', width: '100%' }}>
              <Excalidraw
                initialData={{
                  ...excalidrawProps, // Spread existing props (elements, appState)
                  scrollToContent: true, // Add this line
                }}
                viewModeEnabled={true} // Read-only mode
                zenModeEnabled={true}
                gridModeEnabled={false}
              />
            </div>
          </Suspense>
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
        <button
          className="anki-button"
          onClick={() => alert('Edit not implemented')}
        >
          Edit
        </button>
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
    </section>
  );
};

export default StudySession;
