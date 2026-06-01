import SvgIcon from "@/components/svgIcon";
import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, ExternalLink, FileText, Search, X } from 'lucide-react-native';
import React, { useEffect, useState } from "react";
import { Alert, Dimensions, Keyboard, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';


// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function Notes() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const { exam } = useExam();
  const [files, setFiles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

  useEffect(() => {
    const loadResourcesAndFiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('file_resource_exams')
        .select(`
              *,
              file_resources (*)
            `)
        .eq('exam_id', exam.id);

      if (error) {
        console.error('Failed to load resources and files:', error);
        setLoading(false);
        return;
      }

      setFiles(data.map((d: any) => d.file_resources));
      setLoading(false);
    };

    loadResourcesAndFiles();
  }, [exam]);

  function getFileExtension(fileName: string): string | null {
    const parts = fileName.split('.');
    if (parts.length > 1 && parts[parts.length - 1]) {
      return parts.pop()?.toLowerCase() || null;
    }
    return null;
  }

  const handleOpenLink = (file: any) => {
    let url = '';
    if (file.resource_type === 'file') {
      url = `https://nufmkzmukwplugqvtiie.supabase.co/storage/v1/object/public/notes/${file.file_name}`;
    } else {
      url = file.file_url;
    }

    // Close modal if open
    setSelectedNote(null);

    const isPdf = file.resource_type === 'file' && file.file_name && getFileExtension(file.file_name) === 'pdf';

    if (isPdf) {
      router.push({
        pathname: '/pdf-viewer',
        params: { url, title: file.title, fileName: file.file_name }
      });
    } else {
      Alert.alert(
        'Open external link?',
        'You are about to open an external link. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open', onPress: () => Linking.openURL(url) }
        ]
      );
    }
  };


  const filteredFiles = files.filter(file =>
    file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Notes</Text>
          <Text style={styles.subtitle}>Your Study Materials</Text>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={colors.subText} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            placeholderTextColor={colors.subText}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}>
              <X size={20} color={colors.subText} />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <SpinnerAnimation color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 90, paddingHorizontal: 20 }}>
            {filteredFiles.length > 0 ? (
              filteredFiles.map((file: any) => (
                <TouchableOpacity
                  key={file.id}
                  onPress={() => setSelectedNote(file)}
                  activeOpacity={0.7}
                >
                  <View style={styles.noteCard}>
                    <View style={styles.iconContainer}>
                      {file.resource_type === "file" ? (
                        // If SvgIcon handles extensions well, keep it, otherwise fallback
                        <SvgIcon width={vs(40)} height={vs(40)} iconName={getFileExtension(file.file_name) || 'unknown'} />
                      ) : file.resource_type === "youtube_link" ? (
                        <SvgIcon width={vs(40)} height={vs(40)} iconName='yt' />
                      ) : (
                        <FileText size={32} color={colors.primary} />
                      )}
                    </View>

                    <View style={styles.noteTextContainer}>
                      <Text style={styles.noteTitle} numberOfLines={1}>{file.title}</Text>
                      <Text style={styles.noteDescription} numberOfLines={2}>{file.description}</Text>
                      <View style={styles.metaContainer}>
                        <Text style={styles.metaText}>
                          {file.resource_type === 'youtube_link' ? 'Video Resource' : `${getFileExtension(file.file_name)?.toUpperCase() || 'FILE'}`}
                        </Text>
                      </View>
                    </View>

                    <ChevronRight size={20} color={colors.subText} style={{ opacity: 0.5 }} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <FileText size={64} color={colors.subText} style={{ opacity: 0.5, marginBottom: 16 }} />
                <Text style={styles.emptyStateTitle}>No notes found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery ? "Try a different search term" : "Check back later for new materials"}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Detail Modal */}
        <Modal
          visible={!!selectedNote}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedNote(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => setSelectedNote(null)}>
              <View style={styles.modalBackdrop} />
            </TouchableWithoutFeedback>

            {selectedNote && (
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconContainer}>
                    {selectedNote.resource_type === "file" ? (
                      <SvgIcon width={vs(50)} height={vs(50)} iconName={getFileExtension(selectedNote.file_name) || 'unknown'} />
                    ) : selectedNote.resource_type === "youtube_link" ? (
                      <SvgIcon width={vs(50)} height={vs(50)} iconName='yt' />
                    ) : (
                      <FileText size={40} color={colors.primary} />
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setSelectedNote(null)} style={styles.closeButton}>
                    <X size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <Text style={styles.modalTitle}>{selectedNote.title}</Text>
                  <View style={styles.modalMetaRow}>
                    <View style={styles.metaContainer}>
                      <Text style={styles.metaText}>
                        {selectedNote.resource_type === 'youtube_link' ? 'Video Resource' : `${getFileExtension(selectedNote.file_name)?.toUpperCase() || 'FILE'}`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.modalDescription}>{selectedNote.description}</Text>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.openButton}
                    onPress={() => handleOpenLink(selectedNote)}
                  >
                    <LinearGradient
                      colors={[colors.primary, '#8A2BE2']}
                      style={styles.gradientButton}
                    >
                      <Text style={styles.openButtonText}>Open Resource</Text>
                      <ExternalLink size={20} color="#FFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Modal>

      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subText,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  noteCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: colors.background, // Subtle contrast
    borderRadius: 10,
  },
  noteTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  noteTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  noteDescription: {
    fontSize: 14,
    color: colors.subText,
    marginBottom: 6,
    lineHeight: 20,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    backgroundColor: colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(80),
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: colors.subText,
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
  },
  closeButton: {
    padding: 8,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
  },
  modalBody: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 28,
  },
  modalMetaRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 16,
    color: colors.subText,
    lineHeight: 24,
  },
  modalFooter: {
    marginTop: 'auto',
  },
  openButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  openButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

function SpinnerAnimation({ color = '#8A2BE2' }: { color?: string }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={[{ width: 64, height: 64, marginBottom: 16 }, animatedStyle]}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle
          cx={32}
          cy={32}
          r={28}
          stroke={color}
          strokeWidth={6}
          strokeDasharray={"44 88"}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}