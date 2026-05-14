import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { AppModal } from '../ui/app-modal';
import { confirmDirtyDismiss } from '../ui/app-sheet';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AppointmentWithDetails, Client, Service, User } from '@repo/salon-core/types';
import {
  APPOINTMENT_DURATION_BOUNDS,
  durationMinutesFromRange,
  endTimeFromDuration,
  validateAppointmentWindow,
} from '@repo/salon-core/appointment-time';
import {
  appointmentFormSchema,
  type AppointmentFormInput,
} from '@repo/salon-core/forms/appointment';
import {
  autoPickServiceForStaff,
  eligibleServicesForStaff,
  eligibleStaffForService,
} from '@repo/salon-core/staff-service-autofill';
import { groupServicesByCatalog } from '@repo/salon-core/service-catalog';
import { parseLocalizedInt, toPersianDigits } from '@repo/salon-core/persian-digits';
import { ApiError } from '@repo/api-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, type SelectGroup, type SelectOption } from '../ui/select';
import { TimePicker } from '../ui/time-picker';
import { Spinner } from '../ui/spinner';
import { FormJalaliDateField, FormRootError, FormTextField, FormTimeField } from '../ui/form-field';
import { appointmentsApi } from '../../lib/api';
import { ClientPicker } from './client-picker';
import { useTheme, useThemeStyles } from '../../theme';

const DURATION_PRESETS = [30, 45, 60, 90, 120];
const CHECKBOX_SIZE = 18;

const numFmt = new Intl.NumberFormat('fa-IR');
function formatPrice(price: number) {
  return `${numFmt.format(price)} تومان`;
}

export type AppointmentEditResult =
  | { type: 'updated'; appointment: AppointmentWithDetails }
  | { type: 'deleted'; id: string };

export type AppointmentEditModalProps = {
  open: boolean;
  onClose: () => void;
  appointment: AppointmentWithDetails | null;
  staff: User[];
  services: Service[];
  clients: Client[];
  onSuccess: (result: AppointmentEditResult) => void;
  onClientCreated?: (client: Client) => void;
};

