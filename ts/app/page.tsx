import Image from "next/image";
import Link from "next/link";
import Tools96 from "@/img/tools-96.png";
import EasyTransfer255 from "@/img/easy-transfer-255.png";

export default function Home() {
  return (
    <>
      <header className="flex justify-center items-center p-3 bg-green-50">
        <Image src={Tools96} alt="便利工具集" width={64} />
        <h1 className="text-3xl">便利工具集</h1>
      </header>    
      <main>
        <ul className="container mx-auto">
          <li className="m-2 ml-0 mr-0">
            <Link className="flex p-2 pl-3 pr-3" href="/et">
              <div className="mr-3">
                <Image src={EasyTransfer255} alt="易传" width={64} />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <strong>易传</strong>
                <p className="text-sm text-gray-600">手机电脑互传，大文件传输，点对点传输，网页传输</p>
              </div>
            </Link>
          </li>
        </ul>
      </main>
    </>
  )
}
