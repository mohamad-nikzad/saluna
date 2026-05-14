import * as React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, Clock3, Search, Sparkles } from 'lucide-react-native';
import { AppModal } from '../ui/app-modal';
import {
  AVAILABILITY_EMPTY_REASONS,
  type AvailabilityEmptyReason,
  type AvailabilityResponse,
  type AvailabilitySlot,
} from '@repo/salon-core/availability';
import { formatJalaliFullDate } from '@repo/salon-core/jalali';
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits';
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time';
import { eligibleStaffForService } from '@repo/salon-core/staff-service-autofill';
import { groupServicesByCatalog } from '@repo/salon-core/service-catalog';
import type { Service, User } from '@repo/salon-core/types';
import { ApiError } from '@repo/api-client';
import { Button } from '../ui/button';
import { JalaliDatePicker } from '../ui/jalali-date-picker';
import { Select, type SelectGroup, type SelectOption } from '../ui/select';
import { Spinner } from '../ui/spinner';
import { appointmentsApi } from '../../lib/api';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';

const ANY_STAFF_VALUE = '__any__';
type DayAvailabilityResponse = Extract<AvailabilityResponse, { mode: 'day' }>;
type NearestAvailabilityResponse = Extract<AvailabilityResponse, { mode: 'nearest' }>;

type SlotGroup = {
  staffId: string;
  staffName: string;
  slots: AvailabilitySlot[];
};

function emptyReasonCopy(reason?: AvailabilityEmptyReason): string {
  switch (reason) {
    case AVAILABILITY_EMPTY_REASONS.NO_QUALIFIED_STAFF:
      return 'برای این خدمت فعلاً پرسنل فعالی تعریف نشده است.';
    case AVAILABILITY_EMPTY_REASONS.STAFF_OFF_DAY:
      return 'پرسنل انتخاب‌شده در این روز شیفت فعالی ندارد.';
    case AVAILABILITY_EMPTY_REASONS.ALL_QUALIFIED_STAFF_OFF_DAY:
      return 'هیچ‌کدام از پرسنل واجد شرایط در این روز شیفت فعالی ندارند.';
    case AVAILABILITY_EMPTY_REASONS.OUTSIDE_SEARCH_WINDOW:
      return 'تا ۷ روز آینده زمان خالی مناسبی پیدا نشد.';
    case AVAILABILITY_EMPTY_REASONS.FULLY_BOOKED:
    default:
      return 'در این روز زمانی پیدا نشد که کل مدت خدمت در آن جا شود.';
  }
}

function groupSlotsByStaff(slots: AvailabilitySlot[]): SlotGroup[] {
  const groups = new Map<string, SlotGroup>();
  for (const slot of slots) {
    const current = groups.get(slot.staffId);
    if (current) {
      current.slots.push(slot);
      continue;
    }
    groups.set(slot.staffId, { staffId: slot.staffId, staffName: slot.staffName, slots: [slot] });
  }
  return [...groups.values()].sort((a, b) => {
    const af = a.slots[0]?.startTime ?? '99:99';
    const bf = b.slots[0]?.startTime ?? '99:99';
    if (af !== bf) return af.localeCompare(bf);
    return a.staffName.localeCompare(b.staffName, 'fa');
  });
}

export type AvailabilityModalProps = {
  open: boolean;
  onClose: () => void;
  initialDate: string;
  staff: User[];
  services: Service[];
  onSelectSlot: (selection: { slot: AvailabilitySlot; serviceId: string }) => void;
};

