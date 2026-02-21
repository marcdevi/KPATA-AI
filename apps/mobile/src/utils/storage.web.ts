/**
 * Web-specific storage implementation
 * Uses localStorage for web browsers
 */

export async function getItemAsync(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore errors
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
}
