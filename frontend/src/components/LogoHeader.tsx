import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

interface LogoHeaderProps {
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function LogoHeader({ showText = true, size = 'medium' }: LogoHeaderProps) {
  const logoSize = size === 'small' ? 32 : size === 'medium' ? 48 : 64;
  const borderRadius = size === 'small' ? 8 : size === 'medium' ? 12 : 16;
  
  return (
    <View style={styles.container}>
      <View style={[styles.logoWrapper, { width: logoSize, height: logoSize, borderRadius }]}>
        <Image
          source={require('../../assets/icon.png')}
          style={[styles.logo, { width: logoSize, height: logoSize, borderRadius }]}
          resizeMode="cover"
        />
      </View>
      {showText && (
        <View style={styles.textContainer}>
          <Text style={[styles.title, size === 'small' && styles.titleSmall]}>
            Mzansi Distribution Tracker
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    borderRadius: 12,
  },
  logoWrapper: {
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  textContainer: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  titleSmall: {
    fontSize: 14,
  },
  subtitle: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  subtitleSmall: {
    fontSize: 11,
  },
});
