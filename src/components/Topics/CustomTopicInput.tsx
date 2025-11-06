import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface CustomTopicInputProps {
  onAddCustomTopic: (topicName: string) => void;
}

export const CustomTopicInput = ({ onAddCustomTopic }: CustomTopicInputProps) => {
  const [showInput, setShowInput] = useState(false);
  const [customName, setCustomName] = useState('');

  const handleAdd = () => {
    if (customName.trim()) {
      onAddCustomTopic(customName.trim());
      setCustomName('');
      setShowInput(false);
    }
  };

  const handleCancel = () => {
    setCustomName('');
    setShowInput(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="custom-topic-section">
      {!showInput ? (
        <button
          className="add-custom-btn"
          onClick={() => setShowInput(true)}
          type="button"
        >
          <Plus size={18} />
          Add Custom Topic
        </button>
      ) : (
        <div className="custom-input-row">
          <input
            type="text"
            placeholder="Enter custom topic..."
            className="custom-topic-input"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            className="btn-add"
            onClick={handleAdd}
            disabled={!customName.trim()}
            type="button"
          >
            Add
          </button>
          <button
            className="btn-cancel"
            onClick={handleCancel}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
