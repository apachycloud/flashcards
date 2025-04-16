import React, { useState, useRef } from 'react';
import { Deck } from './types'; // Импортируем тип Deck
// Import the library itself and types directly if exported
// Could not resolve types automatically, using 'any' temporarily
// import { ExcalidrawElement, AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw';

// Import Excalidraw directly
import { Excalidraw } from '@excalidraw/excalidraw';
// Import types if needed for API ref etc.
// import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw';

// Define props that this component will receive from App
interface DeckBrowserProps {
  decks: Deck[];
  isLoading: boolean;
  error: string | null;
  onAddDeck: (deckName: string) => Promise<boolean>;
  onDeleteDeck: (deckName: string) => Promise<boolean>;
  onStudyDeck: (deckName: string) => void;
  onBrowseDeck: (deckName: string) => void;
  onShowStats: () => void;
  onAddCard: (
    deckName: string,
    cardData: {
      front_type: 'text' | 'image' | 'excalidraw';
      front_content: string;
      back_type: 'text' | 'image' | 'excalidraw';
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
    onBrowseDeck,
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
  const [frontType, setFrontType] = useState<'text' | 'image' | 'excalidraw'>(
    'text'
  );
  const [frontContent, setFrontContent] = useState<string>('');
  const [backType, setBackType] = useState<'text' | 'image' | 'excalidraw'>(
    'text'
  );
  const [backContent, setBackContent] = useState<string>('');
  const [isAddingCard, setIsAddingCard] = useState<boolean>(false);

  // State for Excalidraw Modal
  const [showExcalidrawModal, setShowExcalidrawModal] =
    useState<boolean>(false);
  const [editingSide, setEditingSide] = useState<'front' | 'back' | null>(null);
  const [excalidrawInitialElements, setExcalidrawInitialElements] = useState<
    any[] | null
  >(null);
  const [excalidrawInitialAppState, setExcalidrawInitialAppState] = useState<
    any | null
  >(null);
  const excalidrawApiRef = useRef<any | null>(null);

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

  // --- Excalidraw Modal Logic ---
  const openExcalidraw = (side: 'front' | 'back') => {
    setEditingSide(side);
    const currentContent = side === 'front' ? frontContent : backContent;
    try {
      if (currentContent) {
        const parsedData = JSON.parse(currentContent);
        setExcalidrawInitialElements(parsedData?.elements || []);
        setExcalidrawInitialAppState(
          parsedData?.appState || { viewBackgroundColor: '#ffffff' }
        );
      } else {
        setExcalidrawInitialElements([]);
        setExcalidrawInitialAppState({ viewBackgroundColor: '#ffffff' });
      }
    } catch (e) {
      console.error('Error parsing Excalidraw data:', e);
      setExcalidrawInitialElements([]);
      setExcalidrawInitialAppState({ viewBackgroundColor: '#ffffff' });
    }
    setShowExcalidrawModal(true);
  };

  const saveExcalidraw = () => {
    if (!excalidrawApiRef.current) return;

    const elements = excalidrawApiRef.current.getSceneElements();
    const appState = excalidrawApiRef.current.getAppState();

    const minimalAppState: any = {
      viewBackgroundColor: appState.viewBackgroundColor,
      currentItemStrokeColor: appState.currentItemStrokeColor,
      currentItemBackgroundColor: appState.currentItemBackgroundColor,
      currentItemRoughness: appState.currentItemRoughness,
      currentItemStrokeWidth: appState.currentItemStrokeWidth,
      currentItemFontFamily: appState.currentItemFontFamily,
      currentItemFontSize: appState.currentItemFontSize,
      currentItemTextAlign: appState.currentItemTextAlign,
    };

    const dataToSave = JSON.stringify({ elements, appState: minimalAppState });

    if (editingSide === 'front') {
      setFrontContent(dataToSave);
    } else if (editingSide === 'back') {
      setBackContent(dataToSave);
    }
    setShowExcalidrawModal(false);
    setEditingSide(null);
    setExcalidrawInitialElements(null);
    setExcalidrawInitialAppState(null);
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
                      onClick={() => onBrowseDeck(deck.name)}
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
                        className="anki-button anki-button-primary"
                      >
                        Изучать
                      </button>
                      <button
                        onClick={() =>
                          alert('Deck settings not implemented yet.')
                        }
                        className="deck-settings-button anki-button"
                        title="Deck Settings"
                        disabled
                      >
                        ⚙️
                      </button>
                      <button
                        onClick={() => openAddCardModal(deck.name)}
                        className="add-card-button anki-button"
                        title="Add card to this deck"
                      >
                        +
                      </button>
                      <button
                        onClick={async () => {
                          await onDeleteDeck(deck.name);
                        }}
                        className="delete-deck-button anki-button anki-button-danger"
                        title="Delete deck"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="deck-browser-footer-actions">
        <button className="anki-button anki-button-primary">
          Add Deck (Form Below)
        </button>
        <button
          className="anki-button anki-button-secondary"
          onClick={onShowStats}
        >
          Stats
        </button>
        <button
          className="anki-button anki-button-secondary"
          onClick={() => alert('Import not implemented')}
        >
          Import File
        </button>
      </div>

      <form
        onSubmit={handleAddDeckSubmit}
        className="add-deck-form anki-form"
        style={{ marginTop: '1rem' }}
      >
        <input
          type="text"
          value={newDeckName}
          onChange={(e) => setNewDeckName(e.target.value)}
          placeholder="New Deck Name"
          disabled={isAddingDeck}
          required
        />
        <button type="submit" disabled={isAddingDeck} className="anki-button">
          {isAddingDeck ? 'Adding...' : 'Add Deck'}
        </button>
        {addDeckError && <p className="error-message">{addDeckError}</p>}
      </form>

      {/* Add Card Modal */}
      {showAddCardModal && (
        <div className="modal-backdrop">
          <div className="modal anki-modal">
            <h2>Add Card to "{addCardDeck}"</h2>
            {/* Form content ... */}
            <form onSubmit={handleAddCardSubmit}>
              {/* Front Side */}
              <div className="anki-group-box">
                <h3>Front</h3>
                {/* Type Selector */}
                <select
                  value={frontType}
                  onChange={(e) => setFrontType(e.target.value as any)}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="excalidraw">Excalidraw</option>
                </select>
                {/* Content Input */}
                {frontType === 'text' && (
                  <textarea
                    value={frontContent}
                    onChange={(e) => setFrontContent(e.target.value)}
                    placeholder="Front text"
                  />
                )}
                {frontType === 'image' && onUploadFile && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setFrontContent)}
                    />
                    {frontContent && (
                      <img
                        src={`/uploads/${frontContent}`}
                        alt="Preview"
                        className="image-preview"
                      />
                    )}
                  </div>
                )}
                {frontType === 'excalidraw' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => openExcalidraw('front')}
                      className="anki-button anki-button-secondary"
                    >
                      Edit Drawing
                    </button>
                    <div className="excalidraw-preview">
                      {/* Simple placeholder or render tiny Excalidraw preview */}
                      {frontContent ? '(Drawing exists)' : '(No drawing yet)'}
                    </div>
                  </div>
                )}
              </div>

