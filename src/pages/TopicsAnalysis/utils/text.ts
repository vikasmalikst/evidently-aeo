export const wrapLabelText = (value: string | number, maxLength: number): string[] => {
  const rawText = value ?? '';
  const normalized =
    typeof rawText === 'number' ? rawText.toString() : rawText.toString().trim();

  if (!normalized) {
    return [''];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word, index) => {
    const tentativeLine = currentLine ? `${currentLine} ${word}` : word;

    if (tentativeLine.length <= maxLength) {
      currentLine = tentativeLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }

      if (word.length > maxLength) {
        for (let i = 0; i < word.length; i += maxLength) {
          lines.push(word.slice(i, i + maxLength));
        }
        currentLine = '';
      } else {
        currentLine = word;
      }
    }

    if (index === words.length - 1 && currentLine) {
      lines.push(currentLine);
    }
  });

  return lines.length ? lines : [normalized];
};


