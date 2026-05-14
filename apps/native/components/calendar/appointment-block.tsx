import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppointmentWithDetails } from '@repo/salon-core/types';
import { formatPersianTime } from '@repo/salon-core/persian-digits';
import { APPOINTMENT_STATUS } from '@repo/salon-core/types';
import { formatCompactServiceLabel } from '@repo/salon-core/service-catalog';
import { useTheme, withAlpha } from '../../theme';
import { FONTS, staffBorder, staffHex, staffSoftBg, statusPalette } from './helpers';

export type AppointmentBlockProps = {
  appointment: AppointmentWithDetails;
  topPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
  onPress: () => void;
  /** Compact mode for week view */
  compact?: boolean;
};

export function AppointmentBlock({
  appointment,
  topPx,
  heightPx,
  leftPercent,
  widthPercent,
  onPress,
  compact = false,
}: AppointmentBlockProps) {
  const { theme, appointmentStatus } = useTheme();
  const stripe = staffHex(appointment.staff.color);
  const tint = staffSoftBg(appointment.staff.color);
  const border = staffBorder(appointment.staff.color);
  const status = appointment.status;
  const showSecondaryLine = heightPx >= 44;

  const isCancelled = status === 'cancelled' || status === 'no-show';
  const palette = statusPalette(status);
  const themedStatus = appointmentStatus(status);

  const statusLabel = APPOINTMENT_STATUS[status]?.label ?? '';
  const serviceLabel = formatCompactServiceLabel(appointment.service);
  const a11yLabel = `${appointment.client.name}، ${serviceLabel}، ${appointment.staff.name}، ${formatPersianTime(appointment.startTime)} تا ${formatPersianTime(appointment.endTime)}، ${statusLabel}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="مشاهده جزئیات نوبت"
      style={({ pressed }) => [
        {
          position: 'absolute',
          top: topPx,
          height: Math.max(22, heightPx - 2),
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
          backgroundColor: isCancelled ? theme.colors.muted : tint,
          borderColor: isCancelled ? theme.colors.border : border,
          borderWidth: 1,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {/* Trailing-side stripe (right in RTL) */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 3,
          backgroundColor: isCancelled ? theme.colors.mutedForeground : stripe,
        }}
      />
      <View style={{ paddingHorizontal: 8, paddingVertical: 4, paddingRight: 11 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: FONTS.semi,
            fontSize: compact ? 10 : 11,
            color: isCancelled
              ? theme.colors.mutedForeground
              : themedStatus.foreground || palette.text,
            textDecorationLine: status === 'cancelled' ? 'line-through' : 'none',
          }}>
          {appointment.client.name}
        </Text>
        {showSecondaryLine ? (
          <>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: FONTS.reg,
                fontSize: compact ? 9 : 10,
                color: isCancelled
                  ? withAlpha(theme.colors.mutedForeground, 0.75)
                  : theme.colors.mutedForeground,
                marginTop: 1,
              }}>
              {serviceLabel}
            </Text>
            {!compact && heightPx >= 60 ? (
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: FONTS.med,
                  fontSize: 10,
                  color: isCancelled
                    ? withAlpha(theme.colors.mutedForeground, 0.75)
                    : theme.colors.mutedForeground,
                  marginTop: 1,
                  writingDirection: 'ltr',
                }}>
                {formatPersianTime(appointment.startTime)} -{' '}
                {formatPersianTime(appointment.endTime)}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </Pressable>
  );
}
