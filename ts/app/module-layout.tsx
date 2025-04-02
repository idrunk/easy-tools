import Link from "next/link";
import Image, { StaticImageData } from "next/image";

export type ModuleMeta = {
    title: string,
    description: string,
    link: string,
    logo: StaticImageData,
    className: string,
}

export default function ModuleLayout({ name, href, description, logo, children, className }: {
    name: string,
    href: string,
    description: string,
    logo: StaticImageData,
    children: React.ReactNode,
    className: string
}) {
    return (
        <div className='flex flex-col h-screen overflow-hidden'>
            <header className='bg-slate-100'>
                <div className='max-w-screen-xl container mx-auto p-3 pl-4 pr-4 flex items-center'>
                    <Link className='text-2xl mr-3 text-gray-400' href='/'>🏠︎</Link>
                    <Link className='flex items-center' href={href}>
                        <Image src={logo} width={40} alt={name} />
                        <h1 className='text-2xl pl-2 pr-3 pt-0 pb-0'>{name}</h1>
                    </Link>
                    <p className='flex-1 text-sm text-gray-500'>{description}</p>
                </div>
            </header>
            <main className={`flex-1 container mx-auto overflow-hidden ${className}`}>
                {children}
            </main>
        </div>
    )
}