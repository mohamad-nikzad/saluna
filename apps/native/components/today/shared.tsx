import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AppointmentWithDetails, TodayAttentionItem } from '@repo/salon-core/types';
import { APPOINTMENT_STATUS } from '@repo/salon-core/types';
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { useThemeStyles, withAlpha } from '../../theme';

export const ACTIVE_STATUSES = new Set<AppointmentWithDetails['status']>([
  'scheduled',
  'confirmed',
]);

export const ATTENTION_LABELS: Record<TodayAttentionItem['type'], string> = {
  soon: 'نزدیک',
  overdue: 'ثبت نتیجه',
  'no-show-risk': 'بدقول',
  'first-time': 'اولین مراجعه',
  vip: 'VIP',
  'incomplete-client': 'اطلاعات ناقص',
};

const numFmt = new Intl.NumberFormat('fa-IR');
export function formatNumber(value: number) {
  return numFmt.format(value);
}

export function sortAppointments(list: AppointmentWithDetails[]) {
  return [...list].sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)
  );
}

export function summarizeOpenRanges(ranges: { startTime: string; endTime: string }[]) {
  if (ranges.length === 0) return 'بازه آزاد ندارد';
  const first = ranges[0];
  const primary = `${formatPersianTime(first.startTime)} تا ${formatPersianTime(first.endTime)}`;
  if (ranges.length === 1) return primary;
  return `${primary} · ${toPersianDigits(ranges.length - 1)} بازه دیگر`;
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const styles = useThemeStyles((t) => ({
    card: { gap: t.spacing.xs, padding: t.spacing.xl },
    label: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansMedium,
    },
    value: {
      color: t.colors.foreground,
      fontSize: t.fontSize['2xl'],
      fontFamily: t.fonts.sansBold,
    },
    hint: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
  }));
  return (
    <Card style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Card>
  );
}

export function AppointmentCard({
  appointment,
  meta,
  tone = 'default',
  children,
  onPress,
}: {
  appointment: AppointmentWithDetails;
  meta: string;
  tone?: 'default' | 'highlight';
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  const styles = useThemeStyles((t) => ({
    card: {
      borderColor: withAlpha(t.colors.border, 0.6),
      backgroundColor: t.colors.card,
      gap: t.spacing.lg,
      borderRadius: t.radius.xl,
      borderWidth: t.sizes.hairline,
      padding: t.spacing.lg,
    },
    cardHighlight: {
      borderColor: withAlpha(t.colors.primary, 0.3),
      backgroundColor: withAlpha(t.colors.primary, 0.05),
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: t.spacing.lg,
    },
    body: { minWidth: 0, flex: 1, gap: t.spacing.xs },
    nameRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.md,
    },
    name: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansSemiBold,
    },
    placeholderBadge: {
      backgroundColor: withAlpha(t.colors.accent, 0.4),
      borderColor: t.colors.ring,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 0,
    },
    placeholderBadgeText: { color: t.colors.accentForeground, fontSize: t.fontSize.xs },
    muted: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
    mutedLtr: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
      writingDirection: 'ltr' as const,
    },
    statusBadge: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs / 2,
    },
    statusBadgeText: { fontSize: t.fontSize.xs },
  }));
  const Container: React.ComponentType<{
    children: React.ReactNode;
    style: unknown;
  }> = onPress
    ? ({ children: c, style }) => (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({ pressed }) => [style, pressed ? { opacity: 0.85 } : null] as never}>
          {c}
        </Pressable>
      )
    : ({ children: c, style }) => <View style={style as never}>{c}</View>;
  return (
    <Container style={[styles.card, tone === 'highlight' ? styles.cardHighlight : null]}>
      <View style={styles.header}>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {appointment.client.name}
            </Text>
            {appointment.client.isPlaceholder ? (
              <Badge
                variant="outline"
                style={styles.placeholderBadge}
                textStyle={styles.placeholderBadgeText}>
                اطلاعات ناقص
              </Badge>
            ) : null}
          </View>
          <Text style={styles.muted}>{appointment.bookedServiceName}</Text>
          <Text style={styles.mutedLtr}>
            {formatPersianTime(appointment.startTime)} - {formatPersianTime(appointment.endTime)} ·{' '}
            {meta}
          </Text>
          {appointment.notes ? (
            <Text style={styles.muted} numberOfLines={2}>
              {appointment.notes}
            </Text>
          ) : null}
        </View>
        <Badge variant="outline" style={styles.statusBadge} textStyle={styles.statusBadgeText}>
          {APPOINTMENT_STATUS[appointment.status].label}
        </Badge>
      </View>
      {children}
    </Container>
  );
}

export function SectionCard({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const styles = useThemeStyles((t) => ({
    card: { gap: t.spacing.lg },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.md,
    },
    title: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansSemiBold,
    },
    content: { gap: t.spacing.lg, padding: 0 },
  }));
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        {icon}
        <Text style={styles.title}>{title}</Text>
      </View>
      <CardContent style={styles.content}>{children}</CardContent>
    </Card>
  );
}
