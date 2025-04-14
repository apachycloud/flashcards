import React, { useState } from 'react';
import { Deck } from './types'; // Импортируем тип Deck

// Define props that this component will receive from App
interface DeckBrowserProps {
  decks: Deck[];
  isLoading: boolean;
  error: string | null;
  onAddDeck: (deckName: string) => Promise<boolean>;
  onDeleteDeck: (deckName: string) => Promise<boolean>;
  onStudyDeck: (deckName: string) => void;
  onShowStats: () => void;
  onAddCard: (
    deckName: string,
    cardData: {
      front_type: 'text' | 'image';
      front_content: string;
      back_type: 'text' | 'image';
      back_content: string;
    }
  ) => Promise<boolean>;
  onUploadFile?: (file: File) => Promise<string | null>;
  // TODO: Add props related to adding cards if that form stays here
}

const DeckBrowser: React.FC<DeckBrowserProps> = (props) => {
  // Destructure props for easier access
  const {
    decks,
    isLoading,
    error,
    onAddDeck,
    onDeleteDeck,
    onStudyDeck,
    onShowStats,
    onAddCard,
    onUploadFile,
  } = props;

  // TODO: Move state for the Add Deck form here from App.tsx
  const [newDeckName, setNewDeckName] = useState<string>('');
  const [isAddingDeck, setIsAddingDeck] = useState<boolean>(false);
  const [addDeckError, setAddDeckError] = useState<string | null>(null);
  const [showAddCardModal, setShowAddCardModal] = useState<boolean>(false);
  const [addCardDeck, setAddCardDeck] = useState<string>('');
  const [addCardSuccess, setAddCardSuccess] = useState<string | null>(null);
  const [addCardError, setAddCardError] = useState<string | null>(null);
  const [frontType, setFrontType] = useState<'text' | 'image'>('text');
  const [frontContent, setFrontContent] = useState<string>('');
  const [backType, setBackType] = useState<'text' | 'image'>('text');
  const [backContent, setBackContent] = useState<string>('');
  const [isAddingCard, setIsAddingCard] = useState<boolean>(false);

  const handleAddDeckSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    const trimmedName = newDeckName.trim();
    if (!trimmedName) {
      setAddDeckError('Please enter a deck name.');
      return;
    }
    setIsAddingDeck(true);
    setAddDeckError(null);
    const success = await onAddDeck(trimmedName);
    if (success) {
      setNewDeckName(''); // Clear input on success
      // Maybe show success message specific to this component
    } else {
      // Error message should be handled by the alert in onAddDeck for now
      // Or display an error state specific to this component
      setAddDeckError('Failed to add deck. See console or previous alert.'); // Generic fallback
    }
    setIsAddingDeck(false);
  };

  const openAddCardModal = (deckName: string) => {
    setAddCardDeck(deckName);
    setFrontType('text');
    setFrontContent('');
    setBackType('text');
    setBackContent('');
    setAddCardError(null);
    setAddCardSuccess(null);
    setShowAddCardModal(true);
  };

  const handleAddCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingCard(true);
    setAddCardError(null);
    setAddCardSuccess(null);
    if (!frontContent || !backContent) {
      setAddCardError('Заполните обе стороны карточки!');
      setIsAddingCard(false);
      return;
    }
    const cardData = {
      front_type: frontType,
      front_content: frontContent,
      back_type: backType,
      back_content: backContent,
    };
    const success = await onAddCard(addCardDeck, cardData);
    if (success) {
      setAddCardSuccess('Карточка успешно добавлена!');
      setFrontContent('');
      setBackContent('');
      setTimeout(() => setShowAddCardModal(false), 1000);
    } else {
      setAddCardError('Ошибка при добавлении карточки.');
    }
    setIsAddingCard(false);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setContent: (v: string) => void
  ) => {
    if (onUploadFile && e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const filename = await onUploadFile(file);
      if (filename) setContent(filename);
    }
  };

  // TODO: Move the JSX for deck list, add deck form, add card form here from App.tsx

  return (
    <section className="deck-management">
      <h2
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        Decks
        <button
          onClick={onShowStats}
          className="header-button"
          style={{ position: 'static', marginLeft: 16 }}
        >
          Show Stats
        </button>
      </h2>
      <div className="deck-list">
        {isLoading && <p>Loading decks...</p>}
        {error && <p className="error-message">{error}</p>}
        {decks.length === 0 && !isLoading && !error && (
          <p>No decks found. Add one below.</p>
        )}
        <table className="deck-table">
          <thead>
            <tr>
              <th>Название колоды</th>
              <th>Всего</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {decks.map((deck) => {
              const total = deck.card_count ?? 0;
              return (
                <tr key={deck.name}>
                  <td>
                    <button
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#007bff',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                      onClick={() => onStudyDeck(deck.name)}
                    >
                      {deck.name}
                    </button>
                  </td>
                  <td>{total}</td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onStudyDeck(deck.name)}>
                      Изучать
                    </button>
                    <button onClick={() => openAddCardModal(deck.name)}>
                      Добавить карточку
                    </button>
                    {deck.name !== 'Default' && (
                      <button
                        onClick={() => onDeleteDeck(deck.name)}
                        style={{ color: 'red' }}
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Deck Form */}
      <form
        className="add-deck-form"
        onSubmit={handleAddDeckSubmit}
        style={{ marginTop: 16 }}
      >
        <input
          type="text"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          placeholder="New deck name"
          required
        />
        <button type="submit" disabled={isAddingDeck}>
          {isAddingDeck ? 'Adding...' : 'Add Deck'}
        </button>
        {addDeckError && <p className="error-message">{addDeckError}</p>}
      </form>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddCardModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Добавить карточку в &quot;{addCardDeck}&quot;</h3>
            <form className="add-card-form" onSubmit={handleAddCardSubmit}>
              <div className="input-group">
                <label>Front Type:</label>
                <select
                  value={frontType}
                  onChange={(e) =>
                    setFrontType(e.target.value as 'text' | 'image')
                  }
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                </select>
                {frontType === 'text' ? (
                  <textarea
                    value={frontContent}
                    onChange={(e) => setFrontContent(e.target.value)}
                    placeholder="Front text"
                  />
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setFrontContent)}
                  />
                )}
                {frontType === 'image' && frontContent && (
                  <img
                    src={`/media/${frontContent}`}
                    alt="front"
                    style={{ maxWidth: 120, marginTop: 8 }}
                  />
                )}
              </div>
              <div className="input-group">
                <label>Back Type:</label>
                <select
                  value={backType}
                  onChange={(e) =>
                    setBackType(e.target.value as 'text' | 'image')
                  }
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                </select>
                {backType === 'text' ? (
                  <textarea
                    value={backContent}
                    onChange={(e) => setBackContent(e.target.value)}
                    placeholder="Back text"
                  />
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setBackContent)}
                  />
                )}
                {backType === 'image' && backContent && (
                  <img
                    src={`/media/${backContent}`}
                    alt="back"
                    style={{ maxWidth: 120, marginTop: 8 }}
                  />
                )}
              </div>
              <button type="submit" disabled={isAddingCard}>
                Добавить
              </button>
              {addCardError && <p className="error-message">{addCardError}</p>}
              {addCardSuccess && (
                <p className="success-message">{addCardSuccess}</p>
              )}
              <button
                type="button"
                onClick={() => setShowAddCardModal(false)}
                style={{ marginLeft: 8 }}
              >
                Отмена
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TODO: Decide where the "Add Card" form should live. 
           Maybe it opens as a modal or on a separate screen? 
           Keeping it out of DeckBrowser for now simplifies things. */}
    </section>
  );
};

export default DeckBrowser;
