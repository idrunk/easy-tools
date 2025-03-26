'use client';

import dynamic from 'next/dynamic';

export default function({code}: {code?: string}) {
    if (code) {
        const Decoder = dynamic(() => import('./decoder'), { ssr: false });
        return <Decoder code={code} />;
    }
    return;
}