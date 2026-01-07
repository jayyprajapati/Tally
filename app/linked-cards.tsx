import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CredentialReveal from '@/components/credential-reveal';
import { Credential, deleteCredential, getAllCredentials, maskCredentialValue, upsertCredential } from '@/lib/db/credentials';

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
          <Ionicons name="pencil" size={18} color="#111827" />
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
            <Ionicons name="add" size={18} color="#111827" />
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
                placeholderTextColor="#6b7280"
                style={styles.modalInput}
              />
            </View>
            <View style={styles.modalGroup}>
              <Text style={styles.modalLabel}>Last 4 digits</Text>
              <TextInput
                value={lastFour}
                onChangeText={setLastFour}
                placeholder="1234"
                placeholderTextColor="#6b7280"
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
    backgroundColor: '#f8f8f8',
  },
  scroll: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    color: '#0f172a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  labelBlock: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  rowSub: {
    fontSize: 13,
    color: '#6b7280',
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
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  addButton: {
    marginTop: 4,
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
  empty: {
    textAlign: 'center',
    color: '#6b7280',
    marginVertical: 8,
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
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalGroup: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 13,
    color: '#6b7280',
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
