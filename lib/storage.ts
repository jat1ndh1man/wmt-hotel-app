import { supabase } from './supabaseClient';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export class StorageAPI {
  async uploadImage(uri: string, bucket: string = 'property-images'): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('File does not exist');

      // Create unique filename
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}/${Math.random().toString(36).substring(7)}-${Date.now()}.${fileExt}`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const blob = this.base64ToBlob(base64, `image/${fileExt}`);

      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  async uploadDocument(uri: string, bucket: string = 'property-documents'): Promise<string> {
    return this.uploadImage(uri, bucket);
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  async pickImage(): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to upload images!');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.error('Error picking image:', error);
      return null;
    }
  }

  async pickMultipleImages(): Promise<string[]> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to upload images!');
        return [];
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        return result.assets.map(asset => asset.uri);
      }

      return [];
    } catch (error) {
      console.error('Error picking images:', error);
      return [];
    }
  }
}

export const storageAPI = new StorageAPI();