/**
 * Date Formatting Utilities
 * 
 * Handles timezone-safe date formatting for display in user's local timezone.
 * All functions preserve calendar dates regardless of timezone.
 */

/**
 * Parse a date string (YYYY-MM-DD) and create a Date object in user's local timezone.
 * This preserves the calendar date regardless of timezone.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format (from backend/UTC)
 * @returns Date object in local timezone with the same calendar date
 */
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date in local timezone using the parsed values
  // This preserves the calendar date (e.g., Dec 20 stays Dec 20 in any timezone)
  return new Date(year, month - 1, day);
}

/**
 * Format date for chart labels (e.g., "Mon 20" or "Sat 20")
 * Handles timezone conversion: dateStr is UTC date (YYYY-MM-DD), displays in user's local timezone
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted string like "Mon 20" or "Sat 20"
 */
export function formatDateLabel(dateStr: string): string {
  try {
    const date = parseDateString(dateStr);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    return `${dayName} ${dayNum}`;
  } catch {
    return dateStr;
  }
}

/**
 * Format date for display (e.g., "Dec 02, 2025")
 * Handles timezone conversion: dateStr is UTC date (YYYY-MM-DD), displays in user's local timezone
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted string like "Dec 02, 2025"
 */
export function formatDateDisplay(dateStr: string): string {
  try {
    const date = parseDateString(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format date short (e.g., "Dec 02" or "Dec 2")
 * Handles timezone conversion: dateStr is UTC date (YYYY-MM-DD), displays in user's local timezone
 * 
 * @param dateStr - Date string in YYYY-MM-DD format or ISO timestamp
 * @returns Formatted string like "Dec 02"
 */
export function formatDateShort(dateStr: string): string {
  try {
    // Handle both YYYY-MM-DD format and ISO timestamp format
    let date: Date;
    if (dateStr.includes('T')) {
      // ISO timestamp - parse as-is
      date = new Date(dateStr);
    } else {
      // Date string YYYY-MM-DD - parse in local timezone
      date = parseDateString(dateStr);
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format date with year (e.g., "Dec 02, 2025")
 * Handles timezone conversion: dateStr is UTC date (YYYY-MM-DD), displays in user's local timezone
 * 
 * @param dateStr - Date string in YYYY-MM-DD format or ISO timestamp
 * @returns Formatted string like "Dec 02, 2025"
 */
export function formatDateWithYear(dateStr: string): string {
  try {
    // Handle both YYYY-MM-DD format and ISO timestamp format
    let date: Date;
    if (dateStr.includes('T')) {
      // ISO timestamp - parse as-is
      date = new Date(dateStr);
    } else {
      // Date string YYYY-MM-DD - parse in local timezone
      date = parseDateString(dateStr);
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/**
 * Format date for input fields (YYYY-MM-DD)
 * Converts a Date object to YYYY-MM-DD format
 * 
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

