import React, { useState, useRef } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from './button';
import toast from 'react-hot-toast';

interface ImageUploadProps {
    path: string; // Storage path (e.g., 'societies/kap/logo')
    onUploadComplete: (url: string) => void;
    previewUrl?: string;
    label?: string;
    className?: string;
}

export default function ImageUpload({ path, onUploadComplete, previewUrl, label = "Upload Image", className }: ImageUploadProps) {
    const [preview, setPreview] = useState<string | null>(previewUrl || null);
    const [progress, setProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file) return;

        // 1. Path Validation
        if (!path || path.includes('undefined') || path.includes('null')) {
            toast.error(`Critical Error: Invalid upload path (${path}). Please contact support.`);
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        // Local Preview
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        // Upload
        setUploading(true);
        setProgress(0);

        try {
            const storage = getStorage();
            // Generate a unique name: {path}/{timestamp}_{filename}
            const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
            
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed', 
                (snapshot) => {
                    const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setProgress(p);
                }, 
                (error) => {
                    console.error("Upload failed", error);
                    setUploading(false);
                    
                    // Verbose Error Alert
                    let msg = "Upload failed.";
                    if (error.code === 'storage/unauthorized') {
                        msg = "Permission Denied: Domain not authorized or user logged out.\nCheck Firebase Console > Auth > Settings > Authorized Domains.";
                    } else if (error.code === 'storage/canceled') {
                        msg = "Upload canceled.";
                    } else {
                        msg = error.message;
                    }
                    toast.error(`❌ Upload Error:\n${msg}`);
                }, 
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        onUploadComplete(downloadURL);
                        setUploading(false);
                        setPreview(downloadURL); // Switch to remote URL
                        // toast.success("Image uploaded successfully! ✅"); // Optional: Success Alert
                    } catch (urlError: any) {
                         console.error("Get URL failed", urlError);
                         setUploading(false);
                         toast.error(`❌ Failed to get Download URL:\n${urlError.message}`);
                    }
                }
            );

        } catch (e: any) {
            console.error("Upload setup failed", e);
            setUploading(false);
            toast.error(`❌ Upload Setup Error:\n${e.message}`);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering click on parent
        setPreview(null);
        onUploadComplete(''); // Clear URL
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className={`w-full ${className}`}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>}
            
            <div 
                className={`relative border-2 border-dashed rounded-lg p-4 transition-colors text-center cursor-pointer
                    ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
                    ${preview ? 'h-auto' : 'h-40 flex flex-col items-center justify-center'}
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !uploading && inputRef.current?.click()}
            >
                <input 
                    ref={inputRef}
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                    disabled={uploading}
                />

                {uploading ? (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                        <span className="text-sm text-gray-500">Uploading... {Math.round(progress)}%</span>
                        <div className="w-full max-w-[200px] h-2 bg-gray-200 rounded mt-2 overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                ) : preview ? (
                    <div className="relative group">
                        <img src={preview} alt="Preview" className="max-h-60 mx-auto rounded shadow-sm object-contain" />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="destructive" size="icon" onClick={handleRemove} type="button">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="absolute bottom-2 left-0 right-0 text-xs text-white bg-black/50 p-1 rounded mx-auto w-fit opacity-0 group-hover:opacity-100">
                            Click to replace
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-500">
                        <div className="bg-gray-100 p-3 rounded-full w-fit mx-auto mb-3">
                            <Upload className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-900">Click to upload</p>
                        <p className="text-xs text-gray-500 mt-1">or drag and drop SVG, PNG, JPG</p>
                    </div>
                )}
            </div>
        </div>
    );
}
