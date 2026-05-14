import * as React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  ChevronDown,
  ChevronLeft,
  FolderPlus,
  Layers3,
  Pencil,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react-native';
import type { Service, ServiceCategory, ServiceFamily } from '@repo/salon-core/types';
import { toPersianDigits } from '@repo/salon-core/persian-digits';
import { Button } from '../ui/button';
import { AppText } from '../ui/app-text';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import { servicesApi } from '../../lib/api';
import { useAsyncResource } from '../../lib/hooks/use-async-resource';
import { useTheme, useThemeStyles, withAlpha } from '../../theme';
import { ServiceCategoryFormModal } from './service-category-form-modal';
import { ServiceFamilyFormModal } from './service-family-form-modal';
import { ServiceFormModal } from './service-form-modal';

type CategoryNode = ServiceCategory & {
  families: (ServiceFamily & { services: Service[] })[];
};

function buildCatalog(
  categories: ServiceCategory[],
  families: ServiceFamily[],
  services: Service[]
): CategoryNode[] {
  const servicesByFamily = new Map<string, Service[]>();
  const familiesByCategory = new Map<string, (ServiceFamily & { services: Service[] })[]>();

  for (const service of services) {
    if (!service.familyId) continue;
    const list = servicesByFamily.get(service.familyId) ?? [];
    list.push(service);
    servicesByFamily.set(service.familyId, list);
  }

  for (const family of families) {
    const list = familiesByCategory.get(family.categoryId) ?? [];
    list.push({ ...family, services: servicesByFamily.get(family.id) ?? [] });
    familiesByCategory.set(family.categoryId, list);
  }

  return categories
    .map((category) => ({
      ...category,
      families: (familiesByCategory.get(category.id) ?? []).sort((a, b) =>
        a.name.localeCompare(b.name, 'fa')
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

function filterCatalog(catalog: CategoryNode[], query: string): CategoryNode[] {
  const normalized = query.trim().toLocaleLowerCase('fa');
  if (!normalized) return catalog;

  return catalog
    .map((category) => {
      const categoryMatches = category.name.toLocaleLowerCase('fa').includes(normalized);
      const visibleFamilies = category.families
        .map((family) => {
          const familyMatches = family.name.toLocaleLowerCase('fa').includes(normalized);
          const visibleServices =
            categoryMatches || familyMatches
              ? family.services
              : family.services.filter((service) =>
                  service.name.toLocaleLowerCase('fa').includes(normalized)
                );
          if (!categoryMatches && !familyMatches && visibleServices.length === 0) return null;
          return { ...family, services: visibleServices };
        })
        .filter((family): family is ServiceFamily & { services: Service[] } => Boolean(family));
      if (!categoryMatches && visibleFamilies.length === 0) return null;
      return { ...category, families: visibleFamilies };
    })
    .filter((category): category is CategoryNode => Boolean(category));
}

export function ServicesCard() {
  const { theme } = useTheme();
  const servicesResource = useAsyncResource<{ services: Service[] }>('services', (signal) =>
    servicesApi.list({ includeInactive: true, signal })
  );
  const categoriesResource = useAsyncResource<{ categories: ServiceCategory[] }>(
    'service-categories',
    (signal) => servicesApi.categories.list({ includeInactive: true, signal })
  );
  const familiesResource = useAsyncResource<{ families: ServiceFamily[] }>(
    'service-families',
    (signal) => servicesApi.families.list({ includeInactive: true, signal })
  );

  const services = React.useMemo(
    () => servicesResource.data?.services ?? [],
    [servicesResource.data?.services]
  );
  const categories = React.useMemo(
    () => categoriesResource.data?.categories ?? [],
    [categoriesResource.data?.categories]
  );
  const families = React.useMemo(
    () => familiesResource.data?.families ?? [],
    [familiesResource.data?.families]
  );
  const loading =
    (servicesResource.loading && !servicesResource.data) ||
    (categoriesResource.loading && !categoriesResource.data) ||
    (familiesResource.loading && !familiesResource.data);

  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [familyModalOpen, setFamilyModalOpen] = React.useState(false);
  const [serviceModalOpen, setServiceModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<ServiceCategory | null>(null);
  const [editingFamily, setEditingFamily] = React.useState<ServiceFamily | null>(null);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [defaultCategoryId, setDefaultCategoryId] = React.useState<string | null>(null);
  const [defaultFamilyId, setDefaultFamilyId] = React.useState<string | null>(null);
  const [openCategories, setOpenCategories] = React.useState<Record<string, boolean>>({});
  const [openFamilies, setOpenFamilies] = React.useState<Record<string, boolean>>({});
  const [query, setQuery] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const catalog = React.useMemo(
    () => buildCatalog(categories, families, services),
    [categories, families, services]
  );
  const visibleCatalog = React.useMemo(() => filterCatalog(catalog, query), [catalog, query]);
  const activeCount = services.filter((service) => service.active).length;
  const inactiveCount = services.length - activeCount;
  const noCatalog = categories.length === 0 && families.length === 0 && services.length === 0;

  const reloadAll = React.useCallback(() => {
    servicesResource.reload();
    categoriesResource.reload();
    familiesResource.reload();
  }, [categoriesResource, familiesResource, servicesResource]);

  const styles = useThemeStyles((t) => ({
    card: { gap: t.spacing.lg, padding: t.spacing.xl },
    header: {
      alignItems: 'center' as const,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      padding: 0,
    },
    content: { gap: t.spacing.md, padding: 0 },
    skeletonWrap: { gap: t.spacing.md },
    stats: { flexDirection: 'row' as const, gap: t.spacing.sm },
    stat: {
      flex: 1,
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.border, 0.55),
      backgroundColor: t.colors.background,
      paddingVertical: t.spacing.sm,
      alignItems: 'center' as const,
    },
    statValue: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansBold,
      fontVariant: ['tabular-nums' as const],
    },
    statLabel: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    toolbar: { gap: t.spacing.sm },
    actionRow: { flexDirection: 'row' as const, gap: t.spacing.sm },
    actionButton: { flex: 1 },
    searchWrap: {
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
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sans,
      textAlign: 'right' as const,
    },
    importButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: t.spacing.xs,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.primary,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    importText: {
      color: t.colors.primaryForeground,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansSemiBold,
    },
    group: {
      overflow: 'hidden' as const,
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.border, 0.6),
      backgroundColor: t.colors.background,
    },
    groupHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.sm,
      borderBottomWidth: t.sizes.hairline,
      borderBottomColor: withAlpha(t.colors.border, 0.45),
      padding: t.spacing.sm,
    },
    iconButton: {
      minHeight: t.sizes.controlSm,
      minWidth: t.sizes.controlSm,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: t.spacing.xs,
    },
    groupBody: { gap: t.spacing.sm, padding: t.spacing.sm },
    titleWrap: { flex: 1, minWidth: 0 },
    title: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansSemiBold,
    },
    subtitle: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    family: {
      overflow: 'hidden' as const,
      borderRadius: t.radius.md,
      borderWidth: t.sizes.hairline,
      borderColor: withAlpha(t.colors.border, 0.5),
      backgroundColor: t.colors.card,
    },
    serviceRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: t.spacing.md,
      borderTopWidth: t.sizes.hairline,
      borderTopColor: withAlpha(t.colors.border, 0.35),
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
    },
    colorBar: {
      width: 5,
      height: 38,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.primary,
    },
    serviceBody: { minWidth: 0, flex: 1, gap: t.spacing.xs },
    serviceName: {
      color: t.colors.foreground,
      fontSize: t.fontSize.base,
      fontFamily: t.fonts.sansMedium,
    },
    serviceMeta: {
      color: t.colors.mutedForeground,
      fontSize: t.fontSize.xs,
      fontFamily: t.fonts.sans,
    },
    empty: {
      borderRadius: t.radius.lg,
      borderWidth: t.sizes.hairline,
      borderStyle: 'dashed' as const,
      borderColor: withAlpha(t.colors.border, 0.7),
      padding: t.spacing.xl,
      alignItems: 'center' as const,
      gap: t.spacing.sm,
    },
    error: {
      color: t.colors.destructive,
      fontSize: t.fontSize.sm,
      fontFamily: t.fonts.sansMedium,
    },
  }));

  const addCategory = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const addFamily = (categoryId?: string) => {
    setEditingFamily(null);
    setDefaultCategoryId(categoryId ?? categories[0]?.id ?? null);
    setFamilyModalOpen(true);
  };

  const addService = (familyId?: string) => {
    setEditingService(null);
    setDefaultFamilyId(familyId ?? families[0]?.id ?? null);
    setServiceModalOpen(true);
  };

  const importTemplates = async () => {
    setImporting(true);
    setError(null);
    try {
      await servicesApi.importStarterTemplates();
      reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'افزودن لیست آماده انجام نشد.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Card style={styles.card}>
        <CardHeader style={styles.header}>
          <CardTitle color="mutedForeground" variant="label" weight="medium">
            لیست خدمات
          </CardTitle>
        </CardHeader>
        <CardContent style={styles.content}>
          {loading ? (
            <View style={styles.skeletonWrap}>
              <Skeleton height={48} width="100%" radius={12} />
              <Skeleton height={48} width="100%" radius={12} />
            </View>
          ) : (
            <>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{toPersianDigits(categories.length)}</Text>
                  <Text style={styles.statLabel}>بخش</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{toPersianDigits(families.length)}</Text>
                  <Text style={styles.statLabel}>گروه</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{toPersianDigits(services.length)}</Text>
                  <Text style={styles.statLabel}>خدمت</Text>
                </View>
              </View>

              <View style={styles.toolbar}>
                <View style={styles.searchWrap}>
                  <Search
                    size={theme.sizes.iconSm}
                    color={theme.iconColors.muted}
                    strokeWidth={1.7}
                  />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="جستجوی خدمت، گروه یا بخش..."
                    placeholderTextColor={theme.colors.mutedForeground}
                    style={styles.searchInput}
                  />
                </View>
                <View style={styles.actionRow}>
                  <Button
                    style={styles.actionButton}
                    onPress={() => addService()}
                    disabled={!families.length}>
                    <Plus size={theme.sizes.iconSm} color={theme.colors.primaryForeground} />
                    <Text style={{ color: theme.colors.primaryForeground }}>خدمت</Text>
                  </Button>
                  <Button
                    variant="outline"
                    style={styles.actionButton}
                    onPress={() => addFamily()}
                    disabled={!categories.length}>
                    <Layers3 size={theme.sizes.iconSm} color={theme.colors.foreground} />
                    <Text style={{ color: theme.colors.foreground }}>گروه</Text>
                  </Button>
                  <Button variant="outline" style={styles.actionButton} onPress={addCategory}>
                    <FolderPlus size={theme.sizes.iconSm} color={theme.colors.foreground} />
                    <Text style={{ color: theme.colors.foreground }}>بخش</Text>
                  </Button>
                </View>
                {noCatalog ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={importTemplates}
                    disabled={importing}
                    style={styles.importButton}>
                    {importing ? (
                      <Spinner color={theme.colors.primaryForeground} />
                    ) : (
                      <Sparkles
                        size={theme.sizes.iconSm}
                        color={theme.colors.primaryForeground}
                        strokeWidth={1.8}
                      />
                    )}
                    <Text style={styles.importText}>شروع با لیست آماده</Text>
                  </Pressable>
                ) : null}
                {inactiveCount > 0 ? (
                  <AppText color="mutedForeground">
                    {toPersianDigits(inactiveCount)} خدمت غیرفعال در لیست نگهداری شده است.
                  </AppText>
                ) : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>

              {noCatalog ? (
                <View style={styles.empty}>
                  <Sparkles size={theme.sizes.iconMd} color={theme.colors.primary} />
                  <AppText weight="medium">هنوز خدمتی ثبت نشده.</AppText>
                  <AppText color="mutedForeground">
                    از لیست آماده استفاده کنید یا اولین بخش را بسازید.
                  </AppText>
                </View>
              ) : visibleCatalog.length === 0 ? (
                <View style={styles.empty}>
                  <AppText weight="medium">نتیجه‌ای پیدا نشد.</AppText>
                  <AppText color="mutedForeground">عبارت جستجو را کوتاه‌تر کنید.</AppText>
                </View>
              ) : (
                visibleCatalog.map((category) => {
                  const categoryOpen = openCategories[category.id] ?? true;
                  const serviceCount = category.families.reduce(
                    (sum, family) => sum + family.services.length,
                    0
                  );
                  return (
                    <View key={category.id} style={styles.group}>
                      <View style={styles.groupHeader}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            setOpenCategories((current) => ({
                              ...current,
                              [category.id]: !categoryOpen,
                            }))
                          }
                          style={styles.iconButton}>
                          {categoryOpen ? (
                            <ChevronDown size={theme.sizes.iconSm} color={theme.iconColors.muted} />
                          ) : (
                            <ChevronLeft size={theme.sizes.iconSm} color={theme.iconColors.muted} />
                          )}
                        </Pressable>
                        <View style={styles.titleWrap}>
                          <Text style={styles.title} numberOfLines={1}>
                            {category.name}
                          </Text>
                          <Text style={styles.subtitle}>
                            {toPersianDigits(category.families.length)} گروه ·{' '}
                            {toPersianDigits(serviceCount)} خدمت
                          </Text>
                        </View>
                        {!category.active ? <Badge variant="secondary">غیرفعال</Badge> : null}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setEditingCategory(category);
                            setCategoryModalOpen(true);
                          }}
                          style={styles.iconButton}>
                          <Pencil size={theme.sizes.iconSm} color={theme.iconColors.muted} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => addFamily(category.id)}
                          style={styles.iconButton}>
                          <Plus size={theme.sizes.iconSm} color={theme.iconColors.muted} />
                        </Pressable>
                      </View>
                      {categoryOpen ? (
                        <View style={styles.groupBody}>
                          {category.families.length === 0 ? (
                            <View style={styles.empty}>
                              <AppText color="mutedForeground">
                                گروهی برای این بخش ثبت نشده.
                              </AppText>
                            </View>
                          ) : (
                            category.families.map((family) => {
                              const familyOpen = openFamilies[family.id] ?? true;
                              return (
                                <View key={family.id} style={styles.family}>
                                  <View style={styles.groupHeader}>
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() =>
                                        setOpenFamilies((current) => ({
                                          ...current,
                                          [family.id]: !familyOpen,
                                        }))
                                      }
                                      style={styles.iconButton}>
                                      {familyOpen ? (
                                        <ChevronDown
                                          size={theme.sizes.iconSm}
                                          color={theme.iconColors.muted}
                                        />
                                      ) : (
                                        <ChevronLeft
                                          size={theme.sizes.iconSm}
                                          color={theme.iconColors.muted}
                                        />
                                      )}
                                    </Pressable>
                                    <View style={styles.titleWrap}>
                                      <Text style={styles.title} numberOfLines={1}>
                                        {family.name}
                                      </Text>
                                      <Text style={styles.subtitle}>
                                        {toPersianDigits(family.services.length)} خدمت
                                      </Text>
                                    </View>
                                    {!family.active ? (
                                      <Badge variant="secondary">غیرفعال</Badge>
                                    ) : null}
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() => {
                                        setEditingFamily(family);
                                        setFamilyModalOpen(true);
                                      }}
                                      style={styles.iconButton}>
                                      <Pencil
                                        size={theme.sizes.iconSm}
                                        color={theme.iconColors.muted}
                                      />
                                    </Pressable>
                                    <Pressable
                                      accessibilityRole="button"
                                      onPress={() => addService(family.id)}
                                      style={styles.iconButton}>
                                      <Plus
                                        size={theme.sizes.iconSm}
                                        color={theme.iconColors.muted}
                                      />
                                    </Pressable>
                                  </View>
                                  {familyOpen
                                    ? family.services.map((service) => (
                                        <View key={service.id} style={styles.serviceRow}>
                                          <View style={styles.colorBar} />
                                          <View style={styles.serviceBody}>
                                            <Text style={styles.serviceName} numberOfLines={1}>
                                              {service.name}
                                            </Text>
                                            <Text style={styles.serviceMeta}>
                                              {toPersianDigits(service.duration)} دقیقه ·{' '}
                                              {service.price > 0
                                                ? `${toPersianDigits(service.price.toLocaleString('fa-IR'))} تومان`
                                                : 'قیمت وارد نشده'}
                                            </Text>
                                          </View>
                                          {!service.active ? (
                                            <Badge variant="secondary">غیرفعال</Badge>
                                          ) : null}
                                          <Pressable
                                            accessibilityRole="button"
                                            onPress={() => {
                                              setEditingService(service);
                                              setServiceModalOpen(true);
                                            }}
                                            style={styles.iconButton}>
                                            <Pencil
                                              size={theme.sizes.iconSm}
                                              color={theme.iconColors.muted}
                                            />
                                          </Pressable>
                                        </View>
                                      ))
                                    : null}
                                </View>
                              );
                            })
                          )}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ServiceCategoryFormModal
        open={categoryModalOpen}
        category={editingCategory}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSaved={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
          reloadAll();
        }}
      />
      <ServiceFamilyFormModal
        open={familyModalOpen}
        family={editingFamily}
        categories={categories}
        defaultCategoryId={defaultCategoryId}
        onClose={() => {
          setFamilyModalOpen(false);
          setEditingFamily(null);
        }}
        onSaved={() => {
          setFamilyModalOpen(false);
          setEditingFamily(null);
          reloadAll();
        }}
      />
      <ServiceFormModal
        open={serviceModalOpen}
        service={editingService}
        categories={categories}
        families={families}
        defaultFamilyId={defaultFamilyId}
        onClose={() => {
          setServiceModalOpen(false);
          setEditingService(null);
        }}
        onSaved={() => {
          setServiceModalOpen(false);
          setEditingService(null);
          reloadAll();
        }}
      />
    </>
  );
}
