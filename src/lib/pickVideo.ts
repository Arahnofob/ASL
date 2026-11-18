// Getting a sign video into the app: from Photos, the camera, or the Files app.
// The picked video is copied into the app's media folder and its file name is returned
// (to be stored on the card as [video:name]). Returns null if the person cancelled.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { importMediaFile } from './storage';
import { uid } from './util';
import { videoExtension } from './video';

async function save(uri: string, nameHint: string, mime?: string | null): Promise<string> {
  const name = `v-${uid()}.${videoExtension(nameHint, mime)}`;
  await importMediaFile(uri, name);
  return name;
}

/** Pick a video from Photos. iPhone shows a trim screen first, so you can cut out just the sign. */
export async function videoFromPhotos(): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsEditing: true,
    // Smaller files: 960×540 is plenty for a sign and keeps backups manageable.
    videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540,
    shouldDownloadFromNetwork: true,
  });
  const a = r.canceled ? undefined : r.assets[0];
  return a ? save(a.uri, a.fileName ?? a.uri, a.mimeType) : null;
}

/** Record a video with the camera (e.g. your teacher signing a word, with their permission). */
export async function videoFromCamera(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Camera access is off. Allow it in iPhone Settings → Signs → Camera.');
  const r = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    allowsEditing: true,
    videoMaxDuration: 30,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame960x540,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_960x540,
  });
  const a = r.canceled ? undefined : r.assets[0];
  return a ? save(a.uri, a.fileName ?? a.uri, a.mimeType) : null;
}

/** Pick a video file from the Files app (iCloud Drive, downloads, AirDrop…). */
export async function videoFromFiles(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['video/*'], copyToCacheDirectory: true, multiple: false });
  const a = r.canceled ? undefined : r.assets[0];
  return a ? save(a.uri, a.name, a.mimeType) : null;
}
