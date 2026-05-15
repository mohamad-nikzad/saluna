import * as React from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight,
  CalendarPlus,
  ClipboardList,
  Pencil,
  Phone,
  Sparkles,
  User,
} from 'lucide-react-native';
import type { ClientSummary, FollowUpReason } from '@repo/salon-core/types';
import { APPOINTMENT_STATUS } from '@repo/salon-core/types';
import { displayPhone } from '@repo/salon-core/phone';
import { formatJalaliFullDate } from '@repo/salon-core/jalali';
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { ClientFormModal } from '../../components/clients/client-form-modal';
import { useAuth } from '../../components/auth-provider';
import { clientsApi } from '../../lib/api';
import { useAsyncResource } from '../../lib/hooks/use-async-resource';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';

function followReasonLabel(reason: FollowUpReason): string {
  switch (reason) {
    case 'inactive':
      return 'عدم مراجعه';
    case 'no-show':
      return 'غیبت';
    case 'new-client':
      return 'مشتری جدید';
    case 'vip':
      return 'ارزشمند';
    case 'manual':
      return 'دستی';
    default:
      return reason;
  }
}

function formatTomans(n: number) {
  return new Intl.NumberFormat('fa-IR').format(n) + ' تومان';
}

function callPhone(phone: string | null | undefined) {
  if (!phone) return;
  const url = `tel:${phone}`;
  void Linking.canOpenURL(url).then((can) => {
    if (can) Linking.openURL(url);
    else Alert.alert('شماره در دسترس نیست');
  });
}

