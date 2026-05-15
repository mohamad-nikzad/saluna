import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarDays, Clock } from 'lucide-react-native';
import type { AppointmentWithDetails, TodayData } from '@repo/salon-core/types';
import { formatJalaliFullDate } from '@repo/salon-core/jalali';
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits';
import { salonCurrentHm } from '@repo/salon-core/salon-local-time';
import { durationMinutesFromRange } from '@repo/salon-core/appointment-time';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import {
  ACTIVE_STATUSES,
  AppointmentCard,
  StatCard,
  formatNumber,
  sortAppointments,
} from './shared';
import { getNextOpenSlot } from './next-open-slot';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';

function summarizeNextOpenSlot(slot: ReturnType<typeof getNextOpenSlot>) {
  if (!slot) return 'بازه آزاد دیگری ندارد';
  const primary = slot.startsNow
    ? `از الان تا ${formatPersianTime(slot.endTime)}`
    : `${formatPersianTime(slot.startTime)} تا ${formatPersianTime(slot.endTime)}`;
  if (slot.additionalRanges === 0) return primary;
  return `${primary} · ${toPersianDigits(slot.additionalRanges)} بازه دیگر`;
}

function bookedMinutesFor(appointments: AppointmentWithDetails[]) {
  return appointments.reduce((sum, a) => sum + durationMinutesFromRange(a.startTime, a.endTime), 0);
}

