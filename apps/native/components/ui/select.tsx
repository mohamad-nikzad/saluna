import * as React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, Search } from 'lucide-react-native';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';
import { AppSheet } from './app-sheet';
import { ModalHeader } from './modal-header';
import { AppText } from './app-text';

export type SelectOption = {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
};

export type SelectGroup = {
  label?: string;
  options: SelectOption[];
};

export type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  options?: SelectOption[];
  groups?: SelectGroup[];
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function Select({
  value,
  onChange,
  placeholder = 'انتخاب کنید',
  title,
  options,
  groups,
  disabled,
  searchable,
  searchPlaceholder = 'جستجو...',
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const { theme } = useTheme();
  const styles = useThemeStyles((t) => ({
    trigger: {
      height: t.sizes.controlLg,
      width: '100%' as const,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.input,
      backgroundColor: t.colors.background,
      paddingHorizontal: t.spacing.lg,
    },
    triggerDisabled: { opacity: t.states.disabled.opacity },
    triggerText: {
      fontSize: t.fontSize.base,
      flex: 1,
      // writingDirection: 'rtl' as const,
    },
    triggerTextSelected: { color: t.colors.foreground },
    triggerTextPlaceholder: { color: t.colors.mutedForeground },
    list: { maxHeight: 480 },
    listInner: {
      paddingHorizontal: t.spacing.md,
      paddingBottom: t.spacing.md,
    },
    searchWrap: {
      marginHorizontal: t.spacing.md,
      marginBottom: t.spacing.sm,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.sm,
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      borderColor: t.colors.input,
      backgroundColor: t.colors.background,
      paddingHorizontal: t.spacing.md,
    },
    searchInput: {
      flex: 1,
      minHeight: t.sizes.controlLg,
      color: t.colors.foreground,
      fontFamily: t.fonts.sans,
      fontSize: t.fontSize.base,
      textAlign: 'right' as const,
    },
    groupLabel: {
      fontSize: t.fontSize.sm,
      color: t.colors.mutedForeground,
      fontFamily: t.fonts.sansMedium,
      paddingHorizontal: t.spacing.lg,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.xs,
    },
  }));

  const allOptions = React.useMemo(() => {
    if (groups) return groups.flatMap((g) => g.options);
    return options ?? [];
  }, [options, groups]);

  const normalizedQuery = query.trim().toLocaleLowerCase('fa');
  const optionMatches = React.useCallback(
    (option: SelectOption, groupLabel?: string) => {
      if (!normalizedQuery) return true;
      return `${groupLabel ?? ''} ${option.label} ${option.detail ?? ''}`
        .toLocaleLowerCase('fa')
        .includes(normalizedQuery);
    },
    [normalizedQuery]
  );

  const visibleGroups = React.useMemo(() => {
    if (!groups) return undefined;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => optionMatches(option, group.label)),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, optionMatches]);

  const visibleOptions = React.useMemo(
    () => (options ?? []).filter((option) => optionMatches(option)),
    [optionMatches, options]
  );

  const selected = allOptions.find((o) => o.value === value);
  const displayText = selected?.label ?? placeholder;

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <>
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        accessibilityLabel={title ?? placeholder}
        style={[styles.trigger, disabled && styles.triggerDisabled]}>
        <AppText
          style={[
            styles.triggerText,
            selected ? styles.triggerTextSelected : styles.triggerTextPlaceholder,
          ]}
          numberOfLines={1}>
          {displayText}
        </AppText>
        <ChevronDown size={theme.sizes.iconSm} color={theme.iconColors.muted} strokeWidth={1.6} />
      </Pressable>

      <AppSheet visible={open} onClose={() => setOpen(false)}>
        {title ? <ModalHeader title={title} onClose={() => setOpen(false)} borderless /> : null}
        {searchable ? (
          <View style={styles.searchWrap}>
            <Search size={theme.sizes.iconSm} color={theme.iconColors.muted} strokeWidth={1.7} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.colors.mutedForeground}
              style={styles.searchInput}
            />
          </View>
        ) : null}
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          <View style={styles.listInner}>
            {groups
              ? (visibleGroups ?? []).map((g, gi) => (
                  <View key={gi}>
                    {g.label ? <Text style={styles.groupLabel}>{g.label}</Text> : null}
                    {g.options.map((opt) => (
                      <OptionRow
                        key={opt.value}
                        option={opt}
                        selected={opt.value === value}
                        onPress={() => {
                          if (opt.disabled) return;
                          onChange(opt.value);
                          setOpen(false);
                        }}
                      />
                    ))}
                  </View>
                ))
              : visibleOptions.map((opt) => (
                  <OptionRow
                    key={opt.value}
                    option={opt}
                    selected={opt.value === value}
                    onPress={() => {
                      if (opt.disabled) return;
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  />
                ))}
          </View>
        </ScrollView>
      </AppSheet>
    </>
  );
}

function OptionRow({
  option,
  selected,
  onPress,
}: {
  option: SelectOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useThemeStyles((t) => ({
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.lg,
      minHeight: t.sizes.controlLg,
      borderRadius: t.radius.md,
      gap: t.spacing.md,
    },
    checkPlaceholder: { width: t.sizes.iconSm },
    contentWrap: { flex: 1 },
    label: {
      fontFamily: t.fonts.sansMedium,
      fontSize: t.fontSize.md,
      color: t.colors.foreground,
    },
    detail: {
      fontFamily: t.fonts.sans,
      fontSize: t.fontSize.sm,
      color: t.colors.mutedForeground,
      marginTop: t.spacing.xs / 2,
    },
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={option.disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!option.disabled }}
      accessibilityLabel={option.label}
      style={({ pressed }) => [
        styles.row,
        {
          opacity: option.disabled
            ? theme.states.disabled.opacity
            : pressed
              ? theme.states.pressed.opacity
              : 1,
          backgroundColor: selected ? withAlpha(theme.colors.accent, 0.25) : 'transparent',
        },
      ]}>
      {selected ? (
        <Check size={theme.sizes.iconSm} color={theme.colors.primary} strokeWidth={2} />
      ) : (
        <View style={styles.checkPlaceholder} />
      )}
      <View style={styles.contentWrap}>
        <Text style={styles.label} numberOfLines={2}>
          {option.label}
        </Text>
        {option.detail ? <Text style={styles.detail}>{option.detail}</Text> : null}
      </View>
    </Pressable>
  );
}
