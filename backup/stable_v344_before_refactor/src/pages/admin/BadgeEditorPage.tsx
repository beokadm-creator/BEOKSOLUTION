import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { useConference } from '../../hooks/useConference';
import { useAdmin } from '../../hooks/useAdmin';
import { BadgeElement } from '../../types/schema';
import toast from 'react-hot-toast';

const BadgeEditorPage: React.FC = () => {
    const { id: confId, info, loading: confLoading } = useConference();
    const { saveBadgeLayout, loading: saving, error: saveError } = useAdmin(confId || '');

    const [elements, setElements] = useState<BadgeElement[]>([]);
    const [canvasSize, setCanvasSize] = useState({ width: 400, height: 600 }); // Default size in pixels (approx for mm)
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    // Mock Preview Data
    const previewData = {
        NAME: 'Hong Gildong',
        ORG: 'Korea University',
        QR: 'QR_CODE_PLACEHOLDER'
    };

    useEffect(() => {
        if (info?.badgeLayout) {
            setElements(info.badgeLayout.elements);
            setCanvasSize({ width: info.badgeLayout.width, height: info.badgeLayout.height });
        } else {
            // Initialize Defaults if empty
            setElements([
                { x: 50, y: 100, fontSize: 24, isVisible: true, type: 'NAME' },
                { x: 50, y: 150, fontSize: 18, isVisible: true, type: 'ORG' },
                { x: 100, y: 300, fontSize: 100, isVisible: true, type: 'QR' }
            ]);
        }
    }, [info]);

    const handleDragStop = (idx: number, e: any, data: { x: number, y: number }) => {
        const newEls = [...elements];
        // We need to update x, y based on drag
        // react-draggable controlled position is tricky if we mix with state.
        // But for editor, we can just update state on stop.
        newEls[idx] = { ...newEls[idx], x: data.x, y: data.y };
        setElements(newEls);
        setSelectedIdx(idx);
    };

    const updateElement = (idx: number, field: keyof BadgeElement, value: any) => {
        const newEls = [...elements];
        newEls[idx] = { ...newEls[idx], [field]: value };
        setElements(newEls);
    };

    const handleSave = async () => {
        await saveBadgeLayout(canvasSize.width, canvasSize.height, elements);
        toast.success('Layout Saved!');
    };

    const containerRef = useRef<HTMLDivElement>(null);

    if (confLoading) return <div>Loading...</div>;

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)' }}>
            {/* Canvas Area */}
            <div style={{ flex: 1, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 20 }}>
                <div 
                    ref={containerRef}
                    style={{ 
                        position: 'relative', 
                        width: canvasSize.width, 
                        height: canvasSize.height, 
                        backgroundColor: 'white', 
                        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                        border: '1px solid #ccc'
                    }}
                    onClick={() => setSelectedIdx(null)} // Deselect on background click
                >
                    {elements.map((el, idx) => (
                        el.isVisible && (
                            <Draggable
                                key={idx}
                                position={{ x: el.x, y: el.y }}
                                onStop={(e, data) => handleDragStop(idx, e, data)}
                                onStart={() => setSelectedIdx(idx)}
                                bounds="parent"
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        cursor: 'move',
                                        border: selectedIdx === idx ? '2px solid blue' : '1px dashed #ddd',
                                        padding: 5,
                                        fontSize: el.fontSize, // Preview Font Size
                                        fontWeight: 'bold',
                                        backgroundColor: selectedIdx === idx ? 'rgba(0,0,255,0.05)' : 'transparent',
                                        whiteSpace: 'nowrap',
                                        userSelect: 'none'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIdx(idx);
                                    }}
                                >
                                    {el.type === 'QR' ? (
                                        <div style={{ width: el.fontSize || 100, height: el.fontSize || 100, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                                            QR
                                        </div>
                                    ) : (
                                        previewData[el.type as keyof typeof previewData] || el.type
                                    )}
                                </div>
                            </Draggable>
                        )
                    ))}
                </div>
            </div>

            {/* Sidebar Controls */}
            <div style={{ width: 300, padding: 20, backgroundColor: 'white', borderLeft: '1px solid #ddd', overflowY: 'auto' }}>
                <h2>Badge Editor</h2>
                
                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
                    <h3>Canvas Settings</h3>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <label>W: <input type="number" value={canvasSize.width} onChange={e => setCanvasSize({...canvasSize, width: Number(e.target.value)})} style={{ width: 60 }} /></label>
                        <label>H: <input type="number" value={canvasSize.height} onChange={e => setCanvasSize({...canvasSize, height: Number(e.target.value)})} style={{ width: 60 }} /></label>
                    </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                    <h3>Element Properties</h3>
                    {selectedIdx !== null ? (
                        <div>
                            <p><strong>Type:</strong> {elements[selectedIdx].type}</p>
                            <div style={{ marginBottom: 10 }}>
                                <label>X: <input type="number" value={elements[selectedIdx].x} onChange={e => updateElement(selectedIdx, 'x', Number(e.target.value))} style={{ width: 60 }} /></label>
                                <label style={{ marginLeft: 10 }}>Y: <input type="number" value={elements[selectedIdx].y} onChange={e => updateElement(selectedIdx, 'y', Number(e.target.value))} style={{ width: 60 }} /></label>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                                <label>Size (px): <input type="number" value={elements[selectedIdx].fontSize} onChange={e => updateElement(selectedIdx, 'fontSize', Number(e.target.value))} style={{ width: 60 }} /></label>
                                {elements[selectedIdx].type === 'QR' && <span style={{ fontSize: 12, color: '#666' }}> (Width/Height)</span>}
                            </div>
                            <div>
                                <label>
                                    <input type="checkbox" checked={elements[selectedIdx].isVisible} onChange={e => updateElement(selectedIdx, 'isVisible', e.target.checked)} /> 
                                    Visible
                                </label>
                            </div>
                        </div>
                    ) : (
                        <p style={{ color: '#888' }}>Select an element on canvas to edit properties.</p>
                    )}
                </div>

                <div style={{ marginTop: 'auto' }}>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        style={{ width: '100%', padding: 15, backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: 5, fontSize: 16, cursor: 'pointer' }}
                    >
                        {saving ? 'Saving...' : 'Save Layout'}
                    </button>
                    {saveError && <p style={{ color: 'red', marginTop: 10 }}>{saveError}</p>}
                </div>

                <div style={{ marginTop: 20, fontSize: 12, color: '#666' }}>
                    <p>* Use mouse to drag elements.</p>
                    <p>* Preview shows dummy data (Hong Gildong).</p>
                </div>
            </div>
        </div>
    );
};

export default BadgeEditorPage;
