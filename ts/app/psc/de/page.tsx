'use client';

import dynamic from 'next/dynamic';

export default function De() {
    const Decoder = dynamic(() => import('./codec'), { ssr: false });
    return <Decoder />;
}