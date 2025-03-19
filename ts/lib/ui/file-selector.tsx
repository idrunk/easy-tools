import React, { HTMLProps, useRef } from 'react';

export function FileSelector({ children, accept, multiple = false, onFiles, className }: {
    children: React.ReactNode,
    accept?: string,
    multiple?: boolean,
    onFiles: (files: FileList) => void,
} & HTMLProps<HTMLButtonElement>) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const onChange = (files: FileList | null) => files && onFiles(files);
    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
                onChange={e => onChange(e.target.files)}
            />
            <button onClick={() => fileInputRef.current?.click()} className={className}>{children}</button>
        </>
    )
}
