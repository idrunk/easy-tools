"use client"

import { useState, useEffect, ReactNode, createContext, useContext, useRef } from "react";
import { createPortal } from "react-dom";

const ToastContext = createContext<(message: string, callback?: () => void, delay?: number) => void>(() => { });

const ToastContainer = ({ toastRef }: { toastRef: React.RefObject<(message: string, callback?: () => void, delay?: number) => void> }) => {
    const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        toastRef.current = (message: string, callback?: () => void, delay: number = 5000) => {
            const id = Date.now();
            setToasts((prev) => [...prev, { id, message }]);
            setTimeout(() => {
                setToasts((prev) => prev.filter((toast) => toast.id !== id));
                callback && callback();
            }, delay);
        };
    }, []);
    if (!mounted) return null;

    return createPortal(
        <div className="fixed top-10 space-y-3 left-1/2 -translate-x-1/2">
            {toasts.map(({ id, message }) => (
                <div key={id} className="px-4 py-2 bg-yellow-100 text-sm leading-6 rounded-lg shadow-lg transition-opacity duration-1000 opacity-100">
                    {message}
                </div>
            ))}
        </div>,
        document.body
    );
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const toastRef = useRef<(message: string, callback?: () => void, delay?: number) => void>(() => { });
    return (
        <ToastContext.Provider value={(msg, callback, delay) => toastRef.current(msg, callback, delay)}>
            {children}
            <ToastContainer toastRef={toastRef} />
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext);
