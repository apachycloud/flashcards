import React, { useState, useEffect } from 'react';
import { Card } from './types';

// Define props that this component will receive from App
interface StudySessionProps {
  deckName: string;
  cards: Card[];
  isLoading: boolean;
  error: string | null;
  onRateCard: (cardId: string | number, quality: number) => Promise<boolean>;
  onGoBack: () => void;
}

const StudySession: React.FC<StudySessionProps> = (props) => {
  const { deckName, cards, isLoading, error, onRateCard, onGoBack } = props;

  // Internal state for the study session
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  const [showingAnswer, setShowingAnswer] = useState<boolean>(false);
  // Add state for timing if needed here

  // Reset state when cards change (e.g., new session starts)
  useEffect(() => {
    setCurrentCardIndex(0);
    setShowingAnswer(false);
  }, [cards]);

  const handleShowAnswerClick = () => {
    setShowingAnswer(true);
    // Start timer if needed
  };

  const handleRateClick = async (quality: number) => {
    const currentCard = cards[currentCardIndex];
    if (!currentCard) return;

    // Indicate loading state?
    const success = await onRateCard(currentCard.id, quality);
    // Stop loading indicator

    if (success) {
      const nextIndex = currentCardIndex + 1;
      if (nextIndex < cards.length) {
        setCurrentCardIndex(nextIndex);
        setShowingAnswer(false); // Hide answer for next card
      } else {
        // Session finished!
        alert('Session complete!'); // Simple alert for now
        onGoBack(); // Go back to deck browser
      }
    } else {
      // Error occurred (alert was likely shown in App.tsx handler)
    }
  };

  // Helper to render card content (can be imported if moved to a shared utils file)
  const renderCardContent = (type: 'text' | 'image', content: string) => {
    const MEDIA_BASE_URL = 'http://localhost:5001'; // Or get from props/context
    if (type === 'image') {
      const imageUrl = `${MEDIA_BASE_URL}/media/${encodeURIComponent(content)}`;
      return (
        <img
          src={imageUrl}
          alt={content}
          style={{ maxWidth: '100%', maxHeight: '300px' }}
        />
      ); // Increased max height
    } else {
      return <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>; // Preserve line breaks
    }
  };

  // --- Render Logic ---
  const currentCard = cards.length > 0 ? cards[currentCardIndex] : null;
  const sessionFinished = cards.length > 0 && currentCardIndex >= cards.length;

  if (isLoading) {
    return <p>Loading cards...</p>;
  }

  if (error) {
    return <p className="error-message">Error loading cards: {error}</p>;
  }

  if (cards.length === 0) {
    return (
      <div>
        <p>No cards due in "{deckName}" for now!</p>
        <button onClick={onGoBack}>Back to Decks</button>
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
    <section className="study-session-view">
      <h3>
        Studying: {deckName} ({currentCardIndex + 1} / {cards.length})
      </h3>
      {currentCard ? (
        <div className="card study-card">
          {' '}
          {/* Added study-card class */}
          <div className="card-content">
            <h4>Front:</h4>
            {renderCardContent(
              currentCard.front_type,
              currentCard.front_content
            )}
          </div>
          {showingAnswer && (
            <div className="card-content card-back-content">
              {' '}
              {/* Added class */}
              <h4>Back:</h4>
              {renderCardContent(
                currentCard.back_type,
                currentCard.back_content
              )}
            </div>
          )}
          <div className="card-controls study-controls">
            {' '}
            {/* Added class */}
            {!showingAnswer ? (
              <button onClick={handleShowAnswerClick}>Show Answer</button>
            ) : (
              <div className="rating-buttons">
                <button
                  onClick={() => handleRateClick(0)}
                  style={{ backgroundColor: '#FF9999' }}
                >
                  Fail (0)
                </button>
                <button
                  onClick={() => handleRateClick(1)}
                  style={{ backgroundColor: '#FFCC99' }}
                >
                  Hard (1)
                </button>
                <button
                  onClick={() => handleRateClick(2)}
                  style={{ backgroundColor: '#99FF99' }}
                >
                  Good (2)
                </button>
                <button
                  onClick={() => handleRateClick(3)}
                  style={{ backgroundColor: '#99CCFF' }}
                >
                  Easy (3)
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p>Loading card...</p> // Should not happen if loading state is handled
      )}
    </section>
  );
};

export default StudySession;
