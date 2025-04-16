import React, { useState, useRef, useEffect } from 'react';
import { Card } from './types';
import { Excalidraw } from '@excalidraw/excalidraw';
// import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw'; // If specific API access needed

interface CardBrowserProps {
  deckName: string;
  cards: Card[];
  isLoading: boolean;
  error: string | null;
  // Update signature to match App.tsx
  onUpdateCard: (
    cardId: string | number,
    updatedCardData: {
      front_type: 'text' | 'image' | 'excalidraw';
      front_content: string;
      back_type: 'text' | 'image' | 'excalidraw';
      back_content: string;
    }
  ) => Promise<boolean>;
  onDeleteCard: (deckName: string, cardId: string | number) => Promise<boolean>;
  onGoBack: () => void;
  onUploadFile?: (file: File) => Promise<string | null>; // Add for image uploads
}

const CardBrowser: React.FC<CardBrowserProps> = ({
  deckName,
  cards,
  isLoading,
  error,
  onUpdateCard,
  onDeleteCard,
  onGoBack,
  onUploadFile, // Destructure
}) => {
  // --- State for Edit Modal ---
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editFrontType, setEditFrontType] = useState<
    'text' | 'image' | 'excalidraw'
  >('text');
  const [editFrontContent, setEditFrontContent] = useState<string>('');
  const [editBackType, setEditBackType] = useState<
    'text' | 'image' | 'excalidraw'
  >('text');
  const [editBackContent, setEditBackContent] = useState<string>('');
  const [isUpdatingCard, setIsUpdatingCard] = useState<boolean>(false);
  const [editCardError, setEditCardError] = useState<string | null>(null);
  const [editCardSuccess, setEditCardSuccess] = useState<string | null>(null);

  // --- State for Excalidraw ---
  const [showExcalidrawModal, setShowExcalidrawModal] =
    useState<boolean>(false);
  const [excalidrawEditingSide, setExcalidrawEditingSide] = useState<
    'front' | 'back' | null
  >(null);
  const [excalidrawInitialElements, setExcalidrawInitialElements] = useState<
    any[] | null
  >(null);
  const [excalidrawInitialAppState, setExcalidrawInitialAppState] = useState<
    any | null
  >(null);
  const excalidrawApiRef = useRef<any | null>(null);

  // --- Open Edit Modal ---
  const openEditModal = (card: Card) => {
    setEditingCard(card);
    setEditFrontType(card.front_type);
    setEditFrontContent(card.front_content);
    setEditBackType(card.back_type);
    setEditBackContent(card.back_content);
    setEditCardError(null);
    setEditCardSuccess(null);
    setShowEditModal(true);
  };

  // --- Handle File Upload (same as in DeckBrowser) ---
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setContent: (v: string) => void
  ) => {
    if (onUploadFile && e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // We assume onUploadFile is passed from App.tsx now
      const filename = await onUploadFile(file);
      if (filename) {
        setContent(filename);
      } else {
        // Handle upload failure in modal
        setEditCardError('Failed to upload image.');
      }
    }
  };

  // --- Excalidraw Logic (adapted for edit modal state) ---
  const openExcalidraw = (side: 'front' | 'back') => {
    setExcalidrawEditingSide(side);
    const currentContent =
      side === 'front' ? editFrontContent : editBackContent;
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
      // ... other relevant state ...
    };
    const dataToSave = JSON.stringify({ elements, appState: minimalAppState });

    if (excalidrawEditingSide === 'front') {
      setEditFrontContent(dataToSave);
    } else if (excalidrawEditingSide === 'back') {
      setEditBackContent(dataToSave);
    }
    setShowExcalidrawModal(false);
    setExcalidrawEditingSide(null);
    // Don't clear initial elements/state here, keep them for potential re-edit
  };

  // --- Handle Edit Submit ---
  const handleEditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCard) {
      setEditCardError('No card selected for editing.');
      return;
    }
    setIsUpdatingCard(true);
    setEditCardError(null);
    setEditCardSuccess(null);

    if (!editFrontContent || !editBackContent) {
      setEditCardError('Front and Back content cannot be empty.');
      setIsUpdatingCard(false);
      return;
    }

    const updatedCardData = {
      front_type: editFrontType,
      front_content: editFrontContent,
      back_type: editBackType,
      back_content: editBackContent,
    };

    // Call the onUpdateCard prop passed from App.tsx
    const success = await onUpdateCard(editingCard.id, updatedCardData);

    if (success) {
      setEditCardSuccess('Card updated successfully!');
      // Close modal after a short delay
      setTimeout(() => {
        setShowEditModal(false);
        setEditingCard(null);
      }, 1000);
    } else {
      // Error is shown via notification from App.tsx
      setEditCardError('Failed to update card. See notification or console.');
    }
    setIsUpdatingCard(false);
  };

  // --- Render ---
  return (
    <section className="card-browser-view anki-like-view">
      <div className="card-browser-header">
        <h2>Cards in "{deckName}"</h2>
        <button
          onClick={onGoBack}
          className="anki-button anki-button-secondary"
        >
          Back to Decks
        </button>
      </div>

      {isLoading && <p>Loading cards...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && (
        <div className="card-list-container">
          {cards.length === 0 ? (
            <p>No cards found in this deck.</p>
          ) : (
            <table className="anki-table card-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Front</th>
                  <th>Back</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr key={card.id}>
                    <td>{card.id}</td>
                    {/* Display content based on type */}
                    <td>
                      {card.front_type === 'text' && card.front_content}
                      {card.front_type === 'image' && onUploadFile && (
                        <img
                          src={`/uploads/${card.front_content}`}
                          alt="Front"
                          className="thumbnail-preview"
                        />
                      )}
                      {card.front_type === 'image' && !onUploadFile && (
                        <span>[Image: {card.front_content}]</span>
                      )}
                      {card.front_type === 'excalidraw' && '[Drawing]'}
                    </td>
                    <td>
                      {card.back_type === 'text' && card.back_content}
                      {card.back_type === 'image' && onUploadFile && (
                        <img
                          src={`/uploads/${card.back_content}`}
                          alt="Back"
                          className="thumbnail-preview"
                        />
                      )}
                      {card.back_type === 'image' && !onUploadFile && (
                        <span>[Image: {card.back_content}]</span>
                      )}
                      {card.back_type === 'excalidraw' && '[Drawing]'}
                    </td>
                    <td>
                      <div className="card-actions">
                        <button
                          onClick={() => openEditModal(card)}
                          className="anki-button"
                          title="Edit Card"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            console.log(
                              '[CardBrowser] Delete button clicked for card:',
                              card.id,
                              'in deck:',
                              deckName
                            );
                            onDeleteCard(deckName, card.id);
                          }}
                          className="anki-button anki-button-danger"
                          title="Delete Card"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* --- Edit Card Modal --- */}
      {showEditModal && editingCard && (
        <div className="modal-backdrop">
          <div className="modal anki-modal edit-card-modal">
            {' '}
            {/* Add specific class */}
            <h2>Edit Card (ID: {editingCard.id})</h2>
            <form onSubmit={handleEditCardSubmit}>
              {/* Front Side */}
              <div className="anki-group-box">
                <h3>Front</h3>
                <select
                  value={editFrontType}
                  onChange={(e) => setEditFrontType(e.target.value as any)}
                  disabled={isUpdatingCard}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="excalidraw">Excalidraw</option>
                </select>
                {editFrontType === 'text' && (
                  <textarea
                    value={editFrontContent}
                    onChange={(e) => setEditFrontContent(e.target.value)}
                    placeholder="Front text"
                    disabled={isUpdatingCard}
                  />
                )}
                {editFrontType === 'image' && onUploadFile && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setEditFrontContent)}
                      disabled={isUpdatingCard}
                    />
                    {editFrontContent && (
                      <img
                        src={`/uploads/${editFrontContent}`}
                        alt="Preview"
                        className="image-preview"
                      />
                    )}
                  </div>
                )}
                {editFrontType === 'image' && !onUploadFile && (
                  <p className="error-message">
                    Image upload functionality not available.
                  </p>
                )}
                {editFrontType === 'excalidraw' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => openExcalidraw('front')}
                      className="anki-button anki-button-secondary"
                      disabled={isUpdatingCard}
                    >
                      Edit Drawing
                    </button>
                    <div className="excalidraw-preview">
                      {editFrontContent
                        ? '(Drawing exists)'
                        : '(No drawing yet)'}
                    </div>
                  </div>
                )}
              </div>

              {/* Back Side */}
              <div className="anki-group-box">
                <h3>Back</h3>
                <select
                  value={editBackType}
                  onChange={(e) => setEditBackType(e.target.value as any)}
                  disabled={isUpdatingCard}
                >
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="excalidraw">Excalidraw</option>
                </select>
                {editBackType === 'text' && (
                  <textarea
                    value={editBackContent}
                    onChange={(e) => setEditBackContent(e.target.value)}
                    placeholder="Back text"
                    disabled={isUpdatingCard}
                  />
                )}
                {editBackType === 'image' && onUploadFile && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, setEditBackContent)}
                      disabled={isUpdatingCard}
                    />
                    {editBackContent && (
                      <img
                        src={`/uploads/${editBackContent}`}
                        alt="Preview"
                        className="image-preview"
                      />
                    )}
                  </div>
                )}
                {editBackType === 'image' && !onUploadFile && (
                  <p className="error-message">
                    Image upload functionality not available.
                  </p>
                )}
                {editBackType === 'excalidraw' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => openExcalidraw('back')}
                      className="anki-button anki-button-secondary"
                      disabled={isUpdatingCard}
                    >
                      Edit Drawing
                    </button>
                    <div className="excalidraw-preview">
                      {editBackContent
                        ? '(Drawing exists)'
                        : '(No drawing yet)'}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit & Close Buttons */}
              <div className="modal-actions">
                <button
                  type="submit"
                  disabled={isUpdatingCard}
                  className="anki-button anki-button-primary"
                >
                  {isUpdatingCard ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="anki-button anki-button-secondary"
                  disabled={isUpdatingCard}
                >
                  Cancel
                </button>
              </div>
              {editCardSuccess && (
                <p className="success-message">{editCardSuccess}</p>
              )}
              {editCardError && (
                <p className="error-message">{editCardError}</p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Excalidraw Modal (shared logic, uses edit state) */}
      {showExcalidrawModal && excalidrawEditingSide && (
        <div className="modal-backdrop">
          <div className="modal excalidraw-modal">
            <h2>
              Edit {excalidrawEditingSide === 'front' ? 'Front' : 'Back'}{' '}
              Drawing
            </h2>
            <div className="excalidraw-container">
              <Excalidraw
                excalidrawAPI={(api) => (excalidrawApiRef.current = api)}
                initialData={{
                  elements: excalidrawInitialElements || [],
                  appState: excalidrawInitialAppState || {
                    viewBackgroundColor: '#ffffff',
                  },
                }}
                // You might need onChange handler here if you want live updates
                // onChange={(elements, state) => console.log(elements, state)}
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

export default CardBrowser;
