import React, { useState, useEffect } from 'react';
import { useConference } from '../../hooks/useConference';
import { useCMS } from '../../hooks/useCMS';
import toast from 'react-hot-toast';

const PageEditor: React.FC = () => {
    const { id: confId, pages } = useConference();
    const { savePage, deletePage, loading } = useCMS(confId || '');

    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [slug, setSlug] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState(''); // Simple Text Area for now

    useEffect(() => {
        if (selectedPageId) {
            const page = pages.find(p => p.id === selectedPageId);
            if (page) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSlug(page.slug);
                 
                setTitle(page.title.ko);
                 
                setContent(page.content.ko);
            }
        } else {
            setSlug(''); setTitle(''); setContent('');
        }
    }, [selectedPageId, pages]);

    const handleSave = async () => {
        const pageData = {
            slug,
            title: { ko: title },
            content: { ko: content },
            isPublished: true
        };
        await savePage(pageData as { slug: string; title: { ko: string }; content: { ko: string }; isPublished: boolean }, selectedPageId || undefined);
        toast.success('Page Saved');
        setSelectedPageId(null);
        // ideally refresh pages
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete?')) {
            await deletePage(id);
            toast.success('Page Deleted');
        }
    };

    return (
        <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ width: 200, borderRight: '1px solid #ddd' }}>
                <h3>Pages</h3>
                <button onClick={() => setSelectedPageId(null)}>+ New Page</button>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {pages.map(p => (
                        <li key={p.id} style={{ padding: 5, cursor: 'pointer', backgroundColor: selectedPageId === p.id ? '#eee' : 'transparent' }}>
                            <span onClick={() => setSelectedPageId(p.id)}>{p.title.ko}</span>
                            <button onClick={() => handleDelete(p.id)} style={{ float: 'right', fontSize: 10 }}>x</button>
                        </li>
                    ))}
                </ul>
            </div>
            <div style={{ flex: 1 }}>
                <h2>{selectedPageId ? 'Edit Page' : 'New Page'}</h2>
                <div style={{ marginBottom: 10 }}>
                    <label>Slug: </label>
                    <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. welcome" />
                </div>
                <div style={{ marginBottom: 10 }}>
                    <label>Title: </label>
                    <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Page Title" />
                </div>
                <div style={{ marginBottom: 10 }}>
                    <label>Content Template: </label>
                    <div style={{ padding: 10, background: '#f9f9f9', border: '1px solid #ddd' }}>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>[Fixed Template Component]</p>
                        <p style={{ fontSize: 12, color: '#666' }}>
                            HTML editing is disabled. Select a component below.
                        </p>
                        <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                            <button onClick={() => setContent('<component type="welcome" />')}>Welcome Banner</button>
                            <button onClick={() => setContent('<component type="schedule" />')}>Schedule Table</button>
                            <button onClick={() => setContent('<component type="speakers" />')}>Speakers Grid</button>
                        </div>
                    </div>
                    {/* Read-only preview */}
                    <div style={{ marginTop: 5, fontSize: 11, color: '#999' }}>
                        Current Value: {content}
                    </div>
                </div>
                <button onClick={handleSave} disabled={loading}>Save Page</button>
            </div>
        </div>
    );
};

export default PageEditor;
