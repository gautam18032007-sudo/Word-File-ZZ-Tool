'use client';

import React, { useState, useEffect } from 'react';
import { Plus, X, Loader2, AlertCircle, CheckCircle2, Store as StoreIcon, ShieldAlert, Check, PowerOff, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Store } from '@/lib/storeMaster';

interface AddStoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  existingStores?: Store[];
  onStoreAdded?: (newStore: Store) => void;
  onStoresUpdated?: (updatedStores: Store[]) => void;
}

export function AddStoreDialog({
  isOpen,
  onClose,
  existingStores = [],
  onStoreAdded,
  onStoresUpdated,
}: AddStoreDialogProps) {
  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('add');

  // Add store form state
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [openingDate, setOpeningDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [active, setActive] = useState(true);
  const [closingDate, setClosingDate] = useState('');

  // Stores list state
  const [storesList, setStoresList] = useState<Store[]>(existingStores);
  const [loading, setLoading] = useState(false);
  const [actionLoadingCode, setActionLoadingCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync with prop when opened or changed
  useEffect(() => {
    if (existingStores && existingStores.length > 0) {
      setStoresList(existingStores);
    }
  }, [existingStores]);

  // Fetch fresh store master list when modal opens or tab changes to manage
  useEffect(() => {
    if (isOpen) {
      fetch('/api/stores?all=true', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.stores)) {
            setStoresList(d.stores);
            if (onStoresUpdated) onStoresUpdated(d.stores);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const trimmedName = storeName.trim();
    const trimmedCode = storeCode.trim().toUpperCase().replace(/\s+/g, '');

    if (!trimmedName) {
      setError('Store Name is required.');
      return;
    }
    if (!trimmedCode) {
      setError('Store Code is required.');
      return;
    }
    if (!openingDate) {
      setError('Opening Date is required.');
      return;
    }
    if (closingDate && closingDate < openingDate) {
      setError('Closing Date cannot be before Opening Date.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: trimmedName,
          storeCode: trimmedCode,
          openingDate,
          active,
          closingDate: closingDate || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to add store');
        setLoading(false);
        return;
      }

      setSuccessMsg(`Store "${data.store.storeCode}" saved successfully!`);
      if (onStoreAdded) onStoreAdded(data.store);
      if (onStoresUpdated && data.stores) onStoresUpdated(data.stores);
      if (data.stores) setStoresList(data.stores);

      setTimeout(() => {
        setStoreName('');
        setStoreCode('');
        setClosingDate('');
        setError('');
        setSuccessMsg('');
        setLoading(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Network error while adding store');
      setLoading(false);
    }
  }

  async function handleToggleActive(targetStore: Store) {
    setError('');
    setSuccessMsg('');
    const newActiveState = !targetStore.active;
    setActionLoadingCode(targetStore.storeCode);

    try {
      const res = await fetch('/api/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode: targetStore.storeCode,
          active: newActiveState,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || `Failed to update ${targetStore.storeCode}`);
        setActionLoadingCode(null);
        return;
      }

      const updated = storesList.map((s) =>
        s.storeCode.toUpperCase() === targetStore.storeCode.toUpperCase()
          ? { ...s, active: newActiveState }
          : s
      );
      setStoresList(updated);
      if (onStoresUpdated) onStoresUpdated(updated);

      setSuccessMsg(
        newActiveState
          ? `Store "${targetStore.storeCode}" reactivated and available in selectors.`
          : `Store "${targetStore.storeCode}" marked unactive and removed from active selectors.`
      );
    } catch (err: any) {
      setError(err?.message || 'Network error while updating store');
    } finally {
      setActionLoadingCode(null);
    }
  }

  async function handleRemoveStore(targetStore: Store) {
    if (!window.confirm(`Are you sure you want to permanently remove store "${targetStore.storeCode} — ${targetStore.storeName}" from Store Master?`)) {
      return;
    }

    setError('');
    setSuccessMsg('');
    setActionLoadingCode(targetStore.storeCode);

    try {
      const res = await fetch('/api/stores', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeCode: targetStore.storeCode }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || `Failed to remove store ${targetStore.storeCode}`);
        setActionLoadingCode(null);
        return;
      }

      const updated = storesList.filter(
        (s) => s.storeCode.toUpperCase() !== targetStore.storeCode.toUpperCase()
      );
      setStoresList(updated);
      if (onStoresUpdated) onStoresUpdated(updated);

      setSuccessMsg(`Store "${targetStore.storeCode}" permanently removed from Store Master.`);
    } catch (err: any) {
      setError(err?.message || 'Network error while removing store');
    } finally {
      setActionLoadingCode(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <StoreIcon size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">Store Master Management</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Add new locations or manage active / unactive status</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading || Boolean(actionLoadingCode)}
            className="rounded-md p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border)] pb-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab('add');
              setError('');
              setSuccessMsg('');
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'add'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            + Add New Store
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manage');
              setError('');
              setSuccessMsg('');
            }}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'manage'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Manage Stores ({storesList.length})
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-start gap-2 p-3 text-xs border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 p-3 text-xs border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: ADD NEW STORE */}
        {activeTab === 'add' && (
          <form onSubmit={handleAddSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="addStoreName" className="text-xs font-medium">
                Store Name *
              </Label>
              <Input
                id="addStoreName"
                placeholder="e.g. Noida Sector 18"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                disabled={loading}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="addStoreCode" className="text-xs font-medium">
                  Store Code *
                </Label>
                <Input
                  id="addStoreCode"
                  placeholder="e.g. NS18"
                  value={storeCode}
                  onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                  disabled={loading}
                  required
                  className="h-9 font-mono text-sm uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="addOpenDate" className="text-xs font-medium">
                  Opening Date *
                </Label>
                <Input
                  id="addOpenDate"
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  disabled={loading}
                  required
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="addCloseDate" className="text-xs font-medium">
                  Closing Date (Optional)
                </Label>
                <Input
                  id="addCloseDate"
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  disabled={loading}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Active Status *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActive(true)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-medium transition-all ${
                      active
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                        : 'border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                    }`}
                  >
                    <Check size={13} className={active ? 'opacity-100' : 'opacity-0'} />
                    <span>Active</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive(false)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-medium transition-all ${
                      !active
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                        : 'border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                    }`}
                  >
                    <PowerOff size={13} className={!active ? 'opacity-100' : 'opacity-0'} />
                    <span>Unactive</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  'Save Store'
                )}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: MANAGE STORES (SHOW ACTIVE STATUS & DEACTIVATE/REMOVE OPTION) */}
        {activeTab === 'manage' && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-[var(--muted-foreground)]">
              Stores marked <strong>Unactive</strong> are automatically removed from Brand and PI contract selectors. After selecting Unactive, a <strong>Remove Store</strong> option is available.
            </p>

            <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg">
              {storesList.map((st) => (
                <div key={st.storeCode} className="flex items-center justify-between p-2.5 hover:bg-[var(--muted)]/40 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-[var(--foreground)]">{st.storeCode}</span>
                      <span className="text-xs text-[var(--muted-foreground)]">—</span>
                      <span className="text-xs font-medium text-[var(--foreground)]">{st.storeName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                      <span>Opened: {st.openingDate}</span>
                      {st.closingDate && <span>• Closed: {st.closingDate}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {st.active ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium">
                        Unactive
                      </Badge>
                    )}

                    {st.active ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionLoadingCode === st.storeCode}
                        onClick={() => handleToggleActive(st)}
                        className="h-7 px-2 text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-200 dark:border-amber-800 flex items-center gap-1"
                        title="Mark store as unactive (removes from active selectors)"
                      >
                        {actionLoadingCode === st.storeCode ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <>
                            <PowerOff size={11} />
                            <span>Select Unactive</span>
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionLoadingCode === st.storeCode}
                          onClick={() => handleToggleActive(st)}
                          className="h-7 px-2 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-800 flex items-center gap-1"
                          title="Reactivate store"
                        >
                          {actionLoadingCode === st.storeCode ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <>
                              <RotateCcw size={11} />
                              <span>Reactivate</span>
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionLoadingCode === st.storeCode}
                          onClick={() => handleRemoveStore(st)}
                          className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-800 flex items-center gap-1"
                          title="Permanently remove store from Master"
                        >
                          {actionLoadingCode === st.storeCode ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <>
                              <Trash2 size={11} />
                              <span>Remove Store</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

