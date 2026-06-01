import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Download, Share2 } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function PDFViewerScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const pdfUrl = params.url as string;
  const fileName = params.fileName as string;
  const pdfTitle = (params.title as string) || 'Document Viewer';

  const [downloading, setDownloading] = useState(true);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleDownloadToDevice = async () => {
    try {
      let downloadUrl = pdfUrl;

      if (fileName) {
        const { data, error } = await supabase.storage
          .from('notes')
          .createSignedUrl(fileName, 3600);

        if (error) throw error;
        if (data?.signedUrl) {
          downloadUrl = data.signedUrl;
        }
      }

      if (downloadUrl) {
        const supported = await Linking.canOpenURL(downloadUrl);
        if (supported) {
          await Linking.openURL(downloadUrl);
        } else {
          Alert.alert('Error', 'Cannot open download link');
        }
      } else {
        Alert.alert('Error', 'Unable to resolve download URL');
      }
    } catch (err: any) {
      console.error('Error downloading file:', err);
      Alert.alert('Error', 'Failed to start download: ' + (err?.message || err));
    }
  };

  const handleShare = async () => {
    if (!pdfBase64) return;
    try {
      setSharing(true);
      const base64Clean = pdfBase64.split(';base64,').pop() || '';
      const safeTitle = pdfTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const localUri = `${FileSystem.documentDirectory}${safeTitle}.pdf`;

      await FileSystem.writeAsStringAsync(localUri, base64Clean, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${pdfTitle}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (err: any) {
      console.error('Error sharing file:', err);
      Alert.alert('Error', 'Failed to share document: ' + (err?.message || err));
    } finally {
      setSharing(false);
    }
  };


  useEffect(() => {
    if (!pdfUrl && !fileName) {
      setDownloadError('Invalid document details');
      setDownloading(false);
      return;
    }

    const downloadPDF = async () => {
      try {
        setDownloading(true);
        setDownloadError(null);

        let blob: Blob;

        if (fileName) {
          console.log('Downloading via Supabase Storage SDK:', fileName);
          const { data, error } = await supabase.storage
            .from('notes')
            .download(fileName);

          if (error) {
            console.error('Supabase Storage download error details:', error);

            console.log('Attempting to generate signed URL as alternative...');
            const { data: signedData, error: signedError } = await supabase.storage
              .from('notes')
              .createSignedUrl(fileName, 300);

            if (signedError) {
              console.error('Failed to create signed URL:', signedError);
              throw new Error('Storage download failed: ' + error.message + '. Signed URL failed: ' + signedError.message);
            }

            if (!signedData || !signedData.signedUrl) {
              throw new Error('Storage download failed: ' + error.message + '. Signed URL generation returned empty.');
            }

            console.log('Fetching from signed URL:', signedData.signedUrl);
            const response = await fetch(signedData.signedUrl);
            if (!response.ok) {
              throw new Error('Failed to download from signed URL (HTTP ' + response.status + ')');
            }
            blob = await response.blob();
          } else {
            if (!data) throw new Error('No data returned from Storage');
            blob = data;
          }
        } else {
          console.log('Downloading via HTTP fetch:', pdfUrl);
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            throw new Error('Failed to download (HTTP ' + response.status + ')');
          }
          blob = await response.blob();
        }

        const reader = new FileReader();
        reader.onerror = () => {
          setDownloadError('Failed to convert document data');
          setDownloading(false);
        };

        reader.onloadend = () => {
          setPdfBase64(reader.result as string);
          setDownloading(false);
        };

        reader.readAsDataURL(blob);
      } catch (err: any) {
        console.error('Error downloading PDF:', err);
        setDownloadError(err?.message || 'Failed to download document');
        setDownloading(false);
      }
    };

    downloadPDF();
  }, [pdfUrl, fileName]);

  const getHtmlContent = () => {
    if (!pdfBase64) return '';

    const bgColor = colors.background || '#0F172A';
    const primaryColor = colors.primary || '#8A2BE2';
    const subTextColor = colors.subText || '#94A3B8';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      background: ${bgColor};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    
    #viewer {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      gap: 16px;
    }
    
    .page-container {
      background: #FFFEF9;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 100%;
      position: relative;
    }
    
    canvas {
      display: block;
      width: 100%;
      height: auto;
    }

    /* Loading overlay */
    #loader {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: ${bgColor}; z-index: 999;
      transition: opacity 0.4s ease;
    }
    #loader.hide { opacity: 0; pointer-events: none; }
    .spin {
      width: 44px; height: 44px;
      border: 3px solid rgba(255,255,255,0.08);
      border-top-color: ${primaryColor};
      border-radius: 50%;
      animation: sp 0.8s linear infinite;
      margin-bottom: 14px;
    }
    @keyframes sp { to { transform: rotate(360deg); } }
    #loader span { color: ${subTextColor}; font-size: 14px; font-weight: 500; }
  </style>
</head>
<body>

<div id="loader">
  <div class="spin"></div>
  <span id="lt">Loading document...</span>
</div>

<div id="viewer"></div>

<script>
  const DATA = "${pdfBase64}";

  function toBytes(uri) {
    const b64 = uri.substring(uri.indexOf(';base64,') + 8);
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function init() {
    try {
      const lt = document.getElementById('lt');
      lt.innerText = 'Reading document...';

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

      const data = toBytes(DATA);
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const totalPages = pdf.numPages;

      const viewer = document.getElementById('viewer');

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        lt.innerText = 'Rendering page ' + pageNum + ' of ' + totalPages + '...';
        
        const page = await pdf.getPage(pageNum);
        // Render at a higher scale for sharpness
        const viewport = page.getViewport({ scale: 1.5 });
        
        const wrapper = document.createElement('div');
        wrapper.className = 'page-container';
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        
        wrapper.appendChild(canvas);
        viewer.appendChild(wrapper);
      }

      const loader = document.getElementById('loader');
      loader.classList.add('hide');
      setTimeout(() => {
        loader.style.display = 'none';
      }, 450);

    } catch (err) {
      console.error('PDF init error:', err);
      document.getElementById('lt').innerText = 'Failed to load document.';
      document.getElementById('lt').style.color = '#EF4444';
    }
  }

  window.onload = init;
</script>
</body>
</html>`;
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart || '#0F172A', colors.gradientEnd || '#1D283C']}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.inputBg }]}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {pdfTitle}
        </Text>

        <View style={styles.headerRight}>
          {pdfBase64 ? (
            <>
              <TouchableOpacity
                onPress={handleShare}
                style={[styles.backButton, { backgroundColor: colors.inputBg }]}
                activeOpacity={0.7}
                disabled={sharing}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Share2 size={20} color={colors.text} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDownloadToDevice}
                style={[styles.backButton, { backgroundColor: colors.inputBg }]}
                activeOpacity={0.7}
              >
                <Download size={20} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ width: 96 }} />
          )}
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {downloading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.subText }]}>
              Downloading document...
            </Text>
          </View>
        ) : downloadError ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: '#EF4444' }]}>{downloadError}</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html: getHtmlContent() }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowFileAccess={true}
            allowUniversalAccessFromFileURLs={true}
            scalesPageToFit={false}
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={true}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={true}
          />
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    width: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerRight: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
