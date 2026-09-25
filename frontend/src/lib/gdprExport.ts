import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type JsonExportResult = {
  filename: string;
  uri: string | null;
  sharedAsFile: boolean;
};

function exportFilename(prefix: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${stamp}.json`;
}

export async function shareJsonExport(
  data: unknown,
  prefix = 'kjapp-gdpr-export',
): Promise<JsonExportResult> {
  const filename = exportFilename(prefix);
  const json = JSON.stringify(data, null, 2);

  if (Platform.OS === 'web') {
    await Share.share({ title: 'KJAPP dataeksport', message: json });
    return { filename, uri: null, sharedAsFile: false };
  }

  const file = new File(Paths.cache, filename);
  file.create();
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Del KJAPP dataeksport',
      mimeType: 'application/json',
    });
    return { filename, uri: file.uri, sharedAsFile: true };
  }

  await Share.share({ title: 'KJAPP dataeksport', message: json });
  return { filename, uri: file.uri, sharedAsFile: false };
}
