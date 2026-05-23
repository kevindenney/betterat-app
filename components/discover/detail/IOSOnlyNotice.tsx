/**
 * Web fallback for the Discover detail trio (iOS register).
 *
 * The trio is designed for the iOS phone shell — rounded screen, status bar,
 * back chevron, float-nav. Rendering the same components in a desktop browser
 * loses the chrome the design depends on. Rather than ship a half-design, web
 * shows this small notice and offers to drop the user back to the Discover
 * list, which is universal.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { IOS_DETAIL_GROUND_BG } from '@/components/discover/detail';

export function IOSOnlyNotice({ surface }: { surface: 'Org' | 'Person' | 'Topic' }) {
  return (
    <SafeAreaView style={styles.ground}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>iOS register</Text>
        <Text style={styles.title}>{surface} detail is designed for the iOS app</Text>
        <Text style={styles.body}>
          This surface is part of the iOS Discover detail trio — it depends on
          the phone shell to read as designed. Open the iOS app to see it
          rendered properly, or return to the universal Discover list.
        </Text>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/discover' as any);
          }}
          style={({ pressed }) => [styles.btnWrap, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.btn}>
            <Text style={styles.btnLabel}>Back to Discover</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: {
    flex: 1,
    backgroundColor: IOS_DETAIL_GROUND_BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: IOS_REGISTER.labelSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: IOS_REGISTER.label,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: IOS_REGISTER.labelSecondary,
  },
  btnWrap: { marginTop: 12, alignSelf: 'flex-start' },
  btn: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