export function StaffTodayView({
  todayDate,
  tomorrowDate,
  todayData,
  tomorrowData,
  todayLoading,
  tomorrowLoading,
}: {
  todayDate: string;
  tomorrowDate: string;
  todayData?: TodayData;
  tomorrowData?: TodayData;
  todayLoading: boolean;
  tomorrowLoading: boolean;
}) {
  const router = useRouter();
  const [clockHm, setClockHm] = React.useState(() => salonCurrentHm());
  const { theme } = useTheme();
  const styles = useThemeStyles((t) => ({
    safe: { backgroundColor: t.colors.background, flex: 1 },
    header: {
      borderBottomColor: withAlpha(t.colors.border, 0.5),
      backgroundColor: t.colors.card,
      borderBottomWidth: t.sizes.hairline,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.lg,
    },
    headerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.md,
    },
    headerTitle: {
      color: t.colors.foreground,
      fontSize: t.fontSize.xl,
      fontFamily: t.fonts.sansBold,
    },
    headerSubtitle: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
    scroll: { padding: t.spacing.xl, gap: t.spacing.xl },
    skelGap: { gap: t.spacing.lg },
    statRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: t.spacing.lg },
    statCell: { flexBasis: '47%' as const, flexGrow: 1 },
    sectionCard: { gap: t.spacing.lg, padding: t.spacing.xl },
    sectionTitleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.md,
    },
    sectionTitle: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansSemiBold,
    },
    cardContent: { gap: t.spacing.lg, padding: 0 },
    currentCard: {
      borderColor: withAlpha(t.colors.primary, 0.3),
      backgroundColor: withAlpha(t.colors.primary, 0.05),
      gap: t.spacing.md,
      borderRadius: t.radius.xl,
      borderWidth: t.sizes.hairline,
      padding: t.spacing.lg,
    },
    nextCard: {
      borderColor: withAlpha(t.colors.border, 0.6),
      gap: t.spacing.md,
      borderRadius: t.radius.xl,
      borderWidth: t.sizes.hairline,
      padding: t.spacing.lg,
    },
    cardHeaderRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: t.spacing.md,
    },
    timeText: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
      writingDirection: 'ltr' as const,
    },
    clientName: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansSemiBold,
    },
    serviceName: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
    empty: {
      borderColor: withAlpha(t.colors.border, 0.7),
      alignItems: 'center' as const,
      borderRadius: t.radius.xl,
      borderWidth: t.sizes.hairline,
      borderStyle: 'dashed' as const,
      padding: t.spacing.xl,
    },
    emptyText: {
      color: t.colors.mutedForeground,
      textAlign: 'center' as const,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sans,
    },
    openSlotCard: {
      backgroundColor: withAlpha(t.colors.muted, 0.6),
      gap: t.spacing.xs,
      borderRadius: t.radius.xl,
      padding: t.spacing.lg,
    },
    openSlotLabel: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansMedium,
    },
    openSlotHint: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
    badgeText: { fontSize: t.fontSize.xs },
    listEmpty: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sans,
    },
    tomorrowSkelWrap: { gap: t.spacing.lg },
    tomorrowSkelCard: {
      borderColor: withAlpha(t.colors.border, 0.6),
      gap: t.spacing.md,
      borderRadius: t.radius.xl,
      borderWidth: t.sizes.hairline,
      padding: t.spacing.lg,
    },
  }));
  React.useEffect(() => {
    const t = setInterval(() => setClockHm(salonCurrentHm()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayAppointments = React.useMemo(
    () => sortAppointments(todayData?.appointments ?? []),
    [todayData]
  );
  const tomorrowAppointments = React.useMemo(
    () =>
      sortAppointments((tomorrowData?.appointments ?? []).filter((a) => a.status !== 'cancelled')),
    [tomorrowData]
  );
  const activeTodayAppointments = React.useMemo(
    () => todayAppointments.filter((a) => ACTIVE_STATUSES.has(a.status)),
    [todayAppointments]
  );

  const currentAppointment =
    activeTodayAppointments.find((a) => a.startTime <= clockHm && a.endTime > clockHm) ?? null;
  const nextAppointment = activeTodayAppointments.find((a) => a.startTime > clockHm) ?? null;

  const todayOpenRanges = todayData?.openSlots[0]?.ranges ?? [];
  const tomorrowOpenRanges = tomorrowData?.openSlots[0]?.ranges ?? [];
  const nextOpenSlot = React.useMemo(
    () =>
      getNextOpenSlot({
        todayRanges: todayOpenRanges,
        tomorrowRanges: tomorrowOpenRanges,
        clockHm,
      }),
    [clockHm, todayOpenRanges, tomorrowOpenRanges]
  );
  const checkingTomorrowOpenSlots =
    !getNextOpenSlot({
      todayRanges: todayOpenRanges,
      tomorrowRanges: [],
      clockHm,
    }) &&
    tomorrowLoading &&
    !tomorrowData;

  const todayBookedMinutes = bookedMinutesFor(
    todayAppointments.filter((a) => a.status !== 'cancelled')
  );

  const showSkeleton = !todayData && todayLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <CalendarDays size={theme.sizes.iconMd} color={theme.colors.primary} strokeWidth={1.8} />
          <View>
            <Text style={styles.headerTitle}>امروز من</Text>
            <Text style={styles.headerSubtitle}>
              {todayData ? formatJalaliFullDate(todayData.date) : formatJalaliFullDate(todayDate)} ·
              اکنون {formatPersianTime(clockHm)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
        {showSkeleton ? (
          <View style={styles.skelGap}>
            <View style={styles.statRow}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.statCell}>
                  <Skeleton height={80} width="100%" radius={12} />
                </View>
              ))}
            </View>
            <Skeleton height={128} width="100%" radius={12} />
            <Skeleton height={192} width="100%" radius={12} />
          </View>
        ) : (
          <>
            <View style={styles.statRow}>
              <View style={styles.statCell}>
                <StatCard
                  label="کل امروز"
                  value={formatNumber(todayAppointments.length)}
                  hint="همه نوبت‌های ثبت شده"
                />
              </View>
              <View style={styles.statCell}>
                <StatCard
                  label="در جریان"
                  value={formatNumber(activeTodayAppointments.length)}
                  hint="رزرو شده و تایید شده"
                />
              </View>
              <View style={styles.statCell}>
                <StatCard
                  label="زمان رزرو"
                  value={formatNumber(todayBookedMinutes)}
                  hint="دقیقه کاری امروز"
                />
              </View>
              <View style={styles.statCell}>
                <StatCard
                  label="فردا"
                  value={formatNumber(tomorrowAppointments.length)}
                  hint={
                    tomorrowData
                      ? formatJalaliFullDate(tomorrowData.date)
                      : formatJalaliFullDate(tomorrowDate)
                  }
                />
              </View>
            </View>

            <Card style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Clock size={theme.sizes.iconSm} color={theme.colors.primary} strokeWidth={1.8} />
                <Text style={styles.sectionTitle}>الان و بعدی</Text>
              </View>
              <CardContent style={styles.cardContent}>
                {currentAppointment ? (
                  <View style={styles.currentCard}>
                    <View style={styles.cardHeaderRow}>
                      <Badge>در حال انجام</Badge>
                      <Text style={styles.timeText}>
                        {formatPersianTime(currentAppointment.startTime)} -{' '}
                        {formatPersianTime(currentAppointment.endTime)}
                      </Text>
                    </View>
                    <Text style={styles.clientName}>{currentAppointment.client.name}</Text>
                    <Text style={styles.serviceName}>{currentAppointment.bookedServiceName}</Text>
                  </View>
                ) : nextAppointment ? (
                  <View style={styles.nextCard}>
                    <View style={styles.cardHeaderRow}>
                      <Badge variant="secondary">بعدی</Badge>
                      <Text style={styles.timeText}>
                        {formatPersianTime(nextAppointment.startTime)} -{' '}
                        {formatPersianTime(nextAppointment.endTime)}
                      </Text>
                    </View>
                    <Text style={styles.clientName}>{nextAppointment.client.name}</Text>
                    <Text style={styles.serviceName}>{nextAppointment.bookedServiceName}</Text>
                  </View>
                ) : (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                      برای ادامه امروز نوبت فعالی باقی نمانده است.
                    </Text>
                  </View>
                )}

                <View style={styles.openSlotCard}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.openSlotLabel}>بازه آزاد بعدی</Text>
                    {nextOpenSlot ? (
                      <Badge variant="outline" textStyle={styles.badgeText}>
                        {nextOpenSlot.dayLabel}
                      </Badge>
                    ) : null}
                  </View>
                  <Text style={styles.openSlotHint}>
                    {checkingTomorrowOpenSlots
                      ? 'در حال بررسی اولین بازه آزاد...'
                      : summarizeNextOpenSlot(nextOpenSlot)}
                  </Text>
                </View>
              </CardContent>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>نوبت‌های امروز</Text>
              <CardContent style={styles.cardContent}>
                {todayAppointments.length === 0 ? (
                  <Text style={styles.listEmpty}>برای امروز نوبتی ثبت نشده است.</Text>
                ) : (
                  todayAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      meta={appointment.status === 'completed' ? 'انجام شده' : 'مشتری امروز'}
                      tone={currentAppointment?.id === appointment.id ? 'highlight' : 'default'}
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/calendar',
                          params: { appointmentId: appointment.id, date: appointment.date },
                        })
                      }
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>نگاه به فردا</Text>
              <CardContent style={styles.cardContent}>
                {!tomorrowData && tomorrowLoading ? (
                  <View style={styles.tomorrowSkelWrap}>
                    <View style={styles.tomorrowSkelCard}>
                      <Skeleton height={16} width={112} />
                      <Skeleton height={12} width={80} />
                      <Skeleton height={12} width={128} />
                    </View>
                    <View style={styles.tomorrowSkelCard}>
                      <Skeleton height={16} width={96} />
                      <Skeleton height={12} width={96} />
                      <Skeleton height={12} width={112} />
                    </View>
                  </View>
                ) : tomorrowAppointments.length === 0 ? (
                  <Text style={styles.listEmpty}>برای فردا هنوز نوبتی ثبت نشده است.</Text>
                ) : (
                  tomorrowAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      meta="برنامه فردا"
                      onPress={() =>
                        router.push({
                          pathname: '/(tabs)/calendar',
                          params: { appointmentId: appointment.id, date: appointment.date },
                        })
                      }
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