export default function ClientDetailScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const [editOpen, setEditOpen] = React.useState(false);

  const key = user?.role === 'manager' && id ? `client-summary:${id}` : null;
  const { data, error, loading, reload } = useAsyncResource<ClientSummary>(key, (signal) =>
    clientsApi.summary(id, { signal })
  );

  const styles = useThemeStyles((t) => ({
    safe: { backgroundColor: t.colors.background, flex: 1 },
    header: {
      borderBottomColor: withAlpha(t.colors.border, 0.5),
      backgroundColor: t.colors.card,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.lg,
      borderBottomWidth: t.sizes.hairline,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.lg,
    },
    backButton: {
      height: t.sizes.avatarMd,
      width: t.sizes.avatarMd,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: t.radius.full,
    },
    headerBody: { flex: 1, minWidth: 0 },
    headerTitle: {
      color: t.colors.foreground,
      fontSize: t.fontSize.xl,
      fontFamily: t.fonts.sansBold,
    },
    headerPhone: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
    headerAction: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.xs,
    },
    scroll: { padding: t.spacing.xl, gap: t.spacing.lg },
    actionsRow: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: t.spacing.md,
    },
    actionLabel: {
      color: t.colors.primaryForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansMedium,
    },
    secondaryActionLabel: {
      color: t.colors.secondaryForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansMedium,
    },
    tagWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: t.spacing.xs },
    noteCard: {
      gap: t.spacing.sm,
      padding: t.spacing.lg,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.primary, 0.3),
      backgroundColor: withAlpha(t.colors.primary, 0.05),
    },
    noteHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.sm,
    },
    noteHeaderText: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansSemiBold,
    },
    noteBody: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
      lineHeight: 22,
    },
    statsRow: {
      flexDirection: 'row' as const,
      gap: t.spacing.md,
      flexWrap: 'wrap' as const,
    },
    statCard: {
      flex: 1,
      minWidth: 100,
      gap: t.spacing.xs,
      alignItems: 'center' as const,
      padding: t.spacing.lg,
    },
    statHint: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    statValue: {
      color: t.colors.foreground,
      fontSize: t.fontSize.lg,
      fontFamily: t.fonts.sansBold,
    },
    statValueSm: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansBold,
    },
    twoCardsRow: { flexDirection: 'row' as const, gap: t.spacing.md, flexWrap: 'wrap' as const },
    iconCard: {
      flex: 1,
      minWidth: 140,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: t.spacing.md,
      padding: t.spacing.lg,
    },
    iconCardBody: { flex: 1, gap: t.spacing.xs },
    iconCardLabel: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    iconCardValue: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansMedium,
    },
    cardHeaderPadding: { padding: 0 },
    cardContent: { gap: t.spacing.md, padding: 0 },
    historyRow: {
      gap: t.spacing.xs,
      paddingVertical: t.spacing.md,
      borderBottomWidth: t.sizes.hairline,
      borderBottomColor: withAlpha(t.colors.border, 0.4),
    },
    historyHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: t.spacing.md,
    },
    historyDate: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansMedium,
    },
    historyMeta: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    followRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.border, 0.6),
    },
    followLabel: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansMedium,
    },
    upcomingCard: {
      gap: t.spacing.sm,
      padding: t.spacing.lg,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.primary, 0.35),
      backgroundColor: withAlpha(t.colors.primary, 0.06),
    },
    upcomingTitle: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansSemiBold,
    },
    upcomingLine: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
    upcomingMeta: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    muted: {
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sans,
      fontSize: t.fontSize.sm,
    },
    errorBox: {
      margin: t.spacing.xl,
      padding: t.spacing.lg,
      borderRadius: t.radius.md,
      backgroundColor: withAlpha(t.colors.destructive, 0.08),
      gap: t.spacing.md,
    },
    errorText: { color: t.colors.destructive, fontFamily: t.fonts.sans },
    skeletonStack: { padding: t.spacing.xl, gap: t.spacing.lg },
  }));

  if (!user || user.role !== 'manager') return null;

  const renderHeader = (title: string, phone?: string | null) => (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="بازگشت"
        onPress={() => router.back()}
        style={styles.backButton}>
        <ArrowRight
          size={theme.sizes.iconSm + 2}
          color={theme.colors.foreground}
          strokeWidth={1.8}
        />
      </Pressable>
      <View style={styles.headerBody}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {phone ? (
          <Text style={styles.headerPhone} numberOfLines={1}>
            {displayPhone(phone)}
          </Text>
        ) : null}
      </View>
      {data ? (
        <Button
          variant="outline"
          size="sm"
          onPress={() => setEditOpen(true)}
          style={styles.headerAction}>
          <Pencil size={theme.sizes.iconSm} color={theme.colors.foreground} strokeWidth={1.8} />
          <Text style={{ color: theme.colors.foreground, fontFamily: theme.fonts.sansMedium }}>
            ویرایش
          </Text>
        </Button>
      ) : null}
    </View>
  );

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {renderHeader('پروفایل مشتری')}
        <View style={styles.skeletonStack}>
          <Skeleton height={96} radius={12} />
          <Skeleton height={140} radius={12} />
          <Skeleton height={180} radius={12} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {renderHeader('پروفایل مشتری')}
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>پروفایل مشتری در دسترس نیست.</Text>
          <Button variant="outline" size="sm" onPress={() => router.replace('/clients')}>
            بازگشت به فهرست
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const { client, tags, stats, upcomingAppointment, history, openFollowUps } = data;
  const sortedHistory = [...history].sort((a, b) =>
    `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`)
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {renderHeader(client.name, client.phone)}

      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.actionsRow}>
          {client.phone ? (
            <Button onPress={() => callPhone(client.phone)} style={styles.headerAction}>
              <Phone
                size={theme.sizes.iconSm}
                color={theme.colors.primaryForeground}
                strokeWidth={1.8}
              />
              <Text style={styles.actionLabel}>تماس</Text>
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/calendar',
                params: { clientId: client.id },
              } as never)
            }
            style={styles.headerAction}>
            <CalendarPlus
              size={theme.sizes.iconSm}
              color={theme.colors.secondaryForeground}
              strokeWidth={1.8}
            />
            <Text style={styles.secondaryActionLabel}>نوبت جدید</Text>
          </Button>
        </View>

        {tags.length > 0 ? (
          <View style={styles.tagWrap}>
            {tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.label}
              </Badge>
            ))}
          </View>
        ) : null}

        {client.notes ? (
          <Card style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <ClipboardList
                size={theme.sizes.iconSm}
                color={theme.colors.primary}
                strokeWidth={1.8}
              />
              <Text style={styles.noteHeaderText}>یادداشت</Text>
            </View>
            <Text style={styles.noteBody}>{client.notes}</Text>
          </Card>
        ) : null}

        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statHint}>مراجعات انجام‌شده</Text>
            <Text style={styles.statValue}>{toPersianDigits(stats.totalCompletedVisits)}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statHint}>لغو / غیبت</Text>
            <Text style={styles.statValue}>
              {toPersianDigits(stats.cancelledCount)} / {toPersianDigits(stats.noShowCount)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statHint}>مجموع تخمینی</Text>
            <Text style={styles.statValueSm}>{formatTomans(stats.estimatedSpend)}</Text>
          </Card>
        </View>

        <View style={styles.twoCardsRow}>
          <Card style={styles.iconCard}>
            <Sparkles size={theme.sizes.iconSm} color={theme.colors.primary} strokeWidth={1.8} />
            <View style={styles.iconCardBody}>
              <Text style={styles.iconCardLabel}>محبوب‌ترین خدمت</Text>
              <Text style={styles.iconCardValue}>{stats.favoriteServiceName ?? '—'}</Text>
            </View>
          </Card>
          <Card style={styles.iconCard}>
            <User size={theme.sizes.iconSm} color={theme.colors.primary} strokeWidth={1.8} />
            <View style={styles.iconCardBody}>
              <Text style={styles.iconCardLabel}>آخرین پرسنل</Text>
              <Text style={styles.iconCardValue}>{stats.lastStaffName ?? '—'}</Text>
            </View>
          </Card>
        </View>

        {upcomingAppointment ? (
          <Card style={styles.upcomingCard}>
            <Text style={styles.upcomingTitle}>نوبت پیشِ رو</Text>
            <Text style={styles.upcomingLine}>
              {formatJalaliFullDate(upcomingAppointment.date)}
            </Text>
            <Text style={styles.upcomingMeta}>
              {formatPersianTime(upcomingAppointment.startTime)} –{' '}
              {formatPersianTime(upcomingAppointment.endTime)} · {upcomingAppointment.staff.name}
            </Text>
            <Text style={styles.upcomingLine}>{upcomingAppointment.bookedServiceName}</Text>
            <Badge variant="secondary">
              {APPOINTMENT_STATUS[upcomingAppointment.status].label}
            </Badge>
          </Card>
        ) : null}

        {openFollowUps.length > 0 ? (
          <Card>
            <CardHeader style={styles.cardHeaderPadding}>
              <CardTitle color="mutedForeground" variant="label" weight="medium">
                پیگیری‌های باز
              </CardTitle>
            </CardHeader>
            <CardContent style={styles.cardContent}>
              {openFollowUps.map((fu) => (
                <View key={fu.id} style={styles.followRow}>
                  <Text style={styles.followLabel}>{followReasonLabel(fu.reason)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/retention' as never)}>
                    <Text
                      style={{ color: theme.colors.primary, fontFamily: theme.fonts.sansMedium }}>
                      صف پیگیری
                    </Text>
                  </Pressable>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader style={styles.cardHeaderPadding}>
            <CardTitle color="mutedForeground" variant="label" weight="medium">
              تاریخچه نوبت‌ها
            </CardTitle>
          </CardHeader>
          <CardContent style={styles.cardContent}>
            {sortedHistory.length === 0 ? (
              <Text style={styles.muted}>هنوز نوبتی ثبت نشده است.</Text>
            ) : (
              sortedHistory.map((apt) => (
                <View key={apt.id} style={styles.historyRow}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyDate}>{formatJalaliFullDate(apt.date)}</Text>
                    <Badge variant="outline">{APPOINTMENT_STATUS[apt.status].label}</Badge>
                  </View>
                  <Text style={styles.historyMeta}>
                    {apt.bookedServiceName} · {apt.staff.name} ({formatPersianTime(apt.startTime)}–
                    {formatPersianTime(apt.endTime)})
                  </Text>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>

      <ClientFormModal
        open={editOpen}
        client={client}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          reload();
        }}
      />
    </SafeAreaView>
  );
}
