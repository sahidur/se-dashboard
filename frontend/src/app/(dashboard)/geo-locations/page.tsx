'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import api from '@/lib/api';
import type { GeoLocation, GeoLocationType } from '@/types';

const TYPE_LABELS: Record<GeoLocationType, string> = {
  division: 'Division',
  district: 'District',
  thana: 'Thana',
  area: 'Area',
};

const TYPE_HIERARCHY: GeoLocationType[] = [
  'division',
  'district',
  'thana',
  'area',
];

function getChildType(type: GeoLocationType): GeoLocationType | null {
  const idx = TYPE_HIERARCHY.indexOf(type);
  return idx < TYPE_HIERARCHY.length - 1 ? TYPE_HIERARCHY[idx + 1] : null;
}

interface TreeNodeProps {
  location: GeoLocation;
  onEdit: (loc: GeoLocation) => void;
  onDelete: (loc: GeoLocation) => void;
  onAddChild: (parent: GeoLocation) => void;
  depth: number;
}

function TreeNode({
  location,
  onEdit,
  onDelete,
  onAddChild,
  depth,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<GeoLocation[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const childType = getChildType(location.type);

  const loadChildren = useCallback(async () => {
    if (children.length > 0) return;
    setLoadingChildren(true);
    try {
      const { data } = await api.get(
        `/geo-locations/${location.id}/children`,
      );
      setChildren(data);
    } catch {
      /* empty */
    } finally {
      setLoadingChildren(false);
    }
  }, [location.id, children.length]);

  const toggleExpand = () => {
    if (!expanded) loadChildren();
    setExpanded(!expanded);
  };

  const refreshChildren = async () => {
    setChildren([]);
    const { data } = await api.get(
      `/geo-locations/${location.id}/children`,
    );
    setChildren(data);
  };

  const typeColors: Record<string, string> = {
    division: 'border-brand-500 bg-brand-50',
    district: 'border-accent-blue bg-blue-50',
    thana: 'border-accent-lime bg-lime-50',
    area: 'border-accent-crimson bg-red-50',
  };

  return (
    <div className="mb-1" style={{ marginLeft: Math.min(depth * 16, 48) }}>
      <div
        className={`flex flex-col gap-2 rounded-lg border-l-4 px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
          typeColors[location.type] || 'border-gray-300 bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {childType ? (
            <button
              onClick={toggleExpand}
              className="shrink-0 p-0.5 text-gray-500 hover:text-gray-700"
            >
              {expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <MapPin size={14} className="shrink-0 text-gray-400" />
          <span className="text-sm font-medium text-gray-900 truncate">
            {location.name}
          </span>
          <span className="shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-xs text-gray-500">
            {TYPE_LABELS[location.type]}
          </span>
          {!location.isActive && (
            <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600">
              Inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {childType && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onAddChild(location)}
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

      {expanded && (
        <div className="mt-1">
          {loadingChildren ? (
            <p className="py-2 pl-8 text-xs text-gray-400">Loading...</p>
          ) : children.length === 0 ? (
            <p className="py-2 pl-8 text-xs text-gray-400">
              No {childType ? TYPE_LABELS[childType].toLowerCase() + 's' : 'children'}
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
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function GeoLocationsPage() {
  const [divisions, setDivisions] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<GeoLocation | null>(
    null,
  );
  const [parentForNew, setParentForNew] = useState<GeoLocation | null>(null);
  const [formName, setFormName] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingLocation, setDeletingLocation] =
    useState<GeoLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDivisions = async () => {
    try {
      const { data } = await api.get('/geo-locations/divisions');
      setDivisions(data);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDivisions();
  }, []);

  const handleAddDivision = () => {
    setEditingLocation(null);
    setParentForNew(null);
    setFormName('');
    setFormIsActive(true);
    setShowModal(true);
  };

  const handleAddChild = (parent: GeoLocation) => {
    setEditingLocation(null);
    setParentForNew(parent);
    setFormName('');
    setFormIsActive(true);
    setShowModal(true);
  };

  const handleEdit = (loc: GeoLocation) => {
    setEditingLocation(loc);
    setParentForNew(null);
    setFormName(loc.name);
    setFormIsActive(loc.isActive);
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
      await fetchDivisions();
      setShowDeleteModal(false);
      setDeletingLocation(null);
    } catch (error: any) {
      alert(
        error.response?.data?.message || 'Failed to delete location',
      );
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
      } else {
        const childType = parentForNew
          ? getChildType(parentForNew.type)
          : 'division';
        await api.post('/geo-locations', {
          name: formName.trim(),
          type: childType,
          parentId: parentForNew?.id || undefined,
          isActive: formIsActive,
        });
      }
      await fetchDivisions();
      setShowModal(false);
    } catch (error: any) {
      alert(
        error.response?.data?.message || 'Failed to save location',
      );
    } finally {
      setSaving(false);
    }
  };

  const getModalTitle = () => {
    if (editingLocation)
      return `Edit ${TYPE_LABELS[editingLocation.type]}`;
    if (parentForNew) {
      const childType = getChildType(parentForNew.type);
      return `Add ${childType ? TYPE_LABELS[childType] : 'Location'} to ${parentForNew.name}`;
    }
    return 'Add Division';
  };

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
        subtitle="Manage Division, District, Thana & Area hierarchy"
        actions={
          <Button size="sm" onClick={handleAddDivision}>
            <Plus size={16} className="mr-1" /> Add Division
          </Button>
        }
      />
      <div className="page-container">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin size={20} className="text-brand-500" />
              Location Hierarchy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {divisions.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-gray-400">
                <MapPin size={40} className="mb-2" />
                <p className="text-sm">
                  No locations yet. Start by adding a Division.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {divisions.map((div) => (
                  <TreeNode
                    key={div.id}
                    location={div}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAddChild={handleAddChild}
                    depth={0}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={getModalTitle()}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
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
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingLocation ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Location"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <strong>{deletingLocation?.name}</strong>? This will also
            delete all child locations.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
