'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  MapPin,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Globe,
  Landmark,
  Building2,
  Map as MapIcon,
} from 'lucide-react';
import api, { getErrorMessage } from '@/lib/api';
import type { GeoLocation, GeoLocationType } from '@/types';

// Hierarchy order (top -> bottom): Area > Division > District > Thana/Upazilla.
const TYPE_HIERARCHY: GeoLocationType[] = ['area', 'division', 'district', 'thana'];

const TYPE_LABELS: Record<GeoLocationType, string> = {
  area: 'Area',
  division: 'Division',
  district: 'District',
  thana: 'Thana/Upazilla',
};

const TYPE_ICONS: Record<GeoLocationType, React.ElementType> = {
  area: Globe,
  division: Landmark,
  district: Building2,
  thana: MapIcon,
};

const TYPE_STYLES: Record<GeoLocationType, { border: string; bg: string; badge: string }> = {
  area: { border: 'border-amber-500', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  division: { border: 'border-brand-500', bg: 'bg-brand-50', badge: 'bg-brand-100 text-brand-700' },
  district: { border: 'border-accent-blue', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  thana: { border: 'border-accent-crimson', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700' },
};

function getChildType(type: GeoLocationType): GeoLocationType | null {
  const idx = TYPE_HIERARCHY.indexOf(type);
  return idx >= 0 && idx < TYPE_HIERARCHY.length - 1 ? TYPE_HIERARCHY[idx + 1] : null;
}

function countDescendants(location: GeoLocation): number {
  if (!location.children || location.children.length === 0) return 0;
  return location.children.reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0,
  );
}

function countByType(nodes: GeoLocation[]): Record<GeoLocationType, number> {
  const counts: Record<GeoLocationType, number> = {
    area: 0,
    division: 0,
    district: 0,
    thana: 0,
  };
  const walk = (list: GeoLocation[]) => {
    for (const n of list) {
      counts[n.type] += 1;
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return counts;
}

/** Prunes the tree to nodes whose name matches `query`, keeping any ancestor
 * of a match so the match stays visible/reachable in context. */
function filterTree(nodes: GeoLocation[], query: string): GeoLocation[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const result: GeoLocation[] = [];
  for (const node of nodes) {
    const selfMatch = node.name.toLowerCase().includes(q);
    const filteredChildren = node.children ? filterTree(node.children, query) : [];
    if (selfMatch || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: selfMatch ? node.children : filteredChildren,
      });
    }
  }
  return result;
}

interface TreeNodeProps {
  location: GeoLocation;
  onEdit: (loc: GeoLocation) => void;
  onDelete: (loc: GeoLocation) => void;
  onAddChild: (parent: GeoLocation, ancestors: GeoLocation[]) => void;
  depth: number;
  ancestors: GeoLocation[];
  forceExpand: boolean;
}

function TreeNode({
  location,
  onEdit,
  onDelete,
  onAddChild,
  depth,
  ancestors,
  forceExpand,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const childType = getChildType(location.type);
  const children = location.children ?? [];
  const isExpanded = forceExpand || expanded;
  const style = TYPE_STYLES[location.type] ?? {
    border: 'border-gray-300',
    bg: 'bg-gray-50',
    badge: 'bg-gray-100 text-gray-600',
  };
  const Icon = TYPE_ICONS[location.type] ?? MapPin;

  return (
    <div className="mb-1" style={{ marginLeft: Math.min(depth * 16, 48) }}>
      <div
        className={`group flex flex-col gap-2 rounded-lg px-3 py-2 transition-colors sm:flex-row sm:items-center sm:justify-between ${style.bg}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          {children.length > 0 || childType ? (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-white/70 hover:text-gray-700"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <Icon size={14} className="shrink-0 text-gray-500" />
          <span className="truncate text-sm font-medium text-gray-900">{location.name}</span>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${style.badge}`}>
            {TYPE_LABELS[location.type]}
          </span>
          {children.length > 0 && (
            <span className="shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-xs text-gray-500">
              {children.length}
            </span>
          )}
          {!location.isActive && (
            <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
              Inactive
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          {childType && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onAddChild(location, [...ancestors, location])}
            >
              <Plus size={12} className="mr-0.5" />
              <span className="hidden sm:inline">{TYPE_LABELS[childType]}</span>
              <span className="sm:hidden">+</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onEdit(location)}
          >
            <Edit3 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
            onClick={() => onDelete(location)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-1">
          {children.length === 0 ? (
            <p className="py-2 pl-8 text-xs text-gray-400">
              No {childType ? TYPE_LABELS[childType].toLowerCase() + 's' : 'children'} yet
            </p>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.id}
                location={child}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                depth={depth + 1}
                ancestors={[...ancestors, location]}
                forceExpand={forceExpand}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function GeoLocationsPage() {
  const [tree, setTree] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<GeoLocation | null>(null);
  const [parentForNew, setParentForNew] = useState<GeoLocation | null>(null);
  const [parentPath, setParentPath] = useState<GeoLocation[]>([]);
  const [formName, setFormName] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [addAnother, setAddAnother] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState<GeoLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchTree = async () => {
    try {
      const { data } = await api.get('/geo-locations/tree');
      setTree(data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const stats = useMemo(() => countByType(tree), [tree]);
  const displayTree = useMemo(
    () => (searchQuery.trim() ? filterTree(tree, searchQuery) : tree),
    [tree, searchQuery],
  );

  const rootType = TYPE_HIERARCHY[0];

  const handleAddRoot = () => {
    setEditingLocation(null);
    setParentForNew(null);
    setParentPath([]);
    setFormName('');
    setFormIsActive(true);
    setAddAnother(false);
    setShowModal(true);
  };

  const handleAddChild = (parent: GeoLocation, ancestors: GeoLocation[]) => {
    setEditingLocation(null);
    setParentForNew(parent);
    setParentPath(ancestors);
    setFormName('');
    setFormIsActive(true);
    setAddAnother(false);
    setShowModal(true);
  };

  const handleEdit = (loc: GeoLocation) => {
    setEditingLocation(loc);
    setParentForNew(null);
    setParentPath([]);
    setFormName(loc.name);
    setFormIsActive(loc.isActive);
    setAddAnother(false);
    setShowModal(true);
  };

  const handleDelete = (loc: GeoLocation) => {
    setDeletingLocation(loc);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deletingLocation) return;
    setDeleting(true);
    try {
      await api.delete(`/geo-locations/${deletingLocation.id}`);
      await fetchTree();
      setShowDeleteModal(false);
      setDeletingLocation(null);
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to delete location'));
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingLocation) {
        await api.patch(`/geo-locations/${editingLocation.id}`, {
          name: formName.trim(),
          isActive: formIsActive,
        });
        await fetchTree();
        setShowModal(false);
      } else {
        const childType = parentForNew ? getChildType(parentForNew.type) : rootType;
        await api.post('/geo-locations', {
          name: formName.trim(),
          type: childType,
          parentId: parentForNew?.id || undefined,
          isActive: formIsActive,
        });
        await fetchTree();
        if (addAnother) {
          setFormName('');
          nameInputRef.current?.focus();
        } else {
          setShowModal(false);
        }
      }
    } catch (error) {
      alert(getErrorMessage(error, 'Failed to save location'));
    } finally {
      setSaving(false);
    }
  };

  const getModalTitle = () => {
    if (editingLocation) return `Edit ${TYPE_LABELS[editingLocation.type]}`;
    if (parentForNew) {
      const childType = getChildType(parentForNew.type);
      return `Add ${childType ? TYPE_LABELS[childType] : 'Location'}`;
    }
    return `Add ${TYPE_LABELS[rootType]}`;
  };

  const descendantCount = deletingLocation ? countDescendants(deletingLocation) : 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Geo Locations"
        subtitle="Manage Area, Division, District & Thana/Upazilla hierarchy."
        actions={
          <Button size="sm" onClick={handleAddRoot}>
            <Plus size={16} className="mr-1" /> Add {TYPE_LABELS[rootType]}
          </Button>
        }
      />
      <div className="page-container space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TYPE_HIERARCHY.map((type) => {
            const Icon = TYPE_ICONS[type];
            const style = TYPE_STYLES[type];
            return (
              <Card key={type} className={`${style.bg} border-0`}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.badge}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{stats[type]}</p>
                    <p className="text-xs text-gray-500">{TYPE_LABELS[type]}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin size={20} className="text-brand-500" />
                Location Hierarchy
              </CardTitle>
              <div className="relative w-full sm:w-72">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search locations..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {displayTree.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-gray-400">
                <MapPin size={40} className="mb-2" />
                <p className="text-sm">
                  {searchQuery
                    ? `No locations match "${searchQuery}".`
                    : `No locations yet. Start by adding a ${TYPE_LABELS[rootType]}.`}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {displayTree.map((node) => (
                  <TreeNode
                    key={node.id}
                    location={node}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAddChild={handleAddChild}
                    depth={0}
                    ancestors={[]}
                    forceExpand={!!searchQuery.trim()}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={getModalTitle()}>
        <div className="space-y-4">
          {parentPath.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {parentPath.map((p, i) => (
                <span key={p.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={12} />}
                  <span className="font-medium text-gray-700">{p.name}</span>
                  <span className="text-gray-400">({TYPE_LABELS[p.type]})</span>
                </span>
              ))}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <Input
              ref={nameInputRef}
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formName.trim() && !saving) handleSave();
              }}
              placeholder="Enter location name"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Active
            </label>
          </div>
          {!editingLocation && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="addAnother"
                checked={addAnother}
                onChange={(e) => setAddAnother(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="addAnother" className="text-sm text-gray-700">
                Add another after saving
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!formName.trim()}>
              {editingLocation ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Location">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deletingLocation?.name}</strong>
            {deletingLocation ? ` (${TYPE_LABELS[deletingLocation.type]})` : ''}?
            {descendantCount > 0 && (
              <>
                {' '}
                This will also permanently remove{' '}
                <strong>
                  {descendantCount} nested location{descendantCount === 1 ? '' : 's'}
                </strong>{' '}
                underneath it.
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={deleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
