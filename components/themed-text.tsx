import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography } from '@/theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  return (
    <Text
      style={[
        { color: colors.textPrimary },
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    ...typography.body,
    lineHeight: typography.body.lineHeight,
  },
  defaultSemiBold: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: typography.body.lineHeight,
  },
  title: {
    ...typography.pageTitle,
    lineHeight: typography.pageTitle.lineHeight,
  },
  subtitle: {
    ...typography.sectionTitle,
    fontWeight: '700',
  },
  link: {
    ...typography.body,
    lineHeight: typography.body.lineHeight,
    color: colors.accentPrimary,
  },
});
