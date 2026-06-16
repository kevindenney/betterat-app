import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DocumentStorageService } from '@/services/storage/DocumentStorageService';

interface ResourceUploadComposerProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (params: { documentId: string; tags: string[]; notifyFollowers: boolean }) => Promise<void>;
  fleetName?: string;
  userId: string;
}

export function ResourceUploadComposer({ visible, onClose, onSubmit, fleetName, userId }: ResourceUploadComposerProps) {
  const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(null);
  const [tags, setTags] = useState('');
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const documentService = new DocumentStorageService();

  const handlePickDocument = async () => {
    setUploadProgress('Selecting document...');
    try {
      const result = await documentService.pickAndUploadDocument(userId);

      if (result.success && result.document) {
        setSelectedFile({
          id: result.document.id,
          name: result.document.filename,
        });
        setUploadProgress('Document uploaded successfully');
      } else {
        setUploadProgress(result.error || 'Upload failed');
        setTimeout(() => setUploadProgress(''), 3000);
      }
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setUploadProgress(err.message || 'Upload failed');
      setTimeout(() => setUploadProgress(''), 3000);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
      const tagArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await onSubmit({
        documentId: selectedFile.id,
        tags: tagArray,
        notifyFollowers,
      });

      // Reset form
      setSelectedFile(null);
      setTags('');
      setNotifyFollowers(true);
      setUploadProgress('');
      onClose();
    } catch (err) {
      console.error('Error submitting resource:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setTags('');
    setNotifyFollowers(true);
    setUploadProgress('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#64748B" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Upload Resource</Text>
            {fleetName && <Text style={styles.headerSubtitle}>{fleetName}</Text>}
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!selectedFile || loading}
            style={[styles.submitButton, (!selectedFile || loading) && styles.submitButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* File Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Document</Text>

            {!selectedFile ? (
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={32} color="#007AFF" />
                <Text style={styles.uploadButtonTitle}>Choose File</Text>
                <Text style={styles.uploadButtonSubtitle}>PDF, images, or sailing documents</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.selectedFileCard}>
                <MaterialCommunityIcons name="file-document-outline" size={40} color="#007AFF" />
                <View style={styles.selectedFileInfo}>
                  <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
                  <Text style={styles.selectedFileStatus}>Ready to share</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedFile(null)}>
                  <MaterialCommunityIcons name="close-circle" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}

            {uploadProgress && (
              <View style={styles.progressBar}>
                <Text style={styles.progressText}>{uploadProgress}</Text>
              </View>
            )}
          </View>

          {/* Tags */}
          {selectedFile && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Tags (optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="tuning, heavy air, setup (comma separated)"
                placeholderTextColor="#94A3B8"
                value={tags}
                onChangeText={setTags}
              />
              <Text style={styles.helperText}>
                Add tags to help fleet members find this resource
              </Text>
            </View>
          )}

          {/* Notification Toggle */}
          {selectedFile && (
            <View style={styles.optionCard}>
              <View style={styles.optionContent}>
                <MaterialCommunityIcons
                  name="bell-ring-outline"
                  size={22}
                  color={notifyFollowers ? '#007AFF' : '#64748B'}
                />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>Notify fleet followers</Text>
                  <Text style={styles.optionDescription}>
                    Send notification to members following this fleet
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setNotifyFollowers(!notifyFollowers)}
                style={styles.checkbox}
              >
                <MaterialCommunityIcons
                  name={notifyFollowers ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                  color={notifyFollowers ? '#007AFF' : '#94A3B8'}
                />
              </TouchableOpacity>
            </View>
          )}

          {/* Info Box */}
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information-outline" size={18} color="#0891B2" />
            <Text style={styles.infoText}>
              Uploaded documents will be available to all fleet members. Supported formats: PDF, JPG, PNG.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  uploadButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  uploadButtonTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 12,
  },
  uploadButtonSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  selectedFileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  selectedFileInfo: {
    flex: 1,
  },
  selectedFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  selectedFileStatus: {
    fontSize: 13,
    color: '#059669',
    marginTop: 2,
  },
  progressBar: {
    backgroundColor: '#E0E7FF',
    padding: 12,
    borderRadius: 8,
  },
  progressText: {
    fontSize: 13,
    color: '#3730A3',
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  helperText: {
    fontSize: 13,
    color: '#64748B',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  optionDescription: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  checkbox: {
    padding: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ECFEFF',
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0891B2',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#0E7490',
    lineHeight: 18,
  },
});
