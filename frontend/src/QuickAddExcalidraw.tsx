import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { Card } from './types';
import ReactMarkdown from 'react-markdown';

interface QuickAddProps {
  deckName: string;
  onAddCard: (
    deckName: string,
    cardData: {
      front_type: 'text' | 'image' | 'excalidraw';
      front_content: string;
      back_type: 'text' | 'image' | 'excalidraw';
      back_content: string;
    }
  ) => Promise<boolean>;
  onClose: () => void;
}

interface DraftCard {
  front_content: string;
  back_content: string;
}

// Type for AI definition which can be a string or object with term and definition
type AIDef = string | { term: string; definition: string };

const QuickAddExcalidraw: React.FC<QuickAddProps> = ({
  deckName,
  onAddCard,
  onClose,
}) => {
  const [drafts, setDrafts] = useState<DraftCard[]>([
    { front_content: '', back_content: '' },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const excalidrawApiRef = useRef<any>(null);
  // AI definitions state
  const [definitions, setDefinitions] = useState<AIDef[]>([]);
  const [defIdx, setDefIdx] = useState(0);
  const [loadingDefs, setLoadingDefs] = useState(true);
  const [definitionsError, setDefinitionsError] = useState<string | null>(null);

  // Fetch definitions from backend on mount
  useEffect(() => {
    setLoadingDefs(true);
    fetch(
      `http://localhost:5001/api/decks/${encodeURIComponent(
        deckName
      )}/ai-definitions`
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.definitions)) setDefinitions(data.definitions);
        else throw new Error('Invalid AI response');
      })
      .catch((err) => setDefinitionsError(err.message))
      .finally(() => setLoadingDefs(false));
  }, [deckName]);

  // Handle hotkeys: Tab (switch side), Enter (save and next), Esc (exit)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        // Save current drawing to draft before switching side
        if (excalidrawApiRef.current) {
          const elements = excalidrawApiRef.current.getSceneElements();
          const appState = excalidrawApiRef.current.getAppState();
          const data = JSON.stringify({ elements, appState });
          setDrafts((prev) => {
            const copy = [...prev];
            if (activeSide === 'front') copy[activeIdx].front_content = data;
            else copy[activeIdx].back_content = data;
            return copy;
          });
        }
        // Switch side
        setActiveSide((s) => (s === 'front' ? 'back' : 'front'));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Save current side content
        let currentData = '';
        if (excalidrawApiRef.current) {
          const elements = excalidrawApiRef.current.getSceneElements();
          const appState = excalidrawApiRef.current.getAppState();
          const data = JSON.stringify({ elements, appState });
          currentData = data;
          setDrafts((prev) => {
            const copy = [...prev];
            if (activeSide === 'front') copy[activeIdx].front_content = data;
            else copy[activeIdx].back_content = data;
            return copy;
          });
        }
        // Only commit when back side is done
        if (activeSide === 'back') {
          const draft = drafts[activeIdx];
          onAddCard(deckName, {
            front_type: 'excalidraw',
            front_content: draft.front_content,
            back_type: 'excalidraw',
            back_content: draft.back_content || currentData,
          }).catch(console.error);
          // Move to next AI definition
          setDefIdx((prev) => Math.min(prev + 1, definitions.length - 1));
          setDrafts((prev) => [
            ...prev,
            { front_content: '', back_content: '' },
          ]);
          setActiveIdx((i) => i + 1);
          setActiveSide('front');
          // Clear canvas
          if (excalidrawApiRef.current) {
            const api = excalidrawApiRef.current;
            const defaultAppState = api.getAppState();
            api.updateScene({ elements: [], appState: defaultAppState });
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [activeIdx, activeSide, drafts, definitions, onAddCard, onClose]
  );

  // Attach keydown listener once on mount
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Update Excalidraw when switching card or side
  useEffect(() => {
    const api = excalidrawApiRef.current;
    if (api) {
      api.updateScene(getInitialData());
    }
  }, [activeIdx, activeSide]);

  // Initial data for Excalidraw
  const getInitialData = () => {
    const content =
      activeSide === 'front'
        ? drafts[activeIdx].front_content
        : drafts[activeIdx].back_content;
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        console.warn('Failed to parse draft content, loading blank');
      }
    }
    // No saved content: use default appState to include collaborators
    const api = excalidrawApiRef.current;
    const defaultAppState = api ? api.getAppState() : { collaborators: [] };
    return { elements: [], appState: defaultAppState };
  };

  return (
    <div className="modal-backdrop quickadd-backdrop">
      <div
        className="modal quickadd-modal"
        style={{
          width: '100vw',
          height: '100vh',
          maxWidth: '100vw',
          maxHeight: '100vh',
          borderRadius: 0,
          margin: 0,
          padding: 0,
        }}
      >
        <div
          className="quickadd-definition"
          style={{ margin: '10px 0', fontSize: '1.1em' }}
        >
          {loadingDefs ? (
            'Loading definitions...'
          ) : definitionsError ? (
            `Error: ${definitionsError}`
          ) : (
            <ReactMarkdown>
              {(() => {
                const def = definitions[defIdx];
                if (!def) return '';
                if (typeof def === 'string') return def;
                if (typeof def === 'object') {
                  return def.definition || def.term || JSON.stringify(def);
                }
                return String(def);
              })()}
            </ReactMarkdown>
          )}
        </div>
        <h2>Quick Add (Deck: {deckName})</h2>
        <p>
          Card {activeIdx + 1} / {drafts.length} — Side: {activeSide}
        </p>
        <div
          className="excalidraw-container"
          style={{ width: '100%', height: 'calc(100% - 120px)' }}
        >
          <Excalidraw
            excalidrawAPI={(api) => (excalidrawApiRef.current = api)}
            initialData={getInitialData()}
          />
        </div>
        <div className="modal-actions">
          <button
            onClick={onClose}
            className="anki-button anki-button-secondary"
          >
            Cancel
          </button>
        </div>
        <p>Hotkeys: Tab → switch side; Enter → save & next; Esc → exit</p>
      </div>
    </div>
  );
};

export default QuickAddExcalidraw;
