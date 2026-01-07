import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { colors, spacing, typography } from '@/theme';

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

export default function LinkedAccountsScreen() {
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
          <Ionicons name="pencil" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Linked Accounts</Text>
        <View style={styles.section}>
          <FlatList
            data={rows}
            renderItem={renderRow}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListFooterComponent={<View style={{ height: spacing.md }} />}
          />
          <Pressable style={styles.addButton} onPress={handleAddCustom}>
            <Ionicons name="add" size={18} color={colors.textPrimary} />
            <Text style={styles.addButtonText}>Add custom credential</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{editing?.label ?? 'Credential'}</Text>
            {editing?.type === 'custom' ? (
              <View style={styles.modalGroup}>
                <Text style={styles.modalLabel}>Label</Text>
                <TextInput
                  value={inputLabel}
                  onChangeText={setInputLabel}
                  placeholder="e.g. Bank Login"
                  placeholderTextColor={colors.textMuted}
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
                placeholderTextColor={colors.textMuted}
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
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.pageTitle,
    marginBottom: spacing.xs,
    color: colors.textPrimary,
  },
  section: {
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
    color: colors.textPrimary,
  },
  rowValue: {
    color: colors.textPrimary,
    fontSize: typography.body.fontSize,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    marginLeft: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  addButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalTitle: {
    ...typography.sectionTitle,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  modalGroup: {
    marginBottom: spacing.md,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    backgroundColor: colors.backgroundPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionsRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  cancelText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.textPrimary,
  },
  saveText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  deleteText: {
    color: colors.accentPrimary,
    fontWeight: '700',
  },
});
