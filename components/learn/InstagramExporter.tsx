/**
 * InstagramExporter Modal
 * Full-featured carousel export for Instagram
 * Supports view capture, camera roll save, and sharing
 * Works on both web (html2canvas) and native (react-native-view-shot)
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { showAlert, showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { InstagramSlide, SlideContent } from './InstagramSlide';
import { generateMarkRoundingSlides, skillToInstagramSlides, parseSkillMarkdown } from '@/services/SkillExportService';

// Conditional imports for native
let captureRef: any = null;
let MediaLibrary: any = null;
let Sharing: any = null;

if (Platform.OS !== 'web') {
  try {
    captureRef = require('react-native-view-shot').captureRef;
    MediaLibrary = require('expo-media-library');
    Sharing = require('expo-sharing');
  } catch (e) {
    console.warn('Native capture modules not available');
  }
}

type ThemeOption = 'ocean' | 'sunset' | 'dark' | 'regatta';
type AspectOption = 'square' | 'portrait';

interface InstagramExporterProps {
  visible: boolean;
  onClose: () => void;
  skillName?: string;
  skillMarkdown?: string;
}

const THEMES: { id: ThemeOption; name: string; colors: string[] }[] = [
  { id: 'regatta', name: 'Regatta', colors: ['#0C1929', '#1E3A5F', '#0A4570'] },
  { id: 'ocean', name: 'Ocean', colors: ['#0F172A', '#1E3A5F', '#0C4A6E'] },
  { id: 'sunset', name: 'Sunset', colors: ['#1F1147', '#4C1D95', '#7C2D12'] },
  { id: 'dark', name: 'Dark', colors: ['#030712', '#111827', '#1F2937'] },
];

const ASPECTS: { id: AspectOption; name: string; ratio: string }[] = [
  { id: 'square', name: 'Square', ratio: '1:1' },
  { id: 'portrait', name: 'Portrait', ratio: '4:5' },
];

export function InstagramExporter({
  visible,
  onClose,
  skillName = 'mark-rounding-execution',
  skillMarkdown,
}: InstagramExporterProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>('regatta');
  const [selectedAspect, setSelectedAspect] = useState<AspectOption>('square');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const slideRefs = useRef<(View | null)[]>([]);
  const webSlideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Generate slides based on skill
  const slides: SlideContent[] = React.useMemo(() => {
    if (skillName === 'mark-rounding-execution' && !skillMarkdown) {
      return generateMarkRoundingSlides();
    }
    if (skillMarkdown) {
      const parsed = parseSkillMarkdown(skillMarkdown);
      return skillToInstagramSlides(parsed);
    }
    return generateMarkRoundingSlides();
  }, [skillName, skillMarkdown]);

  const handleSlideChange = useCallback((index: number) => {
    setCurrentSlideIndex(index);
  }, []);

  const showMissingNativeExportTools = useCallback(async () => {
    const quickCaption = `BetterAt carousel: ${skillName}\n\nSlides: ${slides.length}\n#Sailing #BetterAt`;
    showAlertWithButtons(
      'Export Tools Missing',
      'Image export is not available in this build. You can copy a caption template or contact support for setup help.',
      [
        { text: 'Close', style: 'cancel' },
        {
          text: 'Copy Caption',
          onPress: async () => {
            await Clipboard.setStringAsync(quickCaption);
            showAlert('Copied', 'Caption template copied to clipboard.');
          },
        },
        {
          text: 'Contact Support',
          onPress: () =>
            Linking.openURL(
              'mailto:info@better.at?subject=Instagram%20Export%20Setup&body=Please%20help%20me%20enable%20Instagram%20image%20export%20on%20my%20build.'
            ),
        },
      ]
    );
  }, [skillName, slides.length]);

  // Web export using html2canvas + JSZip (single ZIP download)
  const exportAllSlidesWeb = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    try {
      // Dynamically import libraries
      const [html2canvasModule, JSZipModule, fileSaverModule] = await Promise.all([
        import('html2canvas'),
        import('jszip'),
        import('file-saver'),
      ]);
      
      const html2canvas = html2canvasModule.default;
      const JSZip = JSZipModule.default;
      const { saveAs } = fileSaverModule;
      
      setIsExporting(true);
      setExportProgress(0);

      const zip = new JSZip();
      const totalSlides = slides.length;
      const capturedCount: string[] = [];

      // First, capture all slides
      for (let i = 0; i < totalSlides; i++) {
        setExportProgress(((i + 0.5) / totalSlides) * 80); // 0-80% for capturing

        const element = webSlideRefs.current[i];
        if (!element) {
          console.warn(`Slide ${i + 1} ref not found`);
          continue;
        }

        try {
          // Capture the element at full resolution
          const canvas = await html2canvas(element, {
            scale: 1, // Already at 1080px
            useCORS: true,
            backgroundColor: '#0F172A',
            logging: false,
          });

          // Convert to blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), 'image/png', 1);
          });

          // Add to ZIP with numbered filename for correct ordering
          const filename = `${String(i + 1).padStart(2, '0')}-mark-rounding.png`;
          zip.file(filename, blob);
          capturedCount.push(filename);

          // Brief pause to prevent UI freeze
          await new Promise(r => setTimeout(r, 100));
        } catch (err) {
          console.error(`Failed to capture slide ${i + 1}:`, err);
        }
      }

      if (capturedCount.length === 0) {
        throw new Error('No slides were captured');
      }

      // Generate ZIP file
      setExportProgress(90);
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // Download the ZIP
      setExportProgress(100);
      saveAs(zipBlob, 'betterat-mark-rounding-carousel.zip');

      setIsExporting(false);

      showAlert(
        'Export Complete!',
        `${capturedCount.length} slides saved to ZIP!\n\n1. Unzip the downloaded file\n2. Upload all images to Instagram in order (01, 02, 03...)\n3. Add your captions and hashtags`
      );
    } catch (error) {
      console.error('Export error:', error);
      setIsExporting(false);
      showAlert('Export Failed', 'Unable to export images. Please try again.');
    }
  }, [slides]);

  // Native export using react-native-view-shot
  const exportAllSlidesNative = useCallback(async () => {
    if (!captureRef || !MediaLibrary) {
      await showMissingNativeExportTools();
      return;
    }

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'Please grant access to save images to your camera roll.'
        );
        return;
      }

      setIsExporting(true);
      setExportProgress(0);

      const savedUris: string[] = [];
      const totalSlides = slides.length;

      for (let i = 0; i < totalSlides; i++) {
        setExportProgress((i / totalSlides) * 100);

        const ref = slideRefs.current[i];
        if (!ref) continue;

        try {
          const uri = await captureRef(ref, {
            format: 'png',
            quality: 1,
            width: 1080,
            height: selectedAspect === 'square' ? 1080 : 1350,
          });

          const asset = await MediaLibrary.createAssetAsync(uri);
          savedUris.push(asset.uri);
          
          if (i === 0) {
            const album = await MediaLibrary.getAlbumAsync('BetterAt');
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            } else {
              await MediaLibrary.createAlbumAsync('BetterAt', asset, false);
            }
          } else {
            const album = await MediaLibrary.getAlbumAsync('BetterAt');
            if (album) {
              await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
            }
          }
        } catch (err) {
          console.warn(`Failed to capture slide ${i + 1}:`, err);
        }
      }

      setExportProgress(100);
      setIsExporting(false);

      showAlert(
        'Export Complete!',
        `${savedUris.length} slides saved to your camera roll in the "BetterAt" album.\n\nOpen Instagram → New Post → Select all ${savedUris.length} images as a carousel.`
      );
    } catch (error) {
      console.error('Export error:', error);
      setIsExporting(false);
      showAlert('Export Failed', 'Unable to save images. Please try again.');
    }
  }, [selectedAspect, showMissingNativeExportTools, slides]);

  // Main export function
  const exportAllSlides = useCallback(async () => {
    if (Platform.OS === 'web') {
      await exportAllSlidesWeb();
    } else {
      await exportAllSlidesNative();
    }
  }, [exportAllSlidesWeb, exportAllSlidesNative]);

  // Single slide export
  const exportSingleSlide = useCallback(async (index: number) => {
    if (Platform.OS === 'web') {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const element = webSlideRefs.current[index];
        if (!element) return;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#0F172A',
        });

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png', 1);
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `betterat-slide-${index + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Share error:', error);
        showAlert('Export Failed', 'Unable to export this slide.');
      }
    } else if (captureRef && Sharing) {
      try {
        const ref = slideRefs.current[index];
        if (!ref) return;

        const uri = await captureRef(ref, {
          format: 'png',
          quality: 1,
          width: 1080,
          height: selectedAspect === 'square' ? 1080 : 1350,
        });

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Share Slide ${index + 1}`,
          });
        } else if (MediaLibrary) {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            await MediaLibrary.createAssetAsync(uri);
            showAlert('Saved!', 'Slide saved to camera roll.');
          }
        }
      } catch (error) {
        console.error('Share error:', error);
        showAlert('Share Failed', 'Unable to share this slide.');
      }
    } else {
      await showMissingNativeExportTools();
    }
  }, [selectedAspect, showMissingNativeExportTools]);

  const renderThemeSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Theme</Text>
      <View style={styles.selectorRow}>
        {THEMES.map((theme) => (
          <TouchableOpacity
            key={theme.id}
            style={[
              styles.themeOption,
              selectedTheme === theme.id && styles.themeOptionSelected,
            ]}
            onPress={() => setSelectedTheme(theme.id)}
          >
            <LinearGradient
              colors={theme.colors as [string, string, ...string[]]}
              style={styles.themePreview}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.themeLabel}>{theme.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAspectSelector = () => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Aspect Ratio</Text>
      <View style={styles.selectorRow}>
        {ASPECTS.map((aspect) => (
          <TouchableOpacity
            key={aspect.id}
            style={[
              styles.aspectOption,
              selectedAspect === aspect.id && styles.aspectOptionSelected,
            ]}
            onPress={() => setSelectedAspect(aspect.id)}
          >
            <View
              style={[
                styles.aspectPreview,
                aspect.id === 'square'
                  ? styles.aspectSquare
                  : styles.aspectPortrait,
              ]}
            />
            <Text style={styles.aspectLabel}>{aspect.ratio}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderSlideIndicators = () => (
    <View style={styles.indicators}>
      {slides.map((_, idx) => (
        <TouchableOpacity
          key={idx}
          style={[
            styles.indicator,
            idx === currentSlideIndex && styles.indicatorActive,
          ]}
          onPress={() => handleSlideChange(idx)}
        />
      ))}
    </View>
  );

  // Render slide preview (scaled)
  const renderSlidePreview = (slide: SlideContent, idx: number) => {
    return (
      <View 
        key={idx} 
        style={styles.slideWrapper}
        ref={Platform.OS !== 'web' ? (ref) => { slideRefs.current[idx] = ref; } : undefined}
      >
        <InstagramSlide
          slide={slide}
          slideNumber={idx + 1}
          totalSlides={slides.length}
          aspectRatio={selectedAspect}
          theme={selectedTheme}
          exportMode={false}
        />
      </View>
    );
  };

  // Render hidden full-size slides for export (web only)
  const renderHiddenExportSlides = () => {
    if (Platform.OS !== 'web') return null;
    
    const slideHeight = selectedAspect === 'square' ? 1080 : 1350;
    
    return (
      <div style={{ 
        position: 'absolute', 
        left: '-9999px', 
        top: 0,
        pointerEvents: 'none' as const,
      }}>
        {slides.map((slide, idx) => (
          <div
            key={`export-${idx}`}
            ref={(ref) => { webSlideRefs.current[idx] = ref; }}
            style={{ 
              width: 1080, 
              height: slideHeight,
              overflow: 'hidden',
              marginBottom: 20,
              background: '#0F172A',
            }}
          >
            <InstagramSlide
              slide={slide}
              slideNumber={idx + 1}
              totalSlides={slides.length}
              aspectRatio={selectedAspect}
              theme={selectedTheme}
              exportMode={true}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Hidden full-size slides for web export */}
        {renderHiddenExportSlides()}
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#F8FAFC" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="instagram" size={24} color="#E4405F" />
            <Text style={styles.headerTitle}>Export for Instagram</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Preview */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>
              Preview ({currentSlideIndex + 1}/{slides.length})
            </Text>
            
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const screenWidth = Dimensions.get('window').width;
                const index = Math.round(e.nativeEvent.contentOffset.x / (screenWidth * 0.9));
                handleSlideChange(index);
              }}
              style={styles.carouselScroll}
              contentContainerStyle={styles.carouselContent}
            >
              {slides.map((slide, idx) => renderSlidePreview(slide, idx))}
            </ScrollView>
            
            {renderSlideIndicators()}
          </View>

          {/* Options */}
          <View style={styles.optionsSection}>
            {renderThemeSelector()}
            {renderAspectSelector()}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsSection}>
            <Text style={styles.sectionTitle}>How to Post</Text>
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                {Platform.OS === 'web' 
                  ? 'Tap "Export" to download ZIP file'
                  : 'Tap "Export All Slides" to save to camera roll'}
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                {Platform.OS === 'web' 
                  ? 'Unzip the file to see all slides (numbered in order)'
                  : 'Open Instagram → New Post → Select Multiple'}
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Instagram → New Post → Select all {slides.length} images in order
              </Text>
            </View>
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>
                Add captions: #sailing #regatta #markrounding
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Export Actions */}
        <View style={styles.actionsContainer}>
          {isExporting ? (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color="#3B82F6" />
              <Text style={styles.progressText}>
                Exporting... {Math.round(exportProgress)}%
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: `${exportProgress}%` }]} 
                />
              </View>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.exportSingleButton}
                onPress={() => exportSingleSlide(currentSlideIndex)}
              >
                <MaterialCommunityIcons name="share-variant" size={20} color="#3B82F6" />
                <Text style={styles.exportSingleText}>
                  {Platform.OS === 'web' ? 'Download Current' : 'Share Current'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.exportAllButton}
                onPress={exportAllSlides}
              >
                <LinearGradient
                  colors={['#E4405F', '#F77737']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <MaterialCommunityIcons 
                  name={Platform.OS === 'web' ? 'folder-download' : 'download'} 
                  size={24} 
                  color="white" 
                />
                <Text style={styles.exportAllText}>
                  {Platform.OS === 'web' 
                    ? `Download ZIP (${slides.length} Slides)` 
                    : `Export All ${slides.length} Slides`}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : Platform.OS === 'web' ? 16 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  content: {
    flex: 1,
  },
  previewSection: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    paddingHorizontal: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  carouselScroll: {
    flexGrow: 0,
  },
  carouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  slideWrapper: {
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  indicatorActive: {
    backgroundColor: '#3B82F6',
    width: 24,
  },
  optionsSection: {
    padding: 16,
    gap: 20,
  },
  selectorContainer: {
    gap: 12,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeOptionSelected: {
    borderColor: '#3B82F6',
  },
  themePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginBottom: 8,
  },
  themeLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  aspectOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  aspectOptionSelected: {
    borderColor: '#3B82F6',
  },
  aspectPreview: {
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    marginBottom: 8,
  },
  aspectSquare: {
    width: 40,
    height: 40,
  },
  aspectPortrait: {
    width: 32,
    height: 40,
  },
  aspectLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  instructionsSection: {
    padding: 16,
    gap: 12,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#93C5FD',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  actionsContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  progressContainer: {
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  exportSingleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  exportSingleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  exportAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  exportAllText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
});

export default InstagramExporter;
