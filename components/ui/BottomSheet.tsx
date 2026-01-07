/**
 * Shared BottomSheet component.
 * Single implementation for all overlay/modal needs.
 * - Slides from bottom
 * - Dimmed backdrop
 * - Drag down to dismiss
 * - iOS-style interaction
 */

import React, { useCallback, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 100;

interface BottomSheetProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: BottomSheetProps) {
    const translateY = useRef(new Animated.Value(0)).current;

    const resetPosition = useCallback(() => {
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 10,
        }).start();
    }, [translateY]);

    const dismiss = useCallback(() => {
        Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            translateY.setValue(0);
            onClose();
        });
    }, [onClose, translateY]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 10;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.5) {
                    dismiss();
                } else {
                    resetPosition();
                }
            },
        }),
    ).current;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <Pressable style={styles.backdropPressable} onPress={onClose} />
                <Animated.View
                    style={[styles.sheet, { transform: [{ translateY }] }]}
                    {...panResponder.panHandlers}
                >
                    <View style={styles.handle} />
                    {title ? (
                        <Text variant="sectionTitle" style={styles.title}>
                            {title}
                        </Text>
                    ) : null}
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        {children}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: colors.modalBackdrop,
        justifyContent: 'flex-end',
    },
    backdropPressable: {
        flex: 1,
    },
    sheet: {
        backgroundColor: colors.backgroundPrimary,
        borderTopLeftRadius: spacing.lg,
        borderTopRightRadius: spacing.lg,
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        maxHeight: SCREEN_HEIGHT * 0.85,
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: colors.borderSubtle,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    content: {
        flexGrow: 0,
    },
    contentContainer: {
        paddingBottom: spacing.md,
    },
});

export default BottomSheet;
