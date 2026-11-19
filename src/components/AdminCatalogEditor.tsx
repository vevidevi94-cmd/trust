import React, { useEffect, useState } from 'react';
import {
  ImagePlus,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  CATEGORIES,
  POSTER_IMAGE_PATH,
  type CategoryKey,
  type ServiceItem,
} from '../data/services';
import { validateCatalogServiceEdit } from '../utils/panelLogic';

interface AdminCatalogEditorProps {
  catalog: Record<CategoryKey, ServiceItem[]>;
  posterImage: string | null;
  onSaveCatalog: (catalog: Record<CategoryKey, ServiceItem[]>) => Promise<boolean>;
  onResetCatalog: () => Promise<boolean>;
  onSavePoster: (posterDataUrl: string | null) => Promise<boolean>;
  onShowToast: (message: string, isError?: boolean) => void;
}

interface DraftService {
  id: string;
  name: string;
  prices: Array<{ q: string; p: string }>;
}

function compressPosterImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl.startsWith('data:image/')) {
        reject(new Error('Invalid image file'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(rawUrl);
      img.onload = () => {
        const maxWidth = 1080;
        let { width, height } = img;
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.84);
        resolve(compressed.length < rawUrl.length ? compressed : rawUrl);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

function buildDraftsForCategory(services: ServiceItem[]): DraftService[] {
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    prices: s.prices.map((t) => ({ q: t.q, p: String(t.p) })),
  }));
}

