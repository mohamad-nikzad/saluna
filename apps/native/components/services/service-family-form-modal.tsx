import * as React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react-native';
import { ApiError, NetworkError } from '@repo/api-client';
import {
  serviceFamilyFormSchema,
  type ServiceFamilyCreateInput,
} from '@repo/salon-core/forms/service';
import type { ServiceCategory, ServiceFamily } from '@repo/salon-core/types';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { FormRootError, FormSelectField, FormSwitchField, FormTextField } from '../ui/form-field';
import { servicesApi } from '../../lib/api';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';

export type ServiceFamilyFormModalProps = {
  open: boolean;
  family: ServiceFamily | null;
  categories: ServiceCategory[];
  defaultCategoryId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ServiceFamilyFormModal({
  open,
  family,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: ServiceFamilyFormModalProps) {
  const { theme } = useTheme();
  const isEdit = Boolean(family);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFamilyCreateInput>({
    resolver: zodResolver(serviceFamilyFormSchema),
    defaultValues: { categoryId: defaultCategoryId ?? '', name: '', active: true },
  });

  React.useEffect(() => {
    if (!open) return;
    reset(
      family
        ? { categoryId: family.categoryId, name: family.name, active: family.active }
        : { categoryId: defaultCategoryId ?? categories[0]?.id ?? '', name: '', active: true }
    );
  }, [categories, defaultCategoryId, family, open, reset]);

  const categoryOptions = React.useMemo(
    () => categories.map((category) => ({ value: category.id, label: category.name })),
    [categories]
  );

  const styles = useThemeStyles((t) => ({
    backdrop: {
      flex: 1,
      backgroundColor: withAlpha(t.colors.foreground, 0.45),
      justifyContent: 'flex-end' as const,
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: t.radius.xl,
      borderTopRightRadius: t.radius.xl,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      borderBottomColor: withAlpha(t.colors.border, 0.5),
      borderBottomWidth: t.sizes.hairline,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.lg,
    },
    title: {
      color: t.colors.foreground,
      fontSize: t.fontSize.lg,
      fontFamily: t.fonts.sansBold,
    },
    closeBtn: { padding: t.spacing.sm },
    body: { padding: t.spacing.xl, gap: t.spacing.lg },
    submitText: {
      fontSize: t.fontSize.base,
      color: t.colors.primaryForeground,
      fontFamily: t.fonts.sansSemiBold,
    },
  }));

  const onSubmit = handleSubmit(async (values) => {
    try {
      const payload = serviceFamilyFormSchema.parse(values);
      if (family) await servicesApi.families.update(family.id, payload);
      else await servicesApi.families.create(payload);
      onSaved();
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof NetworkError
          ? err.message
          : 'ذخیره گروه انجام نشد.';
      setError('root', { message });
    }
  });

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'ویرایش گروه خدمات' : 'گروه خدمات جدید'}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
              <X size={theme.sizes.iconSm + 2} color={theme.colors.foreground} strokeWidth={1.8} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <FormSelectField
              control={control}
              name="categoryId"
              label="بخش"
              options={categoryOptions}
              title="انتخاب بخش"
              disabled={isSubmitting}
            />
            <FormTextField
              control={control}
              name="name"
              label="نام گروه"
              placeholder="مثلاً کاشت ناخن"
              editable={!isSubmitting}
            />
            <FormSwitchField control={control} name="active" label="فعال" disabled={isSubmitting} />
            <FormRootError message={errors.root?.message} />
            <Button onPress={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner color={theme.colors.primaryForeground} />
              ) : (
                <Text style={styles.submitText}>{isEdit ? 'ذخیره' : 'افزودن'}</Text>
              )}
            </Button>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
