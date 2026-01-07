import { View, type ViewProps } from 'react-native';

import { colors } from '@/theme';

export type ThemedViewProps = ViewProps;

export function ThemedView({ style, ...otherProps }: ThemedViewProps) {
  return <View style={[{ backgroundColor: colors.backgroundPrimary }, style]} {...otherProps} />;
}
