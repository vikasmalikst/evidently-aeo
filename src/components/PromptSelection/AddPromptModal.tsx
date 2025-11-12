import { X } from 'lucide-react';
import { useState } from 'react';

interface AddPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (promptText: string) => void;
  topicName: string;
}

export const AddPromptModal = ({
  isOpen,
  onClose,
  onAdd,
  topicName
}: AddPromptModalProps) => {
  const [promptText, setPromptText] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!promptText.trim()) {
      setError('Please enter a prompt');
      return;
    }

    if (promptText.trim().length < 10) {
      setError('Prompt must be at least 10 characters');
      return;
    }

    onAdd(promptText.trim());
    setPromptText('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setPromptText('');
    setError('');
    onClose();
  };

  return (
    <div className="add-prompt-modal-overlay" onClick={handleClose}>
      <div className="add-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="add-prompt-modal-header">
          <div>
            <h2>Add Custom Prompt</h2>
            <p className="add-prompt-modal-subtitle">
              Add a custom prompt to {topicName}
            </p>
          </div>
          <button
            className="add-prompt-modal-close"
            onClick={handleClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="add-prompt-modal-body">
            <div className="add-prompt-input-group">
              <label htmlFor="prompt-text" className="add-prompt-label">
                Prompt Text
              </label>
              <textarea
                id="prompt-text"
                className="add-prompt-textarea"
                placeholder="Enter your custom prompt question..."
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  setError('');
                }}
                rows={4}
                autoFocus
              />
              {error && <p className="add-prompt-error">{error}</p>}
              <p className="add-prompt-hint">
                Example: "What are the key benefits of using this product?"
              </p>
            </div>
          </div>

          <div className="add-prompt-modal-footer">
            <button
              type="button"
              className="add-prompt-cancel-button"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="add-prompt-submit-button"
            >
              Add Prompt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
