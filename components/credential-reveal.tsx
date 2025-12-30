import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextStyle, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  value?: string;
  maskedValue: string;
  textStyle?: TextStyle;
  disabled?: boolean;
};

export default function CredentialReveal({ value, maskedValue, textStyle, disabled }: Props) {
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startReveal = () => {
    if (!value || disabled) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    progress.stopAnimation();
    progress.setValue(1);
    setVisible(true);
    setRemaining(5);
    const endsAt = Date.now() + 5000;

    intervalRef.current = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(secondsLeft);
    }, 250);

    timerRef.current = setTimeout(() => {
      setVisible(false);
      setRemaining(0);
    }, 5000);

    Animated.timing(progress, {
      toValue: 0,
      duration: 5000,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Pressable style={styles.pressable} onPress={startReveal} disabled={!value || disabled}>
      <Text style={[styles.value, textStyle]}>{visible ? value : maskedValue}</Text>
      {visible ? (
        <View style={styles.countdownContainer}>
          <Svg width={26} height={26} viewBox="0 0 26 26">
            <Circle cx={13} cy={13} r={11} stroke="#E5E7EB" strokeWidth={3} fill="none" />
            <AnimatedCircle
              cx={13}
              cy={13}
              r={11}
              stroke="#111827"
              strokeWidth={3}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              rotation={-90}
              origin="13 13"
            />
          </Svg>
          <Text style={styles.countdownText}>{remaining}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 15,
    color: '#111827',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdownText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '700',
  },
});
