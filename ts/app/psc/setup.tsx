'use client';

import { Metadata } from 'next';
import ModuleLayout, { ModuleMeta } from '../module-layout';
import { useEffect, useState } from 'react';
import Decoder, { encode, encodeType1sComplement, encodeTypeTypical, productTypeImage, productTypeLink, } from './de/codec';

export default function ({ meta, code }: {meta: Metadata & ModuleMeta, code?: string}) {
    if (code) {
        return <Decoder code={code} />;
    }
    const [isEncode, setIsEncode] = useState(true);
    const [encoded, setEncoded] = useState('');
    const [content, setContent] = useState('');
    const [codeFlag, setCodeFlag] = useState(encodeTypeTypical);
    const [product, setProduct] = useState('');
    useEffect(() => {
        const text = content?.trim() ?? '';
        if (text.length === 0) return;
        if (isEncode) {
            const encoded = encode(text, codeFlag);
            if (codeFlag & productTypeLink) {
                setProduct(`${location.protocol}//${location.host}/psc/de#${encoded}`);
            } else {
                setProduct(encoded);
            }
        } else {
            const matched = text.match(/^https?:\/\/[^#]+#([a-zA-Z0-9+/]+=*)$/);
            setEncoded(matched ? matched[1] : text);
        }
    }, [isEncode, codeFlag, content])
    const encodeTypeChecked = (checks: number) => checks === (codeFlag & encodeType1sComplement);
    const setEncodeFlag = (elem: HTMLInputElement) => elem.checked && setCodeFlag(prev => (prev & ~encodeType1sComplement) | parseInt(elem.value));
    const productTypeChecked = (checks: number) => checks === (codeFlag & (productTypeLink | productTypeImage));
    const setProductFlag = (elem: HTMLInputElement) => elem.checked && setCodeFlag(prev => (prev & ~(productTypeLink | productTypeImage)) | parseInt(elem.value));
    return (
        <ModuleLayout name={meta.title} href={meta.link} description={meta.description} logo={meta.logo} className={meta.className}>
            <div className='p-4 flex flex-col space-y-2'>
                <div className='flex space-x-2'>
                    <label className='flex gap-1'>
                        <input onChange={() => setIsEncode(true)} checked={isEncode} type="radio" name="method" />
                        编码
                    </label>
                    <label className='flex gap-1'>
                        <input onChange={() => setIsEncode(false)} checked={!isEncode} type="radio" name="method" />
                        解码
                    </label>
                </div>
                <div>
                    <input className='border rounded p-1 pl-2 pr-2 w-full' onChange={e => setContent(e.target.value)} placeholder={`输入待 ${isEncode ? '编' : '解'}码 内容`} />
                </div>
                {isEncode ? <>
                    <div className="flex space-x-2">
                        <p>编码方式：</p>
                        <label className='flex gap-1'>
                            <input onChange={e => setEncodeFlag(e.target)} checked={encodeTypeChecked(encodeTypeTypical)} value={encodeTypeTypical} type="radio" name="encode-type" />
                            正常
                        </label>
                        <label className='flex gap-1'>
                            <input onChange={e => setEncodeFlag(e.target)} checked={encodeTypeChecked(encodeType1sComplement)} value={encodeType1sComplement} type="radio" name="encode-type" />
                            反码
                        </label>
                    </div>
                    <div className="flex space-x-2">
                        <p>产物类型：</p>
                        <label className='flex gap-1'>
                            <input onChange={e => setProductFlag(e.target)} checked={productTypeChecked(encodeTypeTypical)} value={encodeTypeTypical} type="radio" name="product-type" />
                            文本
                        </label>
                        <label className='flex gap-1'>
                            <input onChange={e => setProductFlag(e.target)} checked={productTypeChecked(productTypeLink)} value={productTypeLink} type="radio" name="product-type" />
                            链接
                        </label>
                        <label className='flex gap-1'>
                            <input onChange={e => setProductFlag(e.target)} checked={productTypeChecked(productTypeImage)} value={productTypeImage} type="radio" name="product-type" disabled />
                            图片
                        </label>
                    </div>
                    <div>
                        <div className='border rounded p-1 pl-2 pr-2' contentEditable suppressContentEditableWarning>{product}</div>
                    </div>
                </> : (
                    <Decoder code={encoded} />
                )}
            </div>
        </ModuleLayout>
    )
}