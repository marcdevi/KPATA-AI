/**
 * Web-specific image picker implementation
 * Uses HTML input[type=file] for web browsers
 */

export interface ImagePickerResult {
  cancelled: boolean;
  uri?: string;
  base64?: string;
  width?: number;
  height?: number;
}

/**
 * Pick an image from the device (web implementation)
 */
export async function pickImage(): Promise<ImagePickerResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve({ cancelled: true });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const uri = reader.result as string;

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          resolve({
            cancelled: false,
            uri,
            base64,
            width: img.width,
            height: img.height,
          });
        };
        img.onerror = () => {
          resolve({
            cancelled: false,
            uri,
            base64,
          });
        };
        img.src = uri;
      };
      reader.onerror = () => {
        resolve({ cancelled: true });
      };
      reader.readAsDataURL(file);
    };

    input.oncancel = () => {
      resolve({ cancelled: true });
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/**
 * Take a photo with the camera (web implementation)
 * Uses getUserMedia API
 */
export async function takePhoto(): Promise<ImagePickerResult> {
  return new Promise((resolve) => {
    // For web, we'll use the file picker with camera capture
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use back camera on mobile
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve({ cancelled: true });
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const uri = reader.result as string;

        const img = new Image();
        img.onload = () => {
          resolve({
            cancelled: false,
            uri,
            base64,
            width: img.width,
            height: img.height,
          });
        };
        img.onerror = () => {
          resolve({
            cancelled: false,
            uri,
            base64,
          });
        };
        img.src = uri;
      };
      reader.onerror = () => {
        resolve({ cancelled: true });
      };
      reader.readAsDataURL(file);
    };

    input.oncancel = () => {
      resolve({ cancelled: true });
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}
