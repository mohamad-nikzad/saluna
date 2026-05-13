import * as React from 'react';
import { View, type TextStyle, type ViewProps } from 'react-native';

import { useTheme } from '../../theme';
import { AppText } from './app-text';
import type { ThemeColorName } from '../../theme/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export type BadgeProps = ViewProps & {
  variant?: BadgeVariant;
  children?: React.ReactNode;
  textStyle?: TextStyle;
};

function Badge({ variant = 'default', children, style, textStyle, ...props }: BadgeProps) {
  const { theme } = useTheme();
  const label = typeof children === 'string' ? children.replace(/\s+/g, '\u00A0') : null;
  const variantStyle = {
    default: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    secondary: { backgroundColor: theme.colors.secondary, borderColor: theme.colors.secondary },
    destructive: {
      backgroundColor: theme.colors.destructive,
      borderColor: theme.colors.destructive,
    },
    outline: { backgroundColor: 'transparent', borderColor: theme.colors.border },
  }[variant];
  const textColors: Record<BadgeVariant, ThemeColorName> = {
    default: 'primaryForeground',
    secondary: 'secondaryForeground',
    destructive: 'destructiveForeground',
    outline: 'foreground',
  };
  const textColor = textColors[variant];

  return (
    <View
      style={[
        {
          alignItems: 'center',
          alignSelf: 'flex-start',
          borderRadius: theme.radius.md,
          borderWidth: variant === 'outline' ? 1 : 0,
          flexDirection: 'row',
          flexShrink: 0,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
        variantStyle,
        style,
      ]}
      {...props}>
      {label != null ? (
        <AppText
          color={textColor}
          ellipsizeMode="clip"
          numberOfLines={1}
          variant="caption"
          weight="medium"
          style={[{ flexShrink: 0 }, textStyle]}>
          {label}
        </AppText>
      ) : (
        children
      )}
    </View>
  );
}

export { Badge };
