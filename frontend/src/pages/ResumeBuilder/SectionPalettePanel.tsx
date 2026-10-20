import { useMemo, useState } from 'react';
import { Reorder } from 'framer-motion';
import {
    Layers, GripVertical, Eye, EyeOff, Plus, Trash2, X,
    AlertCircle, ListX,
} from 'lucide-react';
import type { ResumeData } from './types';
import {
    customSectionId, isStandardSectionId, resolvePaletteSections, sectionZone,
} from './sectionModel';
import type { BaseEngineId, SectionId, SectionZone } from './sectionModel';

interface SectionPalettePanelProps {
    data: ResumeData;
    onChange: (d: Partial<ResumeData>) => void;
    base: BaseEngineId;
    onClose: () => void;
}

function newCustomId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `cs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function SectionPalettePanel({ data, onChange, base, onClose }: SectionPalettePanelProps) {
    const [addingSection, setAddingSection] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const entries = useMemo(() => resolvePaletteSections(data, base), [data, base]);
    const hiddenCount = entries.filter(e => !e.visible).length;
    const zoned = entries.some(e => isStandardSectionId(e.id) && sectionZone(base, e.id) === 'sidebar');

    const inZone = (id: SectionId, zone: SectionZone) =>
        isStandardSectionId(id) ? sectionZone(base, id) === zone : zone === 'main';

    const reorderZone = (zone: SectionZone, zoneIds: SectionId[]) => {
        const positions: number[] = [];
        entries.forEach((e, i) => { if (inZone(e.id, zone)) positions.push(i); });
        const next = entries.map(e => e.id);
        positions.forEach((pos, k) => { next[pos] = zoneIds[k]; });
        onChange({ section_order: next });
    };

    const toggleVisible = (id: SectionId) => {
        const hidden = new Set(data.hidden_sections ?? []);
        if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
        onChange({ hidden_sections: [...hidden] });
    };

    const addCustomSection = () => {
        const title = newTitle.trim();
        if (!title) return;
        const id = newCustomId();
        onChange({
            custom_sections: [...(data.custom_sections ?? []), { id, title, content: '' }],
        });
        setNewTitle('');
        setAddingSection(false);
    };

    const deleteCustomSection = (customId: string) => {
        const fullId = customSectionId(customId);
        onChange({
            custom_sections: (data.custom_sections ?? []).filter(cs => cs.id !== customId),
            section_order: (data.section_order ?? []).filter(s => s !== fullId),
            hidden_sections: (data.hidden_sections ?? []).filter(s => s !== fullId),
        });
    };

    const renameCustomSection = () => {
        if (!renamingId) return;
        const title = renameValue.trim();
        if (!title) { setRenamingId(null); return; }
        onChange({
            custom_sections: (data.custom_sections ?? []).map(cs =>
                cs.id === renamingId ? { ...cs, title } : cs),
        });
        setRenamingId(null);
    };

    const renderZone = (zone: SectionZone, label: string) => {
        const zoneEntries = entries.filter(e => inZone(e.id, zone));
        if (zoneEntries.length === 0) return null;
        return (
            <div className="mb-3">
                {label && (
                    <h4 className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 px-1">{label}</h4>
                )}
                <Reorder.Group axis="y" values={zoneEntries.map(e => e.id)} onReorder={ids => reorderZone(zone, ids as SectionId[])} className="space-y-1">
                    {zoneEntries.map(e => {
                        const isCustom = !isStandardSectionId(e.id);
                        const custom = isCustom ? (data.custom_sections ?? []).find(cs => customSectionId(cs.id) === e.id) : undefined;
                        return (
                            <Reorder.Item
                                key={e.id}
                                value={e.id}
                                as="div"
                                whileDrag={{ scale: 1.03, boxShadow: '0 8px 20px rgba(0,0,0,0.15)', zIndex: 30 }}
                                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-left select-none transition-colors ${
                                    e.visible
                                        ? 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-purple-200 dark:hover:border-purple-700'
                                        : 'border-dashed border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/30'
                                }`}
                            >
                                <GripVertical className="w-3 h-3 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                                {renamingId === (custom?.id ?? null) ? (
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={ev => setRenameValue(ev.target.value)}
                                        onBlur={renameCustomSection}
                                        onKeyDown={ev => { if (ev.key === 'Enter') renameCustomSection(); if (ev.key === 'Escape') setRenamingId(null); }}
                                        className="flex-1 min-w-0 px-1.5 py-0.5 text-[10px] font-bold border border-purple-200 dark:border-purple-700 rounded-md focus:outline-none bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200"
                                    />
                                ) : (
                                    <button
                                        onClick={() => { if (isCustom && custom) { setRenamingId(custom.id); setRenameValue(custom.title); } }}
                                        className={`flex-1 min-w-0 truncate text-[12px] font-bold text-left ${e.visible ? 'text-gray-900 dark:text-gray-50' : 'text-gray-500 dark:text-gray-400 line-through'} ${isCustom ? 'cursor-text' : 'cursor-default'}`}
                                        title={isCustom ? 'Rename section' : e.label}
                                    >
                                        {e.label || 'Unnamed Section'}
                                    </button>
                                )}
                                {!e.renderable && (
                                    <span className="flex items-center gap-0.5 text-[7px] font-black uppercase tracking-wider text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-1 py-px rounded flex-shrink-0" title="No content yet — add it in the editor so this section can render">
                                        <AlertCircle className="w-2 h-2" /> Empty
                                    </span>
                                )}
                                <button
                                    onClick={() => toggleVisible(e.id)}
                                    className={`w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 transition-colors ${e.visible ? 'text-gray-400 dark:text-gray-500 hover:text-[#5c52d2] hover:bg-purple-50 dark:hover:bg-purple-900/30' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'}`}
                                    title={e.visible ? `Hide "${e.label}" (content is kept)` : `Show "${e.label}"`}
                                >
                                    {e.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                </button>
                                {isCustom && (
                                    <button
                                        onClick={() => custom && deleteCustomSection(custom.id)}
                                        className="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                        title={`Delete "${e.label}"`}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </Reorder.Item>
                        );
                    })}
                </Reorder.Group>
            </div>
        );
    };

    return (
        <>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700/60 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#5c52d2]" />
                    <h3 className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">Sections</h3>
                    <span className="text-[9px] font-bold text-[#5c52d2] bg-purple-50 dark:bg-purple-900/40 px-1.5 py-0.5 rounded-full">{entries.filter(e => e.visible).length}</span>
                </div>
                <button
                    onClick={onClose}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-gray-500 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700/60 flex-shrink-0">
                <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500 leading-relaxed px-1">
                    Drag to reorder — the preview updates live and keeps this layout when you save or switch templates.
                </p>
            </div>

            {/* Scrollable section list */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
                {entries.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-gray-300 dark:text-gray-600">
                        <ListX className="w-6 h-6" />
                        <p className="text-[10px] font-bold">No sections yet</p>
                    </div>
                ) : zoned ? (
                    <>
                        {renderZone('main', 'Main column')}
                        {renderZone('sidebar', 'Sidebar')}
                    </>
                ) : (
                    renderZone('main', '')
                )}

                {hiddenCount > 0 && (
                    <p className="text-[8px] font-medium text-gray-400 dark:text-gray-500 px-1 mt-1 leading-relaxed">
                        {hiddenCount} hidden section{hiddenCount > 1 ? 's' : ''} — your content is kept and shown again when re-enabled.
                    </p>
                )}

                {/* Add custom section */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/60">
                    {addingSection ? (
                        <div className="space-y-1.5">
                            <input
                                autoFocus
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addCustomSection(); if (e.key === 'Escape') { setAddingSection(false); setNewTitle(''); } }}
                                placeholder="Section name (e.g. Certifications)"
                                className="w-full px-2.5 py-1.5 text-[10px] font-bold border border-purple-200 dark:border-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-200"
                            />
                            <div className="flex gap-1.5">
                                <button onClick={addCustomSection} disabled={!newTitle.trim()} className="flex-1 py-1 text-[9px] font-black uppercase tracking-wider text-white bg-[#5c52d2] rounded-lg disabled:opacity-40 hover:bg-[#4b41c4] transition-colors">
                                    Add
                                </button>
                                <button onClick={() => { setAddingSection(false); setNewTitle(''); }} className="flex-1 py-1 text-[9px] font-bold text-gray-400 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setAddingSection(true)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black text-[#5c52d2] border border-dashed border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-50/60 dark:hover:bg-purple-900/20 transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Add Custom Section
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
