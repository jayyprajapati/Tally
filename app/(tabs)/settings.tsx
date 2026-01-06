import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CredentialReveal from '@/components/credential-reveal';
import {
    BUILT_IN_CREDENTIAL_IDS,
    Credential,
    CredentialType,
    deleteCredential,
    getAllCredentials,
    maskCredentialValue,
    upsertCredential,
} from '@/lib/db/credentials';

type CredentialRow = {
  id: string;
  label: string;
  type: CredentialType;
};

type EditingState = {
  id: string;
  label: string;
  type: CredentialType;
  value: string;
  isNew?: boolean;
};

const builtInRows: CredentialRow[] = [
  { id: BUILT_IN_CREDENTIAL_IDS.personalEmail, label: 'Personal Email', type: 'personalEmail' },
  { id: BUILT_IN_CREDENTIAL_IDS.workEmail, label: 'Work Email', type: 'workEmail' },
  { id: BUILT_IN_CREDENTIAL_IDS.mobileNumber, label: 'Mobile Number', type: 'mobileNumber' },
];

export default function SettingsScreen() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputLabel, setInputLabel] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const loadCredentials = useCallback(async () => {
    const list = await getAllCredentials();
    setCredentials(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCredentials();
    }, [loadCredentials]),
  );

  const customCredentials = useMemo(
    () => credentials.filter((cred) => cred.type === 'custom'),
    [credentials],
  );

  const rows: CredentialRow[] = useMemo(
    () => [...builtInRows, ...customCredentials.map((cred) => ({ id: cred.id, label: cred.label, type: cred.type }))],
    [customCredentials],
  );

  const openModal = (row: CredentialRow) => {
    const existing = credentials.find((cred) => cred.id === row.id);
    setEditing({
      id: row.id,
      label: row.label,
      type: row.type,
      value: existing?.value ?? '',
      isNew: !existing && row.type === 'custom',
    });
    setInputLabel(row.type === 'custom' ? existing?.label ?? row.label ?? '' : row.label);
    setInputValue(existing?.value ?? '');
    setModalVisible(true);
  };

  const handleAddCustom = () => {
    const newId = `custom-${Date.now()}`;
    const newRow: CredentialRow = { id: newId, label: 'Custom Credential', type: 'custom' };
    openModal(newRow);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditing(null);
    setInputValue('');
    setInputLabel('');
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!inputValue.trim()) {
      Alert.alert('Value required', 'Please enter a value for this credential.');
      return;
    }

    const resolvedLabel = editing.type === 'custom' ? inputLabel.trim() || 'Custom Credential' : editing.label;

    await upsertCredential({
      id: editing.id,
      type: editing.type,
      label: resolvedLabel,
      value: inputValue.trim(),
    });

    await loadCredentials();
    closeModal();
  };

  const handleDelete = async () => {
    if (!editing || editing.type !== 'custom') return;
    await deleteCredential(editing.id);
    await loadCredentials();
    closeModal();
  };

  const renderRow = ({ item }: { item: CredentialRow }) => {
    const saved = credentials.find((cred) => cred.id === item.id);
    const masked = saved ? maskCredentialValue(saved) : 'Not added';
    const value = saved?.value;
    const displayLabel = item.type === 'custom' ? saved?.label ?? item.label : item.label;

    return (
      <View style={styles.row}>
        <View style={styles.labelBlock}>
          <Text style={styles.rowLabel}>{displayLabel}</Text>
        </View>
        <View style={styles.valueBlock}>
          <CredentialReveal value={value} maskedValue={masked} textStyle={styles.rowValue} disabled={!value} />
        </View>
        <Pressable style={styles.iconButton} onPress={() => openModal({ ...item, label: displayLabel })}>
          <Ionicons name="pencil" size={18} color="#111827" />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linked Accounts</Text>
        <FlatList
          data={rows}
          renderItem={renderRow}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={<View style={{ height: 12 }} />}
        />
        <Pressable style={styles.addButton} onPress={handleAddCustom}>
          <Ionicons name="add" size={18} color="#111827" />
          <Text style={styles.addButtonText}>Add custom credential</Text>
        </Pressable>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing?.label ?? 'Credential'}</Text>
            {editing?.type === 'custom' ? (
              <View style={styles.modalGroup}>
                <Text style={styles.modalLabel}>Label</Text>
                <TextInput
                  value={inputLabel}
                  onChangeText={setInputLabel}
                  placeholder="e.g. Bank Login"
                  placeholderTextColor="#6b7280"
                  style={styles.modalInput}
                />
              </View>
            ) : null}

            <View style={styles.modalGroup}>
              <Text style={styles.modalLabel}>
                {editing?.type === 'mobileNumber' ? 'Mobile Number' : 'Value'}
              </Text>
              <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={editing?.type === 'mobileNumber' ? 'e.g. +1 555 123 4567' : 'Enter value'}
                placeholderTextColor="#6b7280"
                keyboardType={editing?.type === 'mobileNumber' ? 'phone-pad' : 'default'}
                autoCapitalize={editing?.type === 'mobileNumber' ? 'none' : 'none'}
                style={styles.modalInput}
              />
            </View>

            <View style={styles.modalActions}>
              {editing?.type === 'custom' && !editing.isNew ? (
                <Pressable style={[styles.modalButton, styles.deleteButton]} onPress={handleDelete}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              ) : null}
              <View style={styles.actionsRight}>
                <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.modalButton, styles.saveButton]} onPress={handleSave}>
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
    color: '#0f172a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  labelBlock: {
    flex: 1,
  },
  valueBlock: {
    flex: 2,
    alignItems: 'flex-start',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  rowValue: {
    color: '#111827',
    fontSize: 14,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  addButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalGroup: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelText: {
    color: '#111827',
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#111827',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
});
