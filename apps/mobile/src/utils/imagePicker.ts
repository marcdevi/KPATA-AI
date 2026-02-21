/**
 * Native image picker implementation
 * Uses expo-image-picker for native platforms
 */

import * as ImagePicker from 'expo-image-picker';

export interface ImagePickerResult {
  cancelled: boolean;
  uri?: string;
  base64?: string;
  width?: number;
  height?: number;
}

/**
 * Pick an image from the device gallery
 */
export async function pickImage(): Promise<ImagePickerResult> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    return { cancelled: true };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { cancelled: true };
  }

  const asset = result.assets[0];
  return {
    cancelled: false,
    uri: asset.uri,
    base64: asset.base64 || undefined,
    width: asset.width,
    height: asset.height,
  };
}

/**
 * Take a photo with the camera
 */
export async function takePhoto(): Promise<ImagePickerResult> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  
  if (status !== 'granted') {
    return { cancelled: true };
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { cancelled: true };
  }

  const asset = result.assets[0];
  return {
    cancelled: false,
    uri: asset.uri,
    base64: asset.base64 || undefined,
    width: asset.width,
    height: asset.height,
  };
}
