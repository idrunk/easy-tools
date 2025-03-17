'use client'

import dynamic from 'next/dynamic';

export default function() {
    const Scanner = dynamic(() => import('./scanner'), {ssr: false});
    return <Scanner />;
}