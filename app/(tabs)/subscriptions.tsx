import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SubscriptionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Subscriptions</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});