export function AppointmentEditModal({
  open,
  onClose,
  appointment,
  staff,
  services,
  clients,
  onSuccess,
  onClientCreated,
}: AppointmentEditModalProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [localClients, setLocalClients] = React.useState<Client[]>(clients);
  const wasOpenRef = React.useRef(false);
  const form = useForm<AppointmentFormInput>({
    resolver: zodResolver(appointmentFormSchema, undefined, { raw: true }),
    defaultValues: {
      useTemporaryClient: false,
      clientId: '',
      staffId: '',
      serviceId: '',
      date: '',
      startTime: '09:00',
      endTime: '09:45',
      durationMinutes: 45,
      notes: '',
      temporaryClientName: '',
      temporaryClientNotes: '',
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form;
  const clientId = watch('clientId') ?? '';
  const staffId = watch('staffId') ?? '';
  const serviceId = watch('serviceId') ?? '';
  const startTime = watch('startTime') ?? '09:00';
  const durationMinutes = Number(watch('durationMinutes')) || 45;
  const endTime = watch('endTime') ?? endTimeFromDuration(startTime, durationMinutes);
  const useTemporaryClient = Boolean(watch('useTemporaryClient'));
  const temporaryClientName = watch('temporaryClientName') ?? '';
  const { theme } = useTheme();
  const styles = useThemeStyles((t) => ({
    flex1: { flex: 1, width: '100%' },
    temporaryRow: {
      marginBottom: t.spacing.md,
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: t.spacing.md,
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      padding: t.spacing.lg,
    },
    checkbox: {
      marginTop: t.spacing.xs / 2,
      height: CHECKBOX_SIZE,
      width: CHECKBOX_SIZE,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: t.radius.sm / 2,
      borderWidth: t.sizes.hairline,
    },
    checkboxActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primary },
    checkboxInactive: { borderColor: t.colors.border, backgroundColor: 'transparent' },
    checkboxLabel: {
      fontSize: t.fontSize.base,
      color: t.colors.foreground,
      fontFamily: t.fonts.sansSemiBold,
    },
    checkboxHint: {
      marginTop: t.spacing.xs / 2,
      fontSize: t.fontSize.sm,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sans,
    },
    temporaryFields: { gap: t.spacing.md },
    twoCol: { flexDirection: 'row' as const, gap: t.spacing.md },
    detailsCard: {
      overflow: 'hidden' as const,
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    detailsHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.lg,
    },
    detailsHeaderText: {
      fontSize: t.fontSize.base,
      color: t.colors.foreground,
      fontFamily: t.fonts.sansSemiBold,
    },
    detailsSummary: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.md,
    },
    detailsSummaryText: {
      fontSize: t.fontSize.sm,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sans,
    },
    detailsSummaryTextLtr: {
      fontSize: t.fontSize.sm,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sans,
      writingDirection: 'ltr' as const,
      fontVariant: ['tabular-nums' as const],
    },
    detailsBody: {
      gap: t.spacing.lg,
      borderTopWidth: t.sizes.hairline,
      borderTopColor: t.colors.border,
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.lg,
      paddingTop: t.spacing.lg,
    },
    presetRow: {
      marginBottom: t.spacing.md,
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: t.spacing.sm,
    },
    preset: {
      height: t.sizes.avatarSm,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      paddingHorizontal: t.spacing.lg,
    },
    presetActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primary },
    presetInactive: { borderColor: t.colors.border, backgroundColor: 'transparent' },
    presetText: { fontSize: t.fontSize.sm, fontFamily: t.fonts.sansSemiBold },
    presetTextActive: { color: t.colors.primaryForeground },
    presetTextInactive: { color: t.colors.foreground },
    endHint: {
      marginTop: t.spacing.xs,
      fontSize: t.fontSize.xs,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sans,
    },
    errorText: {
      fontSize: t.fontSize.sm,
      color: t.colors.destructive,
      fontFamily: t.fonts.sansSemiBold,
    },
    submitText: {
      fontSize: t.fontSize.base,
      color: t.colors.primaryForeground,
      fontFamily: t.fonts.sansSemiBold,
    },
    cancelText: {
      fontSize: t.fontSize.base,
      color: t.colors.foreground,
      fontFamily: t.fonts.sansMedium,
    },
    fieldWrap: { gap: t.spacing.sm },
    fieldLabel: {
      fontSize: t.fontSize.sm,
      color: t.colors.foreground,
      fontFamily: t.fonts.sansSemiBold,
    },
    subFieldLabel: {
      fontSize: t.fontSize.sm,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sansMedium,
    },
  }));

  React.useEffect(() => {
    setLocalClients(clients);
  }, [clients]);

  const staffRoleOnly = React.useMemo(() => staff.filter((m) => m.role === 'staff'), [staff]);

  const resetForm = React.useCallback(() => {
    if (!appointment) return;
    setLocalClients(
      appointment.client.isPlaceholder && !clients.some((c) => c.id === appointment.client.id)
        ? [appointment.client, ...clients]
        : clients
    );
    reset({
      useTemporaryClient: appointment.client.isPlaceholder,
      temporaryClientName: appointment.client.isPlaceholder ? appointment.client.name : '',
      temporaryClientNotes: appointment.client.isPlaceholder
        ? (appointment.client.notes ?? '')
        : '',
      clientId: appointment.client.isPlaceholder ? '' : appointment.clientId,
      staffId: appointment.staffId,
      serviceId: appointment.serviceId,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      durationMinutes: durationMinutesFromRange(appointment.startTime, appointment.endTime),
      notes: appointment.notes ?? '',
    });
    setShowDetails(false);
  }, [appointment, clients, reset]);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) resetForm();
    wasOpenRef.current = open;
  }, [open, resetForm]);

  const applyDuration = (mins: number) => {
    const clamped = Math.min(
      APPOINTMENT_DURATION_BOUNDS.max,
      Math.max(APPOINTMENT_DURATION_BOUNDS.min, mins)
    );
    setValue('durationMinutes', clamped, { shouldDirty: true });
    setValue('endTime', endTimeFromDuration(startTime, clamped), { shouldDirty: true });
  };

  const applyEndTime = (et: string) => {
    setValue('endTime', et, { shouldDirty: true });
    try {
      const d = durationMinutesFromRange(startTime, et);
      if (d > 0) setValue('durationMinutes', d, { shouldDirty: true });
    } catch {
      /* invalid time */
    }
  };

  const syncEndTimeWithStart = React.useCallback(
    (st: string) => {
      setValue('endTime', endTimeFromDuration(st, durationMinutes), {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [durationMinutes, setValue]
  );

  const handleServiceChange = (id: string) => {
    setValue('serviceId', id, { shouldDirty: true, shouldValidate: true });
    const svc = services.find((s) => s.id === id);
    if (svc) applyDuration(svc.duration);
    const eligibleAll = eligibleStaffForService(staff, id);
    const eligibleStaffMembers = eligibleStaffForService(staffRoleOnly, id);
    if (eligibleStaffMembers.length === 1) {
      setValue('staffId', eligibleStaffMembers[0].id, { shouldDirty: true, shouldValidate: true });
    } else if (!eligibleAll.some((m) => m.id === staffId)) {
      setValue('staffId', '', { shouldDirty: true, shouldValidate: true });
    }
  };

  const handleStaffChange = (id: string) => {
    setValue('staffId', id, { shouldDirty: true, shouldValidate: true });
    const member = staff.find((s) => s.id === id);
    if (!member) return;
    const eligible = eligibleServicesForStaff(member, services);
    const current = services.find((s) => s.id === serviceId);
    const serviceStillOk = !!current && eligible.some((s) => s.id === serviceId);
    if (!serviceStillOk) {
      const explicitList = member.serviceIds != null && member.serviceIds.length > 0;
      const auto = autoPickServiceForStaff(eligible, {
        staffHasExplicitServiceList: explicitList,
      });
      if (auto) {
        setValue('serviceId', auto.id, { shouldDirty: true, shouldValidate: true });
        applyDuration(auto.duration);
      } else {
        setValue('serviceId', '', { shouldDirty: true, shouldValidate: true });
      }
    }
  };

  const handleClientCreated = (newClient: Client) => {
    setLocalClients((prev) => [newClient, ...prev]);
    onClientCreated?.(newClient);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!appointment) return;
    const localCheck = validateAppointmentWindow(values.startTime, values.endTime);
    if (!localCheck.ok) {
      setError('root', { message: localCheck.error });
      return;
    }
    try {
      const payload = appointmentFormSchema.parse(values);
      const result = await appointmentsApi.update(appointment.id, payload);
      if (result.removedAppointmentId) {
        onSuccess({ type: 'deleted', id: result.removedAppointmentId });
      } else if (result.appointment) {
        onSuccess({ type: 'updated', appointment: result.appointment });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'خطایی رخ داد';
      setError('root', { message: msg });
    }
  });

  const staffOptions: SelectOption[] = staffRoleOnly.map((member) => ({
    value: member.id,
    label: member.name,
  }));

  const serviceGroups: SelectGroup[] = React.useMemo(() => {
    return groupServicesByCatalog(services.filter((service) => service.active)).flatMap(
      (category) =>
        category.families.map((family) => ({
          label: `${category.categoryName} / ${family.familyName}`,
          options: family.services.map((service) => ({
            value: service.id,
            label: service.name,
            detail: `پیشنهاد ${toPersianDigits(service.duration)} دقیقه — ${formatPrice(service.price)}`,
          })),
        }))
    );
  }, [services]);

  const submitDisabled =
    isSubmitting ||
    !serviceId ||
    !staffId ||
    (useTemporaryClient ? !temporaryClientName.trim() : !clientId);

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );

  const SubField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.subFieldLabel}>{label}</Text>
      {children}
    </View>
  );

  const { formState } = form;
  const requestDismiss = React.useCallback(async () => {
    if (formState.isSubmitting) return false;
    if (!formState.isDirty) return true;
    return confirmDirtyDismiss();
  }, [formState.isDirty, formState.isSubmitting]);

  return (
    <AppModal
      visible={open}
      onClose={onClose}
      onRequestDismiss={requestDismiss}
      header={{ title: 'ویرایش نوبت', subtitle: 'اطلاعات نوبت را به‌روز کنید' }}
      footer={
        <>
          <Button onPress={onSubmit} disabled={submitDisabled}>
            {isSubmitting ? <Spinner color={theme.colors.primaryForeground} /> : null}
            <Text style={styles.submitText}>
              {isSubmitting ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </Text>
          </Button>
          <Button variant="outline" onPress={onClose} disabled={isSubmitting}>
            <Text style={styles.cancelText}>انصراف</Text>
          </Button>
        </>
      }>
      <Field label="مشتری">
        <Pressable
          onPress={() => {
            const next = !useTemporaryClient;
            setValue('useTemporaryClient', next, {
              shouldDirty: true,
              shouldValidate: true,
            });
            if (next) {
              setValue('clientId', '', { shouldDirty: true });
            } else {
              setValue('temporaryClientName', '', { shouldDirty: true });
              setValue('temporaryClientNotes', '', { shouldDirty: true });
            }
          }}
          style={styles.temporaryRow}>
          <View
            style={[
              styles.checkbox,
              useTemporaryClient ? styles.checkboxActive : styles.checkboxInactive,
            ]}>
            {useTemporaryClient ? (
              <Check size={12} color={theme.colors.primaryForeground} strokeWidth={3} />
            ) : null}
          </View>
          <View style={styles.flex1}>
            <Text style={styles.checkboxLabel}>بعداً اطلاعات مشتری را کامل می‌کنم</Text>
            <Text style={styles.checkboxHint}>برای این حالت فقط نام لازم است.</Text>
          </View>
        </Pressable>

        {useTemporaryClient ? (
          <View style={styles.temporaryFields}>
            <FormTextField
              control={control}
              name="temporaryClientName"
              label="نام مشتری"
              placeholder="مثلاً دوستِ سارا"
            />
            <FormTextField
              control={control}
              name="temporaryClientNotes"
              label="یادداشت (اختیاری)"
              placeholder="مثلاً شماره را بعداً می‌گیرم"
            />
          </View>
        ) : (
          <ClientPicker
            clients={localClients}
            value={clientId}
            onChange={(id) =>
              setValue('clientId', id, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            onClientCreated={handleClientCreated}
          />
        )}
        {errors.clientId ? <Text style={styles.errorText}>{errors.clientId.message}</Text> : null}
      </Field>

      <Field label="پرسنل">
        <Controller
          control={control}
          name="staffId"
          render={({ field }) => (
            <Select
              title="انتخاب پرسنل"
              placeholder="انتخاب پرسنل"
              value={field.value ?? ''}
              onChange={handleStaffChange}
              options={staffOptions}
            />
          )}
        />
        {errors.staffId ? <Text style={styles.errorText}>{errors.staffId.message}</Text> : null}
      </Field>

      <Field label="خدمت">
        <Controller
          control={control}
          name="serviceId"
          render={({ field }) => (
            <Select
              title="انتخاب خدمت"
              placeholder="انتخاب خدمت"
              value={field.value ?? ''}
              onChange={handleServiceChange}
              groups={serviceGroups}
              searchable
              searchPlaceholder="جستجوی بخش، گروه یا خدمت..."
            />
          )}
        />
        {errors.serviceId ? <Text style={styles.errorText}>{errors.serviceId.message}</Text> : null}
      </Field>

      <View style={styles.twoCol}>
        <View style={styles.flex1}>
          <FormJalaliDateField control={control} name="date" label="تاریخ" />
        </View>
        <View style={styles.flex1}>
          <FormTimeField
            control={control}
            name="startTime"
            label="شروع"
            pickerLabel="ساعت شروع"
            onTimeChange={syncEndTimeWithStart}
          />
        </View>
      </View>

      <View style={styles.detailsCard}>
        <Pressable onPress={() => setShowDetails((v) => !v)} style={styles.detailsHeader}>
          <Text style={styles.detailsHeaderText}>جزئیات زمان و توضیحات</Text>
          <View style={styles.detailsSummary}>
            <Text style={styles.detailsSummaryTextLtr}>{toPersianDigits(endTime)}</Text>
            <Text style={styles.detailsSummaryText}>{toPersianDigits(durationMinutes)} دقیقه</Text>
          </View>
        </Pressable>

        {showDetails ? (
          <View style={styles.detailsBody}>
            <SubField label="مدت (دقیقه)">
              <View style={styles.presetRow}>
                {DURATION_PRESETS.map((m) => {
                  const active = durationMinutes === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => applyDuration(m)}
                      style={[styles.preset, active ? styles.presetActive : styles.presetInactive]}>
                      <Text
                        style={[
                          styles.presetText,
                          active ? styles.presetTextActive : styles.presetTextInactive,
                        ]}>
                        {numFmt.format(m)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input
                value={toPersianDigits(durationMinutes)}
                onChangeText={(t) => {
                  const v = parseLocalizedInt(t, durationMinutes);
                  if (!Number.isFinite(v)) return;
                  applyDuration(v);
                }}
                keyboardType="number-pad"
              />
              {errors.durationMinutes ? (
                <Text style={styles.errorText}>{errors.durationMinutes.message}</Text>
              ) : null}
            </SubField>

            <SubField label="پایان">
              <Controller
                control={control}
                name="endTime"
                render={({ field }) => (
                  <TimePicker
                    value={field.value ?? endTime}
                    onChange={applyEndTime}
                    label="ساعت پایان"
                  />
                )}
              />
              <Text style={styles.endHint}>تغییر پایان، مدت را هم‌زمان به‌روز می‌کند.</Text>
              {errors.endTime ? (
                <Text style={styles.errorText}>{errors.endTime.message}</Text>
              ) : null}
            </SubField>

            <FormTextField
              control={control}
              name="notes"
              label="توضیحات (اختیاری)"
              placeholder="توضیحات اضافی…"
            />
          </View>
        ) : null}
      </View>

      <FormRootError message={errors.root?.message} />
    </AppModal>
  );
}
