import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CredentialReveal from '@/components/credential-reveal';
import { Credential, deleteCredential, getAllCredentials, maskCredentialValue, upsertCredential } from '@/lib/db/credentials';
import { colors, spacing, typography } from '@/theme';

type EditingCard = {
  id: string;
  label: string;
  value: string;
  isNew?: boolean;
};

export default function LinkedCardsScreen() {
  const [cards, setCards] = useState<Credential[]>([]);
  const [editing, setEditing] = useState<EditingCard | null>(null);
  const [name, setName] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const loadCards = useCallback(async () => {
    const list = await getAllCredentials();
    setCards(list.filter((cred) => cred.type === 'card'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCards();
    }, [loadCards]),
  );

  const rows = useMemo(() => cards.sort((a, b) => a.label.localeCompare(b.label)), [cards]);

  const openModal = (card?: Credential) => {
    if (card) {
      setEditing({ id: card.id, label: card.label, value: card.value, isNew: false });
      setName(card.label);
      setLastFour(card.value);
    } else {
      const newId = `card-${Date.now()}`;
      setEditing({ id: newId, label: '', value: '', isNew: true });
      setName('');
      setLastFour('');
    }
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditing(null);
    setName('');
    setLastFour('');
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter a card name.');
      return;
    }

    const digits = lastFour.replace(/\D/g, '').slice(-4);
    if (digits.length !== 4) {
      Alert.alert('Last 4 digits required', 'Enter the last 4 digits only.');
      return;
    }

    await upsertCredential({
      id: editing.id,
      type: 'card',
      label: name.trim(),
      value: digits,
    });

    await loadCards();
    closeModal();
  };

  const handleDelete = async () => {
    if (!editing || editing.isNew) return;
    await deleteCredential(editing.id);
    await loadCards();
    closeModal();
  };

  const renderItem = ({ item }: { item: Credential }) => {
    return (
      <View style={styles.row}>
        <View style={styles.labelBlock}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.rowSub}>{maskCredentialValue(item)}</Text>
        </View>
        <CredentialReveal value={item.value} maskedValue={maskCredentialValue(item)} textStyle={styles.rowValue} />
        <Pressable style={styles.iconButton} onPress={() => openModal(item)}>
          <Ionicons name="pencil" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Linked Cards</Text>
        <View style={styles.section}>
          {rows.length ? (
            <FlatList
              data={rows}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          ) : (
            <Text style={styles.empty}>No cards saved yet.</Text>
          )}
          <Pressable style={styles.addButton} onPress={() => openModal()}>
            <Ionicons name="add" size={18} color={colors.textPrimary} />
            <Text style={styles.addButtonText}>Add card</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing?.isNew ? 'Add Card' : 'Edit Card'}</Text>
            <View style={styles.modalGroup}>
              <Text style={styles.modalLabel}>Card name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Personal Visa"
                placeholderTextColor={colors.textMuted}
                style={styles.modalInput}
              />
            </View>
            <View style={styles.modalGroup}>
              <Text style={styles.modalLabel}>Last 4 digits</Text>
              <TextInput
                value={lastFour}
                onChangeText={setLastFour}
                placeholder="1234"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.modalInput}
              />
            </View>
            <View style={styles.modalActions}>
              {!editing?.isNew ? (
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
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowSub: {
    ...typography.caption,
    color: colors.textMuted,
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
    marginLeft: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  addButton: {
    marginTop: spacing.xs,
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
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginVertical: spacing.sm,
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
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.sectionTitle,
    fontWeight: '800',
  },
  modalGroup: {
    gap: spacing.sm,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textMuted,
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
