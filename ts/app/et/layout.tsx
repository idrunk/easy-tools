import React from 'react';
import EasyTransferLogo from "@/img/easy-transfer-255.png";
import { Metadata } from 'next/types';
import ModuleLayout, { ModuleMeta } from '../module-layout';

export const metadata: Metadata & ModuleMeta = {
  title: '易传',
  description: '手机电脑互传，大文件传输，点对点传输，网页传输',
  keywords: ["点对点", "p2p", "文件传输", "局域网传输", "易传"],
  link: '/et',
  logo: EasyTransferLogo,
  className: 'max-w-screen-xl',
};

export default function EasyTransferLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleLayout name={metadata.title} href={metadata.link} description={metadata.description} logo={metadata.logo} className={metadata.className}>
      {children}
    </ModuleLayout>
  )
}