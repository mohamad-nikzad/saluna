import * as React from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { type Service, type User } from '@repo/salon-core/types';
import { toPersianDigits } from '@repo/salon-core/persian-digits';
import { groupServicesByCatalog } from '@repo/salon-core/service-catalog';
import { ApiError, NetworkError } from '@repo/api-client';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { staffApi } from '../../lib/api';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';

export type StaffServicesModalProps = {
  open: boolean;
  staff: User | null;
  services: Service[];
  onClose: () => void;
  onSaved: () => void;
};

export function StaffServicesModal({
  open,
  staff,
  services,
  onClose,
  onSaved,
}: StaffServicesModalProps) {
  const { theme } = useTheme();
  const [selected, setSelected] = React.useState<Set<string> | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !staff) return;
    setSelected(staff.serviceIds == null ? null : new Set(staff.serviceIds));
    setErrorMessage(null);
  }, [open, staff]);

  const activeServices = React.useMemo(() => services.filter((s) => s.active), [services]);
  const serviceGroups = React.useMemo(
    () => groupServicesByCatalog(activeServices),
    [activeServices]
  );

  const unrestricted = selected == null;

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
    subtitle: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
      marginTop: t.spacing.xs,
    },
    closeBtn: { padding: t.spacing.sm },
    body: { padding: t.spacing.xl, gap: t.spacing.lg },
    switchCard: {
      borderColor: t.colors.border,
      borderWidth: t.sizes.hairline,
      borderRadius: t.radius.lg,
      padding: t.spacing.lg,
      gap: t.spacing.md,
      backgroundColor: t.colors.card,
    },
    switchRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: t.spacing.md,
    },
    switchLabel: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansSemiBold,
    },
    switchHint: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sans,
    },
    categoryWrap: { gap: t.spacing.lg },
    categoryLabel: {
      color: t.colors.foreground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansSemiBold,
      marginBottom: t.spacing.xs,
    },
    familyLabel: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sansMedium,
      marginTop: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    serviceRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: t.radius.sm,
      borderWidth: t.sizes.hairline,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    checkboxOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    checkboxOff: { backgroundColor: 'transparent', borderColor: t.colors.border },
    serviceBody: { flex: 1, minWidth: 0 },
    serviceName: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sans,
    },
    serviceMeta: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    error: {
      color: t.colors.destructive,
      fontFamily: t.fonts.sansMedium,
      fontSize: t.fontSize.sm,
    },
    submitText: {
      color: t.colors.primaryForeground,
      fontFamily: t.fonts.sansSemiBold,
      fontSize: t.fontSize.base,
    },
  }));

  const toggleService = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onUnrestrictedChange = (value: boolean) => {
    if (value) setSelected(null);
    else setSelected(new Set(activeServices.map((s) => s.id)));
  };

  const handleSave = async () => {
    if (!staff) return;
    setErrorMessage(null);
    if (selected != null && selected.size === 0) {
      setErrorMessage('حداقل یک خدمت انتخاب کنید، یا حالت «همه خدمات» را فعال بگذارید.');
      return;
    }
    setSaving(true);
    try {
      await staffApi.updateServices(staff.id, {
        serviceIds: selected == null ? null : [...selected],
      });
      onSaved();
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof NetworkError
          ? err.message
          : 'ذخیره خدمات انجام نشد.';
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>خدمات مجاز</Text>
              {staff ? <Text style={styles.subtitle}>{staff.name}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeBtn}>
              <X size={theme.sizes.iconSm + 2} color={theme.colors.foreground} strokeWidth={1.8} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.switchCard}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>همه خدمات فعال</Text>
                  <Text style={styles.switchHint}>
                    اگر روشن باشد، پرسنل می‌تواند هر خدمت فعال را انجام دهد.
                  </Text>
                </View>
                <Switch
                  value={unrestricted}
                  onValueChange={onUnrestrictedChange}
                  disabled={!staff}
                />
              </View>
            </View>

            {!unrestricted ? (
              <View style={styles.categoryWrap}>
                {serviceGroups.map((category) => (
                  <View key={category.categoryId}>
                    <Text style={styles.categoryLabel}>{category.categoryName}</Text>
                    {category.families.map((family) => (
                      <View key={family.familyId}>
                        <Text style={styles.familyLabel}>{family.familyName}</Text>
                        {family.services.map((svc) => {
                          const on = selected?.has(svc.id) ?? false;
                          return (
                            <Pressable
                              key={svc.id}
                              onPress={() => toggleService(svc.id)}
                              style={styles.serviceRow}>
                              <View
                                style={[
                                  styles.checkbox,
                                  on ? styles.checkboxOn : styles.checkboxOff,
                                ]}>
                                {on ? (
                                  <Check
                                    size={14}
                                    color={theme.colors.primaryForeground}
                                    strokeWidth={3}
                                  />
                                ) : null}
                              </View>
                              <View style={styles.serviceBody}>
                                <Text style={styles.serviceName} numberOfLines={1}>
                                  {svc.name}
                                </Text>
                                <Text style={styles.serviceMeta}>
                                  {toPersianDigits(svc.duration)} دقیقه
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}

            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

            <Button onPress={handleSave} disabled={saving || !staff}>
              {saving ? (
                <Spinner color={theme.colors.primaryForeground} />
              ) : (
                <Text style={styles.submitText}>ذخیره</Text>
              )}
            </Button>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
