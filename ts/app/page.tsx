import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next/types";
import Tools96 from "@/img/tools-96.png";
import {metadata as etMeta} from "./et/layout";
import {metadata as pscMeta} from "./psc/page";

export const metadata: Metadata = {
  title: '便利工具集',
  description: '这里有工作、生活中可能需要用到的便利工具',
};

export default function Home() {
  return (
    <>
      <header className="flex justify-center items-center p-3 bg-green-50">
        <Image src={Tools96} alt={String(metadata.title)} width={64} />
        <h1 className="text-3xl">{String(metadata.title)}</h1>
      </header>    
      <main>
        <ul className="container mx-auto">
          <li className="m-2 ml-0 mr-0">
            <Link className="flex p-2 pl-3 pr-3" href={etMeta.link}>
              <div className="mr-3">
                <Image src={etMeta.logo} alt={etMeta.title} width={64} />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <strong>{etMeta.title}</strong>
                <p className="text-sm text-gray-600">{etMeta.description}</p>
              </div>
            </Link>
          </li>
          
          <li className="m-2 ml-0 mr-0">
            <Link className="flex p-2 pl-3 pr-3" href={pscMeta.link}>
              <div className="mr-3">
                <Image src={pscMeta.logo} alt={pscMeta.title} width={64} />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <strong>{pscMeta.title}</strong>
                <p className="text-sm text-gray-600">{pscMeta.description}</p>
              </div>
            </Link>
          </li>
        </ul>
      </main>
    </>
  )
}
