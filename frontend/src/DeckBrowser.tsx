import React, { useState, lazy, Suspense, useRef } from 'react';
import { Deck } from './types'; // Импортируем тип Deck
// Import the library itself and types directly if exported
// Could not resolve types automatically, using 'any' temporarily
// import { ExcalidrawElement, AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw';

// Dynamically import Excalidraw
const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
);

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
                        className="anki-button anki-button-primary"
                      >
                        Изучать
                      </button>
                      <button
                        onClick={() => console.log('Settings for', deck.name)}
                        className="deck-settings-button anki-button"
                        title="Deck Settings"
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
                          if (
                            window.confirm(
                              `Are you sure you want to delete the deck "${deck.name}"?`
                            )
                          ) {
                            await onDeleteDeck(deck.name);
                          }
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

      {/* Add Card Modal - Updated for Excalidraw */}
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
                  onChange={(e) => setFrontType(e.target.value as any)}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="excalidraw">Excalidraw</option>
                </select>
                {frontType === 'text' && (
                  <textarea
                    value={frontContent}
                    onChange={(e) => setFrontContent(e.target.value)}
                    placeholder="Front text"
                  />
                )}
                {frontType === 'image' && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setFrontContent)}
                  />
                )}
                {frontType === 'excalidraw' && (
                  <button
                    type="button"
                    onClick={() => openExcalidraw('front')}
                    className="anki-button"
                  >
                    {frontContent ? 'Edit Drawing' : 'Draw with Excalidraw'}
                  </button>
                  // TODO: Add small preview?
                )}
              </div>
              <div className="input-group">
                <label>Back Type:</label>
                <select
                  value={backType}
                  onChange={(e) => setBackType(e.target.value as any)}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="excalidraw">Excalidraw</option>
                </select>
                {backType === 'text' && (
                  <textarea
                    value={backContent}
                    onChange={(e) => setBackContent(e.target.value)}
                    placeholder="Back text"
                  />
                )}
                {backType === 'image' && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setBackContent)}
                  />
                )}
                {backType === 'excalidraw' && (
                  <button
                    type="button"
                    onClick={() => openExcalidraw('back')}
                    className="anki-button"
                  >
                    {backContent ? 'Edit Drawing' : 'Draw with Excalidraw'}
                  </button>
                  // TODO: Add small preview?
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

      {/* Excalidraw Modal */}
      {showExcalidrawModal && (
        <div
          className="modal-backdrop excalidraw-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExcalidrawModal(false);
            }
          }}
        >
          <div
            className="modal-content excalidraw-modal-content"
            style={{
              width: '90vw',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Suspense fallback={<div>Loading Excalidraw...</div>}>
              <div style={{ flexGrow: 1, height: 'calc(100% - 50px)' }}>
                <Excalidraw
                  excalidrawAPI={(api) => (excalidrawApiRef.current = api)}
                  initialData={{
                    elements: excalidrawInitialElements,
                    appState: excalidrawInitialAppState,
                    scrollToContent: true,
                  }}
                />
              </div>
            </Suspense>
            <div className="modal-actions excalidraw-actions">
              <button onClick={saveExcalidraw} className="anki-button">
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
