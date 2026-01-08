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
    const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const animateTo = useCallback(
        (value: number, callback?: () => void) => {
            Animated.timing(translateY, {
                toValue: value,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                if (callback) callback();
            });
        },
        [translateY],
    );

    const handleClose = useCallback(() => {
        animateTo(SCREEN_HEIGHT, () => {
            translateY.setValue(SCREEN_HEIGHT);
            onClose();
        });
    }, [animateTo, onClose, translateY]);

    const resetPosition = useCallback(() => {
        animateTo(0);
    }, [animateTo]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 6,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    translateY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.65) {
                    handleClose();
                } else {
                    resetPosition();
                }
            },
        }),
    ).current;

    const handleOnShow = useCallback(() => {
        translateY.setValue(SCREEN_HEIGHT);
        resetPosition();
    }, [resetPosition, translateY]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onShow={handleOnShow}
            onRequestClose={handleClose}
        >
            <View style={styles.backdrop}>
                <Pressable style={styles.backdropPressable} onPress={handleClose} />
                <Animated.View
                    style={[styles.sheet, { transform: [{ translateY }] }]}
                    {...panResponder.panHandlers}
                >
                    <View style={styles.handle} />
                    {title ? (
                        <Text variant="sectionTitle" color={colors.textPrimary} style={styles.title}>
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
        borderTopLeftRadius: spacing.xl,
        borderTopRightRadius: spacing.xl,
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        maxHeight: SCREEN_HEIGHT * 0.85,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: colors.borderSubtle,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    content: {
        flexGrow: 0,
    },
    contentContainer: {
        paddingBottom: spacing.lg,
    },
});

export default BottomSheet;
