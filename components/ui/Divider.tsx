/**
 * Minimal horizontal divider used between list items.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    alignSelf: 'stretch',
  },
});

export default Divider;