export function AdminCatalogEditor({
  catalog,
  posterImage,
  onSaveCatalog,
  onResetCatalog,
  onSavePoster,
  onShowToast,
}: AdminCatalogEditorProps) {
  const [selectedCat, setSelectedCat] = useState<CategoryKey>('instagram');
  const [drafts, setDrafts] = useState<DraftService[]>(() =>
    buildDraftsForCategory(catalog.instagram),
  );
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [resettingAll, setResettingAll] = useState(false);

  const [pendingPosterUrl, setPendingPosterUrl] = useState<string | null>(null);
  const [savingPoster, setSavingPoster] = useState(false);

  useEffect(() => {
    setDrafts(buildDraftsForCategory(catalog[selectedCat]));
  }, [catalog, selectedCat]);

  const displayedPoster = pendingPosterUrl || posterImage || POSTER_IMAGE_PATH;

  const handlePosterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onShowToast('Sirf image file (PNG/JPG/WEBP) select karo ❌', true);
      return;
    }
    try {
      const compressed = await compressPosterImage(file);
      setPendingPosterUrl(compressed);
    } catch {
      onShowToast('Poster image read failed ❌', true);
    }
  };

  const handleApplyPoster = async () => {
    if (!pendingPosterUrl) return;
    setSavingPoster(true);
    const ok = await onSavePoster(pendingPosterUrl);
    setSavingPoster(false);
    if (ok) {
      setPendingPosterUrl(null);
    }
  };

  const handleResetPoster = async () => {
    setSavingPoster(true);
    const ok = await onSavePoster(null);
    setSavingPoster(false);
    if (ok) {
      setPendingPosterUrl(null);
    }
  };

  const updateServiceName = (serviceId: string, name: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === serviceId ? { ...d, name } : d)),
    );
  };

  const updateTierField = (
    serviceId: string,
    tierIdx: number,
    field: 'q' | 'p',
    value: string,
  ) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === serviceId
          ? {
              ...d,
              prices: d.prices.map((t, i) =>
                i === tierIdx ? { ...t, [field]: value } : t,
              ),
            }
          : d,
      ),
    );
  };

  const addTier = (serviceId: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === serviceId
          ? { ...d, prices: [...d.prices, { q: 'New Package', p: '10' }] }
          : d,
      ),
    );
  };

  const removeTier = (serviceId: string, tierIdx: number) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === serviceId && d.prices.length > 1
          ? { ...d, prices: d.prices.filter((_, i) => i !== tierIdx) }
          : d,
      ),
    );
  };

  const handleSaveService = async (draft: DraftService) => {
    const check = validateCatalogServiceEdit({
      name: draft.name,
      prices: draft.prices.map((t) => ({ q: t.q, p: Number(t.p) })),
    });
    if (!check.ok) {
      onShowToast(check.message, true);
      return;
    }

    const updatedCatalog: Record<CategoryKey, ServiceItem[]> = {
      ...catalog,
      [selectedCat]: catalog[selectedCat].map((svc) =>
        svc.id === draft.id
          ? { ...svc, name: check.name, prices: check.prices }
          : svc,
      ),
    };

    setSavingServiceId(draft.id);
    await onSaveCatalog(updatedCatalog);
    setSavingServiceId(null);
  };

  const handleResetAllServices = async () => {
    setResettingAll(true);
    await onResetCatalog();
    setResettingAll(false);
  };

  return (
    <div className="space-y-3" data-testid="admin-catalog-editor">
      {/* Home Offer Poster Live Editor */}
      <div className="bg-white rounded-[18px] p-[14px] shadow-[0_6px_16px_rgba(60,20,120,0.08)] border-l-4 border-[#7c4dff]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-[15px] font-extrabold text-[#3a1d6d]">
            Home Poster (Live Change)
          </h2>
          {(posterImage || pendingPosterUrl) && (
            <button
              type="button"
              disabled={savingPoster}
              onClick={handleResetPoster}
              className="text-[11px] font-bold text-[#c62828] bg-[#ffebee] px-2.5 py-1 rounded-[8px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Default</span>
            </button>
          )}
        </div>

        <div className="rounded-[12px] overflow-hidden border border-[#e9dffc] bg-[#140926] mb-2.5">
          <img
            src={displayedPoster}
            alt="Current Home Offer Poster Preview"
            className="w-full max-h-44 object-cover block"
          />
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="admin-poster-upload"
            className="flex-1 bg-[#f3edff] text-[#3a1d6d] border border-[#d6c2ff] py-2 px-3 rounded-[10px] text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#e9dffc]"
          >
            <ImagePlus className="w-4 h-4 text-[#7c4dff]" aria-hidden="true" />
            <span>{pendingPosterUrl ? 'Change Selected Image' : 'Upload New Poster'}</span>
          </label>
          <input
            id="admin-poster-upload"
            type="file"
            accept="image/*"
            onChange={handlePosterFileChange}
            className="sr-only"
          />

          {pendingPosterUrl && (
            <button
              type="button"
              disabled={savingPoster}
              onClick={handleApplyPoster}
              className="bg-[#2e7d32] text-white py-2 px-3.5 rounded-[10px] text-[12px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{savingPoster ? 'Saving...' : 'Save Poster'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Switcher */}
      <div className="bg-white rounded-[16px] p-1.5 shadow-sm grid grid-cols-4 gap-1">
        {CATEGORIES.map((cat) => {
          const active = selectedCat === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSelectedCat(cat.key)}
              className={`py-2 px-1 rounded-[12px] text-[11.5px] font-extrabold cursor-pointer transition-colors ${
                active
                  ? 'bg-[#7c4dff] text-white shadow-sm'
                  : 'bg-transparent text-[#3a1d6d] hover:bg-[#f3edff]'
              }`}
            >
              {cat.key === 'instagram'
                ? 'Instagram'
                : cat.key === 'facebook'
                  ? 'Facebook'
                  : cat.label}
            </button>
          );
        })}
      </div>

      {/* Editable Service Cards */}
      <div className="space-y-3">
        {drafts.map((draft) => {
          const isSaving = savingServiceId === draft.id;
          return (
            <div
              key={draft.id}
              data-testid={`edit-service-${draft.id}`}
              className="bg-white rounded-[18px] p-[14px] shadow-[0_6px_16px_rgba(60,20,120,0.08)] border-l-4 border-[#7c4dff]"
            >
              <label
                htmlFor={`svc-name-${draft.id}`}
                className="block text-[11px] font-bold text-[#666] mb-1"
              >
                Service Name
              </label>
              <input
                id={`svc-name-${draft.id}`}
                type="text"
                value={draft.name}
                onChange={(e) => updateServiceName(draft.id, e.target.value)}
                className="w-full px-3 py-2 text-[13px] font-bold text-[#2d1b4e] border border-[#e9dffc] rounded-[10px] outline-none focus:border-[#7c4dff]"
              />

              <div className="mt-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#666]">
                    Packages & Price (Auto-sets QR Scanner ₹)
                  </span>
                  <button
                    type="button"
                    onClick={() => addTier(draft.id)}
                    className="text-[11px] font-extrabold text-[#7c4dff] bg-[#f3edff] px-2 py-1 rounded-[8px] inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />
                    <span>Add Tier</span>
                  </button>
                </div>

                {draft.prices.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      aria-label={`Package ${idx + 1} label for ${draft.name}`}
                      value={tier.q}
                      onChange={(e) =>
                        updateTierField(draft.id, idx, 'q', e.target.value)
                      }
                      placeholder="Package name"
                      className="flex-1 min-w-0 px-2.5 py-2 text-[12px] font-semibold text-[#2d1b4e] border border-[#e9dffc] rounded-[10px] outline-none focus:border-[#7c4dff]"
                    />
                    <div className="relative w-20 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-[#7c4dff]">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={1}
                        step="any"
                        aria-label={`Package ${idx + 1} price for ${draft.name}`}
                        value={tier.p}
                        onChange={(e) =>
                          updateTierField(draft.id, idx, 'p', e.target.value)
                        }
                        className="w-full pl-5 pr-2 py-2 text-[12px] font-extrabold text-[#2d1b4e] border border-[#e9dffc] rounded-[10px] outline-none focus:border-[#7c4dff] tabular-nums"
                      />
                    </div>
                    {draft.prices.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove package ${idx + 1}`}
                        onClick={() => removeTier(draft.id, idx)}
                        className="w-8 h-8 rounded-[8px] bg-[#ffebee] text-[#c62828] flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveService(draft)}
                className="w-full mt-3 bg-[#7c4dff] text-white py-2.5 px-3 rounded-[12px] text-[13px] font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-[0.98]"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{isSaving ? 'Saving Live...' : 'Save Live ✅'}</span>
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={resettingAll}
        onClick={handleResetAllServices}
        className="w-full bg-white text-[#c62828] border border-[#ef9a9a] py-2.5 px-3 rounded-[14px] text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
      >
        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{resettingAll ? 'Resetting...' : 'Reset All Prices to Default'}</span>
      </button>
    </div>
  );
}