export function AvailabilityModal({
  open,
  onClose,
  initialDate,
  staff,
  services,
  onSelectSlot,
}: AvailabilityModalProps) {
  const { theme } = useTheme();
  const [serviceId, setServiceId] = React.useState('');
  const [staffSelection, setStaffSelection] = React.useState<string>(ANY_STAFF_VALUE);
  const [date, setDate] = React.useState(initialDate || salonTodayYmd());
  const [loadingMode, setLoadingMode] = React.useState<'day' | 'nearest' | null>(null);
  const [error, setError] = React.useState('');
  const [dayResponse, setDayResponse] = React.useState<DayAvailabilityResponse | null>(null);
  const [nearestResponse, setNearestResponse] = React.useState<NearestAvailabilityResponse | null>(
    null
  );
  const abortRef = React.useRef<AbortController | null>(null);
  const wasOpenRef = React.useRef(open);

  const staffRoleOnly = React.useMemo(() => staff.filter((m) => m.role === 'staff'), [staff]);
  const activeServices = React.useMemo(() => services.filter((s) => s.active), [services]);
  const serviceGroups: SelectGroup[] = React.useMemo(() => {
    return groupServicesByCatalog(activeServices).flatMap((category) =>
      category.families.map((family) => ({
        label: `${category.categoryName} / ${family.familyName}`,
        options: family.services.map((service) => ({
          value: service.id,
          label: service.name,
          detail: `${toPersianDigits(service.duration)} دقیقه`,
        })),
      }))
    );
  }, [activeServices]);

  const eligibleStaff = React.useMemo(
    () => (serviceId ? eligibleStaffForService(staffRoleOnly, serviceId) : []),
    [serviceId, staffRoleOnly]
  );
  const staffOptions: SelectOption[] = React.useMemo(
    () => [
      { value: ANY_STAFF_VALUE, label: 'هر پرسنل واجد شرایط' },
      ...eligibleStaff.map((m) => ({ value: m.id, label: m.name })),
    ],
    [eligibleStaff]
  );

  const groupedSlots = React.useMemo(
    () => (dayResponse?.slots.length ? groupSlotsByStaff(dayResponse.slots) : []),
    [dayResponse]
  );

  const clearResults = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoadingMode(null);
    setError('');
    setDayResponse(null);
    setNearestResponse(null);
  }, []);

  const reset = React.useCallback(() => {
    clearResults();
    setServiceId('');
    setStaffSelection(ANY_STAFF_VALUE);
    setDate(initialDate || salonTodayYmd());
  }, [clearResults, initialDate]);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) reset();
    wasOpenRef.current = open;
  }, [open, reset]);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = React.useCallback(
    async (mode: 'day' | 'nearest', targetDate = date) => {
      if (!serviceId) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoadingMode(mode);
      setError('');
      if (mode === 'day') {
        setDayResponse(null);
        setNearestResponse(null);
      } else {
        setNearestResponse(null);
      }
      try {
        const response = await appointmentsApi.availability(
          {
            mode,
            serviceId,
            date: targetDate,
            ...(staffSelection !== ANY_STAFF_VALUE ? { staffId: staffSelection } : {}),
          },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        if (mode === 'day' && response.mode === 'day') {
          setDayResponse(response);
        } else if (mode === 'nearest' && response.mode === 'nearest') {
          setNearestResponse(response);
        } else {
          setError('پاسخ بررسی زمان کامل نبود.');
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'خطایی رخ داد. دوباره تلاش کنید.');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setLoadingMode((cur) => (cur === mode ? null : cur));
      }
    },
    [date, serviceId, staffSelection]
  );

  const handleServiceChange = (id: string) => {
    setServiceId(id);
    const nextEligible = eligibleStaffForService(staffRoleOnly, id);
    if (staffSelection !== ANY_STAFF_VALUE && !nextEligible.some((m) => m.id === staffSelection)) {
      setStaffSelection(ANY_STAFF_VALUE);
    }
    clearResults();
  };

  const handleDateChange = (d: string) => {
    setDate(d);
    clearResults();
  };

  const handleDayNav = (delta: number) => {
    const next = addDaysYmd(date, delta);
    setDate(next);
    setError('');
    if (!serviceId) {
      setDayResponse(null);
      setNearestResponse(null);
      return;
    }
    void runSearch('day', next);
  };

  const styles = useThemeStyles((t) => ({
    flex1: { flex: 1 },
    label: {
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansSemiBold,
      color: t.colors.foreground,
    },
    field: { gap: t.spacing.sm },
    error: {
      fontSize: t.fontSize.sm,
      color: t.colors.destructive,
      fontFamily: t.fonts.sansSemiBold,
    },
    notice: {
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.primary, 0.3),
      backgroundColor: withAlpha(t.colors.primary, 0.06),
      padding: t.spacing.md,
    },
    noticeText: { fontSize: t.fontSize.xs, color: t.colors.primary, fontFamily: t.fonts.sans },
    dayHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      padding: t.spacing.md,
    },
    dayHeaderText: {
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansSemiBold,
      color: t.colors.foreground,
    },
    dayHeaderHint: {
      fontSize: t.fontSize.xs,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sans,
    },
    group: {
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      padding: t.spacing.md,
      gap: t.spacing.sm,
    },
    groupHeader: {
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansSemiBold,
      color: t.colors.foreground,
    },
    groupSub: {
      fontSize: t.fontSize.xs,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sans,
    },
    slot: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.border,
      backgroundColor: t.colors.background,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
    },
    slotMain: {
      fontSize: t.fontSize.base,
      color: t.colors.foreground,
      fontFamily: t.fonts.sansSemiBold,
    },
    slotSub: { fontSize: t.fontSize.xs, color: t.colors.mutedForeground, fontFamily: t.fonts.sans },
    emptyCard: {
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.border,
      backgroundColor: t.colors.muted,
      padding: t.spacing.lg,
      gap: t.spacing.md,
      alignItems: 'center' as const,
    },
    emptyTitle: {
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansSemiBold,
      color: t.colors.foreground,
    },
    emptyText: {
      fontSize: t.fontSize.sm,
      color: t.colors.mutedForeground,
      textAlign: 'center' as const,
      fontFamily: t.fonts.sans,
    },
    nearest: {
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.primary, 0.4),
      backgroundColor: withAlpha(t.colors.primary, 0.06),
      padding: t.spacing.md,
      gap: t.spacing.sm,
    },
    navRow: { flexDirection: 'row' as const, gap: t.spacing.sm, marginTop: t.spacing.md },
    navBtn: { flex: 1 },
  }));

  const hasResults = groupedSlots.length > 0 || nearestResponse?.slot != null;
  const submitDisabled = !serviceId || loadingMode === 'day';

  return (
    <AppModal
      visible={open}
      onClose={onClose}
      header={{ title: 'بررسی زمان خالی', subtitle: 'خدمت و تاریخ را انتخاب کنید.' }}>
      <View style={styles.field}>
        <Text style={styles.label}>خدمت</Text>
        <Select
          title="انتخاب خدمت"
          placeholder="انتخاب خدمت"
          value={serviceId}
          onChange={handleServiceChange}
          groups={serviceGroups}
          searchable
          searchPlaceholder="جستجوی بخش، گروه یا خدمت..."
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>پرسنل</Text>
        <Select
          title="انتخاب پرسنل"
          placeholder={serviceId ? 'انتخاب پرسنل' : 'اول خدمت را انتخاب کنید'}
          value={staffSelection}
          onChange={(v) => {
            setStaffSelection(v);
            clearResults();
          }}
          options={staffOptions}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>تاریخ</Text>
        <JalaliDatePicker value={date} onChange={handleDateChange} />
      </View>

      <Button onPress={() => void runSearch('day')} disabled={submitDisabled}>
        {loadingMode === 'day' ? (
          <Spinner color={theme.colors.primaryForeground} />
        ) : (
          <Search
            size={theme.sizes.iconSm}
            color={theme.colors.primaryForeground}
            strokeWidth={2}
          />
        )}
        <Text
          style={{
            marginInlineStart: 8,
            color: theme.colors.primaryForeground,
            fontFamily: theme.fonts.sansSemiBold,
            fontSize: theme.fontSize.base,
          }}>
          {loadingMode === 'day' ? 'در حال بررسی…' : 'بررسی زمان'}
        </Text>
      </Button>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {hasResults ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            این زمان‌ها پیشنهادی هستند و تایید نهایی هنگام ثبت نوبت انجام می‌شود.
          </Text>
        </View>
      ) : null}

      {dayResponse ? (
        <>
          <View style={styles.dayHeader}>
            <View>
              <Text style={styles.dayHeaderText}>{formatJalaliFullDate(date)}</Text>
              <Text style={styles.dayHeaderHint}>
                {groupedSlots.length > 0
                  ? `${toPersianDigits(dayResponse.slots.length)} زمان`
                  : 'بدون زمان'}
              </Text>
            </View>
          </View>

          {groupedSlots.length > 0 ? (
            groupedSlots.map((group) => (
              <View key={group.staffId} style={styles.group}>
                <View>
                  <Text style={styles.groupHeader}>{group.staffName}</Text>
                  <Text style={styles.groupSub}>
                    {toPersianDigits(group.slots.length)} زمان قابل رزرو
                  </Text>
                </View>
                {group.slots.map((slot) => (
                  <Pressable
                    key={`${slot.staffId}:${slot.date}:${slot.startTime}`}
                    onPress={() => onSelectSlot({ slot, serviceId })}
                    style={({ pressed }) => [
                      styles.slot,
                      pressed ? { opacity: theme.states.pressed.opacity } : null,
                    ]}>
                    <View>
                      <Text style={styles.slotMain}>
                        {formatPersianTime(slot.startTime)} تا {formatPersianTime(slot.endTime)}
                      </Text>
                      <Text style={styles.slotSub}>رزرو با {slot.staffName}</Text>
                    </View>
                    <Sparkles
                      size={theme.sizes.iconSm}
                      color={theme.colors.primary}
                      strokeWidth={1.8}
                    />
                  </Pressable>
                ))}
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>زمان خالی پیدا نشد</Text>
              <Text style={styles.emptyText}>{emptyReasonCopy(dayResponse.emptyReason)}</Text>
              <Button
                variant="outline"
                onPress={() => void runSearch('nearest')}
                disabled={!serviceId || loadingMode === 'nearest'}>
                {loadingMode === 'nearest' ? (
                  <ActivityIndicator size="small" color={theme.colors.foreground} />
                ) : (
                  <Clock3
                    size={theme.sizes.iconSm}
                    color={theme.colors.foreground}
                    strokeWidth={1.8}
                  />
                )}
                <Text
                  style={{
                    marginInlineStart: 8,
                    color: theme.colors.foreground,
                    fontFamily: theme.fonts.sansSemiBold,
                    fontSize: theme.fontSize.sm,
                  }}>
                  {loadingMode === 'nearest' ? 'در حال جستجو…' : 'نزدیک‌ترین زمان را پیدا کن'}
                </Text>
              </Button>

              {nearestResponse?.slot ? (
                <Pressable
                  onPress={() => onSelectSlot({ slot: nearestResponse.slot!, serviceId })}
                  style={styles.nearest}>
                  <Text style={styles.groupHeader}>نزدیک‌ترین زمان</Text>
                  <Text style={styles.groupSub}>
                    {formatJalaliFullDate(nearestResponse.slot.date)}
                  </Text>
                  <Text style={styles.slotMain}>
                    {formatPersianTime(nearestResponse.slot.startTime)} تا{' '}
                    {formatPersianTime(nearestResponse.slot.endTime)}
                  </Text>
                  <Text style={styles.slotSub}>با {nearestResponse.slot.staffName}</Text>
                </Pressable>
              ) : nearestResponse ? (
                <Text style={styles.emptyText}>{emptyReasonCopy(nearestResponse.emptyReason)}</Text>
              ) : null}
            </View>
          )}
        </>
      ) : null}

      <View style={styles.navRow}>
        <Button variant="outline" onPress={() => handleDayNav(-1)} style={styles.navBtn}>
          <ChevronRight
            size={theme.sizes.iconSm}
            color={theme.colors.foreground}
            strokeWidth={1.8}
          />
          <Text
            style={{
              marginInlineStart: 6,
              color: theme.colors.foreground,
              fontFamily: theme.fonts.sansSemiBold,
              fontSize: theme.fontSize.sm,
            }}>
            روز قبل
          </Text>
        </Button>
        <Button variant="outline" onPress={() => handleDayNav(1)} style={styles.navBtn}>
          <Text
            style={{
              marginInlineEnd: 6,
              color: theme.colors.foreground,
              fontFamily: theme.fonts.sansSemiBold,
              fontSize: theme.fontSize.sm,
            }}>
            روز بعد
          </Text>
          <ChevronLeft
            size={theme.sizes.iconSm}
            color={theme.colors.foreground}
            strokeWidth={1.8}
          />
        </Button>
      </View>
    </AppModal>
  );
}
