'use client'

import React, { useState, useRef } from "react"

type Position = {
    bottom: number,
    left: number,
    width: number,
}

type PopupProps = {
    maxWidth?: number,
}

export default function usePopup({ maxWidth = 300 }: PopupProps) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<Position>({ bottom: 0, left: 0, width: maxWidth });
    const popupRef = useRef<HTMLDivElement | null>(null);

    const showPopup = (event: React.MouseEvent<HTMLElement>) => {
        const triggerRect = event.currentTarget.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const width = Math.min(maxWidth, screenWidth - 20);

        let left = triggerRect.left - (width - triggerRect.width) / 2;
        if (left + width > screenWidth) left = screenWidth - width - 10;
        if (left < 10) left = 10;
        const bottom = window.innerHeight - triggerRect.top + 10;

        setPosition({ bottom: bottom, left, width });
        setOpen(true);
    }
    const hidePopup = () => setOpen(false);

    const PopupComponent = ({children}: {children: React.ReactNode}) => open ? (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-30 z-50" onClick={hidePopup}></div>
            <div
                ref={popupRef}
                style={{ bottom: position.bottom, left: position.left, width: position.width }}
                className="absolute bg-white p-4 shadow-lg rounded-lg z-50"
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </>
    ) : null;

    return { showPopup, hidePopup, Popup: PopupComponent };
}
