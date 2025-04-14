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
    <section className="deck-browser-anki">
      <div className="deck-browser-header">
        <h2>Decks</h2>
        <button
          className="anki-button anki-sync-button"
          onClick={() => alert('Sync not implemented')}
        >
          Sync
        </button>
      </div>

      <div className="deck-table-container">
        {isLoading && <p>Loading decks...</p>}
        {error && <p className="error-message">{error}</p>}
        {!isLoading && !error && decks.length === 0 && (
          <p>No decks found. Add one below.</p>
        )}
        {!isLoading && !error && decks.length > 0 && (
          <table className="deck-table anki-table">
            <thead>
              <tr>
                <th>Deck</th>
                <th>Due</th>
                <th>New</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {decks.map((deck) => (
                <tr key={deck.name}>
                  <td>
                    <button
                      className="deck-name-button"
                      onClick={() => onStudyDeck(deck.name)}
                    >
                      {deck.name}
                    </button>
                  </td>
                  <td className="count-due">{deck.due_count ?? 0}</td>
                  <td className="count-new">{deck.new_count ?? 0}</td>
                  <td>
                    <div className="deck-actions">
                      <button
                        onClick={() => onStudyDeck(deck.name)}
                        title="Study Deck"
                        className="anki-button study-button"
                      >
                        Изучать
                      </button>
                      <button
                        className="anki-button gear-button"
                        title="Deck Options"
                      >
                        ⚙️
                        <div className="deck-options-dropdown">
                          <button onClick={() => openAddCardModal(deck.name)}>
                            Add Card
                          </button>
                          <button
                            onClick={() => alert('Rename not implemented')}
                          >
                            Rename
                          </button>
                          {deck.name !== 'Default' && (
                            <button
                              onClick={() => onDeleteDeck(deck.name)}
                              style={{ color: 'red' }}
                            >
                              Delete
                            </button>
                          )}
                          {/* Add more options like Export later */}
                        </div>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="deck-browser-footer">
        <button
          className="anki-button"
          onClick={() => alert('Get Shared not implemented')}
        >
          Get Shared
        </button>
        <button
          className="anki-button"
          data-bs-toggle="collapse"
          data-bs-target="#addDeckFormCollapse"
        >
          Create Deck
        </button>
        <button
          className="anki-button"
          onClick={() => alert('Import File not implemented')}
        >
          Import File
        </button>
      </div>

      {/* Collapsible Add Deck Form */}
      <div className="collapse" id="addDeckFormCollapse">
        <form
          className="add-deck-form anki-form"
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
          <button type="submit" disabled={isAddingDeck} className="anki-button">
            {isAddingDeck ? 'Adding...' : 'Add Deck'}
          </button>
          {addDeckError && <p className="error-message">{addDeckError}</p>}
        </form>
      </div>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowAddCardModal(false)}
        >
          <div
            className="modal-content anki-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add Card to &quot;{addCardDeck}&quot;</h3>
            <form
              className="add-card-form anki-form"
              onSubmit={handleAddCardSubmit}
            >
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
              <div className="modal-actions">
                <button
                  type="submit"
                  disabled={isAddingCard}
                  className="anki-button"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCardModal(false)}
                  className="anki-button anki-button-secondary"
                  style={{ marginLeft: 8 }}
                >
                  Cancel
                </button>
              </div>
              {addCardError && <p className="error-message">{addCardError}</p>}
              {addCardSuccess && (
                <p className="success-message">{addCardSuccess}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default DeckBrowser;
