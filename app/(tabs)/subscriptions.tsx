import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    Subscription,
    addSubscription,
    deleteSubscription,
    getAllSubscriptions,
} from '@/lib/db/subscriptions';

const buildSampleSubscription = (): Subscription => ({
  id: Date.now().toString(),
  name: 'Sample Subscription',
  category: 'General',
  billingType: 'monthly',
  amount: 9.99,
  startDate: new Date().toISOString(),
  status: 'active',
  notes: 'Tap delete to remove',
});

export default function SubscriptionsScreen() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllSubscriptions();
      setItems(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleAdd = async () => {
    await addSubscription(buildSampleSubscription());
    await loadSubscriptions();
  };

  const handleDelete = async (id: string | number) => {
    await deleteSubscription(id);
    await loadSubscriptions();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {loading && <Text style={styles.message}>Loading…</Text>}
        {!loading && items.length === 0 && (
          <Text style={styles.message}>No subscriptions yet.</Text>
        )}
        {!loading &&
          items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.category} · {item.billingType} · ${item.amount.toFixed(2)}
              </Text>
              <Text style={styles.meta}>Status: {item.status}</Text>
              <Pressable style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          ))}
      </ScrollView>

      <View style={styles.fabWrapper}>
        <Pressable style={styles.fab} onPress={handleAdd}>
          <Text style={styles.fabIcon}>＋</Text>
          <Text style={styles.fabLabel}>Add subscription</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  list: {
    gap: 12,
    paddingVertical: 12,
    paddingBottom: 160,
  },
  message: {
    textAlign: 'center',
    color: '#444',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    gap: 6,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
    color: '#555',
  },
  deleteButton: {
    marginTop: 6,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#f3f3f3',
  },
  deleteText: {
    color: '#b00020',
    fontWeight: '600',
  },
  fabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#111',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  fabLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
