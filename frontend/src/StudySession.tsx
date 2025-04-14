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

  // Reset state when cards change or index changes
  useEffect(() => {
    setCurrentCardIndex(0);
    setShowingAnswer(false);
    setStartTime(Date.now()); // Start timer for the first card
    setElapsedTime(null);
  }, [cards]); // Only reset fully when cards array changes

  // Start timer for subsequent cards
  useEffect(() => {
    setShowingAnswer(false); // Ensure answer is hidden for new card
    setStartTime(Date.now()); // Start timer for the current card
    setElapsedTime(null); // Reset elapsed time
  }, [currentCardIndex]); // Run when index changes

  const handleShowAnswerClick = useCallback(() => {
    if (!showingAnswer && startTime) {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);
      setShowingAnswer(true);
    }
  }, [showingAnswer, startTime]);

  const handleRateClick = async (quality: number) => {
    const currentCard = cards[currentCardIndex];
    if (!currentCard) return;

    // Indicate loading state?
    const success = await onRateCard(currentCard.id, quality);
    // Stop loading indicator

    if (success) {
      const nextIndex = currentCardIndex + 1;
      if (nextIndex < cards.length) {
        setCurrentCardIndex(nextIndex); // This will trigger the useEffect to reset timer
      } else {
        // Session finished! No alert needed, just go back.
        onGoBack(); // Go back to deck browser
      }
    } else {
      // Error occurred (alert was likely shown in App.tsx handler)
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
                initialData={excalidrawProps} // Load saved elements and appState
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
  const currentCard = cards.length > 0 ? cards[currentCardIndex] : null;
  const sessionFinished = cards.length > 0 && currentCardIndex >= cards.length;

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

  if (cards.length === 0 && !isLoading) {
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

  if (sessionFinished) {
    // This state might not be reached if onGoBack is called immediately
    return (
      <div>
        <p>Session complete for "{deckName}"!</p>
        <button onClick={onGoBack}>Back to Decks</button>
      </div>
    );
  }

  return (
    <section className="study-session-view study-area anki-study-area">
      <div className="study-header">
        <span>Studying: {deckName}</span>
        <span>
          Card {currentCardIndex + 1} / {cards.length}
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
