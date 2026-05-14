import * as React from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { AppSheet } from '../ui/app-sheet';
import {
  Clock,
  Phone,
  Pencil,
  Scissors,
  StickyNote,
  Trash2,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react-native';
import { APPOINTMENT_STATUS, type AppointmentWithDetails } from '@repo/salon-core/types';
import { ApiError } from '@repo/api-client';
import { appointmentsApi } from '../../lib/api';
import { useAuth } from '../auth-provider';
import { formatJalaliFullDate } from '@repo/salon-core/jalali';
import { formatPersianTime, toPersianDigits } from '@repo/salon-core/persian-digits';
import { formatCompactServiceLabel } from '@repo/salon-core/service-catalog';
import { useTheme, withAlpha } from '../../theme';
import { FONTS, hmToMinutes, staffBorder, staffHex, staffSoftBg, statusPalette } from './helpers';

export type AppointmentSheetChange =
  | { type: 'updated'; appointment: AppointmentWithDetails }
  | { type: 'deleted'; id: string };

export function AppointmentSheet({
  appointment,
  onClose,
  onChange,
  onEdit,
  onCompleteClient,
}: {
  appointment: AppointmentWithDetails | null;
  onClose: () => void;
  onChange?: (change: AppointmentSheetChange) => void;
  onEdit?: (appointment: AppointmentWithDetails) => void;
  onCompleteClient?: (appointment: AppointmentWithDetails) => void;
}) {
  const visible = appointment != null;

  return (
    <AppSheet visible={visible} onClose={onClose} hideHandle>
      {appointment ? (
        <SheetContent
          appointment={appointment}
          onClose={onClose}
          onChange={onChange}
          onEdit={onEdit}
          onCompleteClient={onCompleteClient}
        />
      ) : null}
    </AppSheet>
  );
}

function SheetContent({
  appointment,
  onClose,
  onChange,
  onEdit,
  onCompleteClient,
}: {
  appointment: AppointmentWithDetails;
  onClose: () => void;
  onChange?: (change: AppointmentSheetChange) => void;
  onEdit?: (appointment: AppointmentWithDetails) => void;
  onCompleteClient?: (appointment: AppointmentWithDetails) => void;
}) {
  const { user } = useAuth();
  const { theme, appointmentStatus } = useTheme();
  const isManager = user?.role === 'manager';
  const isOwnAppointment = user?.role === 'staff' && appointment.staffId === user.id;
  const canChangeStatus = isManager || isOwnAppointment;

  const [pending, setPending] = React.useState<AppointmentWithDetails['status'] | null>(null);
  const [error, setError] = React.useState<string>('');
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setPending(null);
    setError('');
    setDeleting(false);
  }, [appointment.id]);

  const handleCallPhone = () => {
    const phone = appointment.client.phone;
    if (!phone) return;
    const url = `tel:${phone}`;
    void Linking.canOpenURL(url).then((can) => {
      if (can) Linking.openURL(url);
      else Alert.alert('شماره در دسترس نیست');
    });
  };

  const performDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      await appointmentsApi.delete(appointment.id);
      onChange?.({ type: 'deleted', id: appointment.id });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حذف نوبت انجام نشد');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('حذف نوبت', 'آیا از حذف این نوبت مطمئن هستید؟', [
      { text: 'انصراف', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => void performDelete() },
    ]);
  };

  const handleStatusChange = async (next: AppointmentWithDetails['status']) => {
    setError('');
    setPending(next);
    try {
      const res = await appointmentsApi.updateStatus(appointment.id, next);
      if (res.removedAppointmentId) {
        onChange?.({ type: 'deleted', id: res.removedAppointmentId });
      } else if (res.appointment) {
        onChange?.({ type: 'updated', appointment: res.appointment });
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تغییر وضعیت انجام نشد');
    } finally {
      setPending(null);
    }
  };

  const palette = statusPalette(appointment.status);
  const themedStatus = appointmentStatus(appointment.status);
  const stripe = staffHex(appointment.staff.color);
  const tint = staffSoftBg(appointment.staff.color);
  const border = staffBorder(appointment.staff.color);

  const durationMin = hmToMinutes(appointment.endTime) - hmToMinutes(appointment.startTime);
  const isCancelled = appointment.status === 'cancelled' || appointment.status === 'no-show';

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14 }}
      showsVerticalScrollIndicator={false}>
      {/* Drag handle */}
      <View
        style={{
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.border,
          marginBottom: 12,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONTS.bold,
              fontSize: 18,
              color: theme.colors.foreground,
              textDecorationLine: appointment.status === 'cancelled' ? 'line-through' : 'none',
            }}>
            {appointment.client.name}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.reg,
              fontSize: 12,
              color: theme.colors.mutedForeground,
            }}>
            {formatJalaliFullDate(appointment.date)}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityLabel="بستن"
          hitSlop={6}
          style={{
            width: 44,
            height: 44,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.muted,
          }}>
          <X size={16} color={theme.colors.foreground} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Status pill */}
      <View
        style={{
          alignSelf: 'flex-start',
          marginTop: 12,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: theme.radius.full,
          backgroundColor: themedStatus.background || palette.bg,
          borderWidth: 1,
          borderColor: themedStatus.border || palette.border,
        }}>
        <Text
          style={{
            fontFamily: FONTS.semi,
            fontSize: 11,
            color: themedStatus.foreground || palette.text,
          }}>
          {APPOINTMENT_STATUS[appointment.status].label}
        </Text>
      </View>

      {/* Time card with staff color stripe */}
      <View
        style={{
          marginTop: 16,
          flexDirection: 'row',
          backgroundColor: isCancelled ? theme.colors.muted : tint,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: isCancelled ? theme.colors.border : border,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: 4,
            backgroundColor: isCancelled ? theme.colors.mutedForeground : stripe,
          }}
        />
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            gap: 12,
          }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: theme.radius.md,
              backgroundColor: withAlpha(theme.colors.card, 0.78),
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Clock size={18} color={theme.colors.foreground} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: FONTS.bold,
                fontSize: 16,
                color: theme.colors.foreground,
                writingDirection: 'ltr',
              }}>
              {formatPersianTime(appointment.startTime)} – {formatPersianTime(appointment.endTime)}
            </Text>
            <Text
              style={{
                fontFamily: FONTS.reg,
                fontSize: 11,
                color: theme.colors.mutedForeground,
                marginTop: 2,
              }}>
              مدت زمان: {toPersianDigits(durationMin)} دقیقه
            </Text>
          </View>
        </View>
      </View>

      {/* Detail rows */}
      <View style={{ marginTop: 14, gap: 10 }}>
        <DetailRow
          icon={<Scissors size={16} color={theme.colors.foreground} strokeWidth={1.8} />}
          label="خدمت"
          value={formatCompactServiceLabel(appointment.service)}
          hint={
            appointment.service.duration
              ? `${toPersianDigits(appointment.service.duration)} دقیقه`
              : undefined
          }
        />
        <DetailRow
          icon={<UserIcon size={16} color={theme.colors.foreground} strokeWidth={1.8} />}
          label="آرایشگر"
          value={appointment.staff.name}
          rightDecor={
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: theme.radius.full,
                backgroundColor: stripe,
              }}
            />
          }
        />
        {appointment.client.phone ? (
          <Pressable onPress={handleCallPhone} accessibilityLabel="تماس با مشتری">
            <DetailRow
              icon={<Phone size={16} color={theme.colors.foreground} strokeWidth={1.8} />}
              label="تماس با مشتری"
              value={appointment.client.phone}
              valueLtr
            />
          </Pressable>
        ) : null}
        {appointment.notes ? (
          <DetailRow
            icon={<StickyNote size={16} color={theme.colors.foreground} strokeWidth={1.8} />}
            label="یادداشت"
            value={appointment.notes}
            multiline
          />
        ) : null}
      </View>

      {canChangeStatus ? (
        <StatusActions
          status={appointment.status}
          isManager={isManager}
          pending={pending}
          onPress={handleStatusChange}
        />
      ) : null}

      {isManager ? (
        <View
          style={{
            marginTop: 16,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}>
          {appointment.client.isPlaceholder && onCompleteClient ? (
            <Pressable
              onPress={() => onCompleteClient(appointment)}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: '45%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.85 : 1,
              })}>
              <UserPlus size={16} color={theme.colors.primaryForeground} strokeWidth={2} />
              <Text
                style={{
                  fontFamily: FONTS.semi,
                  fontSize: 13,
                  color: theme.colors.primaryForeground,
                }}>
                تکمیل اطلاعات مشتری
              </Text>
            </Pressable>
          ) : null}
          {onEdit ? (
            <Pressable
              onPress={() => onEdit(appointment)}
              style={({ pressed }) => ({
                flexGrow: 1,
                flexBasis: '45%',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                opacity: pressed ? 0.85 : 1,
              })}>
              <Pencil size={16} color={theme.colors.foreground} strokeWidth={2} />
              <Text
                style={{ fontFamily: FONTS.semi, fontSize: 13, color: theme.colors.foreground }}>
                ویرایش
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleDelete}
            disabled={deleting}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: '45%',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: withAlpha(theme.colors.destructive, 0.4),
              backgroundColor: theme.colors.card,
              opacity: deleting ? 0.6 : pressed ? 0.85 : 1,
            })}>
            {deleting ? (
              <ActivityIndicator size="small" color={theme.colors.destructive} />
            ) : (
              <Trash2 size={16} color={theme.colors.destructive} strokeWidth={2} />
            )}
            <Text style={{ fontFamily: FONTS.semi, fontSize: 13, color: theme.colors.destructive }}>
              حذف نوبت
            </Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text
          style={{
            marginTop: 12,
            fontFamily: FONTS.med,
            fontSize: 12,
            color: theme.colors.destructive,
            textAlign: 'center',
          }}>
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function StatusActions({
  status,
  isManager,
  pending,
  onPress,
}: {
  status: AppointmentWithDetails['status'];
  isManager: boolean;
  pending: AppointmentWithDetails['status'] | null;
  onPress: (next: AppointmentWithDetails['status']) => void;
}) {
  const { theme } = useTheme();
  type Action = {
    key: AppointmentWithDetails['status'];
    label: string;
    tone: 'primary' | 'neutral' | 'danger';
  };

  const actions: Action[] = [];
  if (status === 'scheduled') {
    actions.push({ key: 'confirmed', label: 'تایید نوبت', tone: 'primary' });
    if (isManager) actions.push({ key: 'cancelled', label: 'لغو', tone: 'danger' });
  } else if (status === 'confirmed') {
    actions.push({ key: 'completed', label: 'انجام شد', tone: 'primary' });
    actions.push({ key: 'no-show', label: 'غیبت', tone: 'neutral' });
  }

  if (actions.length === 0) return null;

  return (
    <View
      style={{
        marginTop: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      }}>
      {actions.map((action) => {
        const isPending = pending === action.key;
        const disabled = pending != null;
        const palette = actionPalette(action.tone, theme);
        return (
          <Pressable
            key={action.key}
            onPress={() => onPress(action.key)}
            disabled={disabled}
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: '45%',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: palette.border,
              backgroundColor: palette.bg,
              opacity: disabled && !isPending ? 0.5 : pressed ? 0.85 : 1,
            })}>
            {isPending ? <ActivityIndicator size="small" color={palette.text} /> : null}
            <Text
              style={{
                fontFamily: FONTS.semi,
                fontSize: 13,
                color: palette.text,
              }}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function actionPalette(
  tone: 'primary' | 'neutral' | 'danger',
  theme: ReturnType<typeof useTheme>['theme']
) {
  if (tone === 'primary') {
    return {
      bg: theme.colors.primary,
      border: theme.colors.primary,
      text: theme.colors.primaryForeground,
    };
  }
  if (tone === 'danger') {
    return {
      bg: theme.colors.card,
      border: withAlpha(theme.colors.destructive, 0.4),
      text: theme.colors.destructive,
    };
  }
  return {
    bg: theme.colors.card,
    border: theme.colors.border,
    text: theme.colors.foreground,
  };
}

function DetailRow({
  icon,
  label,
  value,
  hint,
  multiline,
  valueLtr,
  rightDecor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  multiline?: boolean;
  valueLtr?: boolean;
  rightDecor?: React.ReactNode;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: withAlpha(theme.colors.border, 0.6),
        padding: 12,
      }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: theme.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.muted,
        }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONTS.med,
            fontSize: 10,
            color: theme.colors.mutedForeground,
            marginBottom: 2,
          }}>
          {label}
        </Text>
        <Text
          numberOfLines={multiline ? undefined : 2}
          style={{
            fontFamily: FONTS.semi,
            fontSize: 13,
            color: theme.colors.foreground,
            writingDirection: valueLtr ? 'ltr' : 'rtl',
          }}>
          {value}
        </Text>
        {hint ? (
          <Text
            style={{
              fontFamily: FONTS.reg,
              fontSize: 11,
              color: theme.colors.mutedForeground,
              marginTop: 2,
            }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {rightDecor ? <View style={{ alignSelf: 'center' }}>{rightDecor}</View> : null}
    </View>
  );
}
