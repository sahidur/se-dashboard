'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/select';
import api from '@/lib/api';
import type { GeoLocation, GeoLocationType } from '@/types';

// Hierarchy order (top -> bottom), matches backend/geo-locations admin page.
const TYPE_HIERARCHY: GeoLocationType[] = ['area', 'division', 'district', 'thana'];
const TYPE_LABELS: Record<GeoLocationType, string> = {
  area: 'Area',
  division: 'Division',
  district: 'District',
  thana: 'Thana/Upazilla',
};

function findNodeAndPath(
  nodes: GeoLocation[],
  id: string,
  ancestors: GeoLocation[] = [],
): GeoLocation[] | null {
  for (const node of nodes) {
    if (node.id === id) return [...ancestors, node];
    if (node.children?.length) {
      const found = findNodeAndPath(node.children, id, [...ancestors, node]);
      if (found) return found;
    }
  }
  return null;
}

interface GeoLocationSelectProps {
  value?: string | null;
  onChange: (geoLocationId: string | null, node: GeoLocation | null) => void;
  disabled?: boolean;
}

/** Cascading Area > Division > District > Thana/Upazilla picker. */
export function GeoLocationSelect({ value, onChange, disabled }: GeoLocationSelectProps) {
  const { data: tree = [] } = useQuery<GeoLocation[]>({
    queryKey: ['geo-locations-tree'],
    queryFn: () => api.get<GeoLocation[]>('/geo-locations/tree').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // selectedIds[i] = id chosen at TYPE_HIERARCHY[i]
  const [selectedIds, setSelectedIds] = useState<(string | null)[]>([null, null, null, null]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || !tree.length) return;
    if (value) {
      const path = findNodeAndPath(tree, value);
      if (path) {
        const ids: (string | null)[] = [null, null, null, null];
        path.forEach((node) => {
          const idx = TYPE_HIERARCHY.indexOf(node.type);
          if (idx >= 0) ids[idx] = node.id;
        });
        setSelectedIds(ids);
      }
    }
    setInitialized(true);
  }, [tree, value, initialized]);

  // Options available at each level, based on the previous level's selection.
  const optionsByLevel = useMemo(() => {
    const result: GeoLocation[][] = [[], [], [], []];
    result[0] = tree;
    for (let i = 1; i < TYPE_HIERARCHY.length; i++) {
      const parentId = selectedIds[i - 1];
      const parentNode = result[i - 1].find((n) => n.id === parentId);
      result[i] = parentNode?.children || [];
    }
    return result;
  }, [tree, selectedIds]);

  const handleSelect = (levelIdx: number, id: string) => {
    const next = [...selectedIds];
    next[levelIdx] = id || null;
    for (let i = levelIdx + 1; i < next.length; i++) next[i] = null;
    setSelectedIds(next);

    // The deepest non-empty selection is the effective geo location.
    let deepestId: string | null = null;
    let deepestNode: GeoLocation | null = null;
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i]) {
        deepestId = next[i];
        deepestNode = optionsByLevel[i]?.find((n) => n.id === next[i]) || null;
        break;
      }
    }
    onChange(deepestId, deepestNode);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TYPE_HIERARCHY.map((type, idx) => (
        <Select
          key={type}
          label={TYPE_LABELS[type]}
          placeholder={`Select ${TYPE_LABELS[type]}`}
          value={selectedIds[idx] || ''}
          disabled={disabled || (idx > 0 && !selectedIds[idx - 1])}
          onChange={(e) => handleSelect(idx, e.target.value)}
          options={optionsByLevel[idx].map((n) => ({ value: n.id, label: n.name }))}
        />
      ))}
    </div>
  );
}