              {/* Back Side */}
              <div className="anki-group-box">
                <h3>Back</h3>
                {/* Type Selector */}
                <select
                  value={backType}
                  onChange={(e) => setBackType(e.target.value as any)}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="excalidraw">Excalidraw</option>
                </select>
                {/* Content Input */}
                {backType === 'text' && (
                  <textarea
                    value={backContent}
                    onChange={(e) => setBackContent(e.target.value)}
                    placeholder="Back text"
                  />
                )}
                {backType === 'image' && onUploadFile && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setBackContent)}
                    />
                    {backContent && (
                      <img
                        src={`/uploads/${backContent}`}
                        alt="Preview"
                        className="image-preview"
                      />
                    )}
                  </div>
                )}
                {backType === 'excalidraw' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => openExcalidraw('back')}
                      className="anki-button anki-button-secondary"
                    >
                      Edit Drawing
                    </button>
                    <div className="excalidraw-preview">
                      {backContent ? '(Drawing exists)' : '(No drawing yet)'}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit & Close Buttons */}
              <div className="modal-actions">
                <button
                  type="submit"
                  disabled={isAddingCard}
                  className="anki-button anki-button-primary"
                >
                  {isAddingCard ? 'Adding...' : 'Add Card'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCardModal(false)}
                  className="anki-button anki-button-secondary"
                >
                  Close
                </button>
              </div>
              {addCardSuccess && (
                <p className="success-message">{addCardSuccess}</p>
              )}
              {addCardError && <p className="error-message">{addCardError}</p>}
            </form>
            {/* ... end of form */}
          </div>
        </div>
      )}

      {/* Excalidraw Modal */}
      {showExcalidrawModal && editingSide && (
        <div className="modal-backdrop">
          <div className="modal excalidraw-modal">
            <h2>Edit {editingSide === 'front' ? 'Front' : 'Back'} Drawing</h2>
            <div className="excalidraw-container">
              <Excalidraw
                excalidrawAPI={(api) => (excalidrawApiRef.current = api)}
                initialData={{
                  elements: excalidrawInitialElements || [],
                  appState: excalidrawInitialAppState || {
                    viewBackgroundColor: '#ffffff',
                  },
                }}
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={saveExcalidraw}
                className="anki-button anki-button-primary"
              >
                Save Drawing
              </button>
              <button
                onClick={() => setShowExcalidrawModal(false)}
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

export default DeckBrowser;
