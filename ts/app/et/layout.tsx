import React from 'react';
import EasyTransferLogo from "@/img/easy-transfer-255.png";
import Image from 'next/image';
import Link from 'next/link';

export default function EasyTransferLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className='flex flex-col h-screen overflow-hidden'>
        <header className='bg-slate-100'>
          <div className='max-w-screen-xl container mx-auto p-3 pl-4 pr-4 flex items-center'>
            <Link className='text-2xl mr-3 text-gray-400' href='/'>🏠︎</Link>
            <Link className='flex items-center' href="/et">
              <Image src={EasyTransferLogo} width={40} alt='易传' />
              <h1 className='text-2xl pl-2 pr-3 pt-0 pb-0'>易传</h1>
            </Link>
            <p className='flex-1 text-sm text-gray-500'>手机电脑互传，大文件传输，点对点传输，网页传输</p>
          </div>
        </header>
        <main className='flex-1 max-w-screen-xl container mx-auto overflow-hidden'>
          {children}
        </main>
      </div>
    </>
  )
}