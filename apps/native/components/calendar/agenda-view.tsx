import * as React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarX } from 'lucide-react-native';
import { formatJalaliFullDate, parseGregorianToJalali } from '@repo/salon-core/jalali';
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits';
import { addDaysYmd, salonTodayYmd } from '@repo/salon-core/salon-local-time';
import { formatCompactServiceLabel } from '@repo/salon-core/service-catalog';
import { APPOINTMENT_STATUS, type AppointmentWithDetails } from '@repo/salon-core/types';
import { useTheme, withAlpha } from '../../theme';
import {
  FONTS,
  appointmentsByDay,
  filterByStaff,
  hmToMinutes,
  numFmt,
  staffBorder,
  staffHex,
  staffSoftBg,
  statusPalette,
} from './helpers';
import type { CalendarViewProps } from './types';

const RANGE_DAYS = 14;

export function AgendaView(props: CalendarViewProps) {
  const { cursorYmd, appointments, staffFilter, onSelectAppointment } = props;
  const { theme } = useTheme();
  const todayYmd = salonTodayYmd();

  const filtered = React.useMemo(
    () => filterByStaff(appointments, staffFilter),
    [appointments, staffFilter]
  );
  const dayMap = React.useMemo(() => appointmentsByDay(filtered), [filtered]);

  const days = React.useMemo(() => {
    const ymds: string[] = [];
    for (let i = 0; i < RANGE_DAYS; i++) ymds.push(addDaysYmd(cursorYmd, i));
    return ymds;
  }, [cursorYmd]);

  const sections = days
    .map((ymd) => ({ ymd, items: dayMap.get(ymd) ?? [] }))
    .filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}>
          <CalendarX size={26} color={theme.colors.primary} strokeWidth={1.6} />
        </View>
        <Text
          style={{
            fontFamily: FONTS.semi,
            fontSize: 14,
            color: theme.colors.foreground,
            marginBottom: 6,
          }}>
          نوبتی در دو هفته‌ی پیش‌رو ثبت نشده
        </Text>
        <Text
          style={{
            fontFamily: FONTS.reg,
            fontSize: 12,
            color: theme.colors.mutedForeground,
            textAlign: 'center',
          }}>
          از نمای روز یا ماه برای پیمایش بیشتر استفاده کنید.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 16 }}>
        {sections.map((section) => (
          <DaySection
            key={section.ymd}
            ymd={section.ymd}
            items={section.items}
            isToday={section.ymd === todayYmd}
            onSelectAppointment={onSelectAppointment}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function DaySection({
  ymd,
  items,
  isToday,
  onSelectAppointment,
}: {
  ymd: string;
  items: AppointmentWithDetails[];
  isToday: boolean;
  onSelectAppointment: (appointment: AppointmentWithDetails) => void;
}) {
  const { theme } = useTheme();
  const j = parseGregorianToJalali(ymd);
  const dow = (new Date(ymd + 'T12:00:00').getDay() + 1) % 7;
  const isFriday = dow === 6;
  const totalMinutes = items.reduce(
    (sum, a) => sum + (hmToMinutes(a.endTime) - hmToMinutes(a.startTime)),
    0
  );

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}>
        <View
          style={{
            width: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 6,
            borderRadius: theme.radius.lg,
            backgroundColor: isToday ? theme.colors.primary : theme.colors.card,
            borderWidth: 1,
            borderColor: isToday ? theme.colors.primary : withAlpha(theme.colors.border, 0.7),
          }}>
          <Text
            style={{
              fontFamily: FONTS.bold,
              fontSize: 16,
              color: isToday
                ? theme.colors.primaryForeground
                : isFriday
                  ? theme.colors.ring
                  : theme.colors.foreground,
            }}>
            {numFmt.format(j.jd)}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.med,
              fontSize: 9,
              color: isToday
                ? withAlpha(theme.colors.primaryForeground, 0.8)
                : theme.colors.mutedForeground,
              marginTop: 1,
            }}>
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'][dow]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.semi,
              fontSize: 13,
              color: theme.colors.foreground,
            }}
            numberOfLines={1}>
            {formatJalaliFullDate(ymd)}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.reg,
              fontSize: 11,
              color: theme.colors.mutedForeground,
              marginTop: 2,
            }}>
            {toPersianDigits(items.length)} نوبت · {toPersianDigits(Math.round(totalMinutes / 60))}{' '}
            ساعت کار
          </Text>
        </View>
        {isToday ? (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: theme.radius.full,
              backgroundColor: withAlpha(theme.colors.ring, 0.14),
            }}>
            <Text style={{ fontFamily: FONTS.semi, fontSize: 10, color: theme.colors.ring }}>
              امروز
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        {items.map((apt) => (
          <AgendaRow key={apt.id} appointment={apt} onPress={() => onSelectAppointment(apt)} />
        ))}
      </View>
    </View>
  );
}

function AgendaRow({
  appointment,
  onPress,
}: {
  appointment: AppointmentWithDetails;
  onPress: () => void;
}) {
  const { theme, appointmentStatus } = useTheme();
  const palette = statusPalette(appointment.status);
  const stripeHex = staffHex(appointment.staff.color);
  const tint = staffSoftBg(appointment.staff.color);
  const border = staffBorder(appointment.staff.color);
  const isCancelled = appointment.status === 'cancelled' || appointment.status === 'no-show';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: isCancelled ? theme.colors.border : border,
        overflow: 'hidden',
        opacity: pressed ? 0.85 : 1,
      })}>
      <View
        style={{
          width: 4,
          backgroundColor: isCancelled ? theme.colors.mutedForeground : stripeHex,
        }}
      />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 12,
          gap: 10,
        }}>
        <View
          style={{
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: theme.radius.sm,
            backgroundColor: isCancelled ? theme.colors.muted : tint,
            alignItems: 'center',
            minWidth: 64,
          }}>
          <Text
            style={{
              fontFamily: FONTS.bold,
              fontSize: 12,
              color: isCancelled ? theme.colors.mutedForeground : theme.colors.foreground,
              writingDirection: 'ltr',
            }}>
            {formatPersianTime(appointment.startTime)}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.reg,
              fontSize: 9,
              color: isCancelled
                ? withAlpha(theme.colors.mutedForeground, 0.75)
                : theme.colors.mutedForeground,
              writingDirection: 'ltr',
              marginTop: 1,
            }}>
            تا {formatPersianTime(appointment.endTime)}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONTS.semi,
              fontSize: 13,
              color: theme.colors.foreground,
              textDecorationLine: appointment.status === 'cancelled' ? 'line-through' : 'none',
            }}>
            {appointment.client.name}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONTS.reg,
              fontSize: 11,
              color: theme.colors.mutedForeground,
            }}>
            {formatCompactServiceLabel(appointment.service)} · {appointment.staff.name}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            backgroundColor: appointmentStatus(appointment.status).background || palette.bg,
          }}>
          <Text
            style={{
              fontFamily: FONTS.semi,
              fontSize: 10,
              color: appointmentStatus(appointment.status).foreground || palette.text,
            }}>
            {APPOINTMENT_STATUS[appointment.status].label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
