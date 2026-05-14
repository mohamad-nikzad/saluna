import * as React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react-native';
import { ApiError, NetworkError } from '@repo/api-client';
import {
  serviceCategoryFormSchema,
  type ServiceCategoryCreateInput,
} from '@repo/salon-core/forms/service';
import type { ServiceCategory } from '@repo/salon-core/types';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { FormRootError, FormSwitchField, FormTextField } from '../ui/form-field';
import { servicesApi } from '../../lib/api';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';

export type ServiceCategoryFormModalProps = {
  open: boolean;
  category: ServiceCategory | null;
  onClose: () => void;
  onSaved: () => void;
};

export function ServiceCategoryFormModal({
  open,
  category,
  onClose,
  onSaved,
}: ServiceCategoryFormModalProps) {
  const { theme } = useTheme();
  const isEdit = Boolean(category);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceCategoryCreateInput>({
    resolver: zodResolver(serviceCategoryFormSchema),
    defaultValues: { name: '', active: true },
  });

  React.useEffect(() => {
    if (!open) return;
    reset(category ? { name: category.name, active: category.active } : { name: '', active: true });
  }, [category, open, reset]);

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
      const payload = serviceCategoryFormSchema.parse(values);
      if (category) await servicesApi.categories.update(category.id, payload);
      else await servicesApi.categories.create(payload);
      onSaved();
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof NetworkError
          ? err.message
          : 'ذخیره بخش انجام نشد.';
      setError('root', { message });
    }
  });

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'ویرایش بخش' : 'بخش جدید'}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
              <X size={theme.sizes.iconSm + 2} color={theme.colors.foreground} strokeWidth={1.8} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <FormTextField
              control={control}
              name="name"
              label="نام بخش"
              placeholder="مثلاً ناخن"
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
