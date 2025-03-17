import { RefObject, useEffect, useRef, useState } from "react"

export default function() {
    console.log("entered");

    const videoRef: RefObject<HTMLVideoElement|null> = useRef(null);
    const [exception, setException] = useState("");
    useEffect(() => {
        try {
            navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            }).then(stream => {
                videoRef.current && (videoRef.current.srcObject = stream)
            });
        } catch (e) {
            console.log(e);
            setException(String(e));
        }
    }, [])
    return (
        <div className="absolute z-40 left-0 top-0 w-full h-full bg-slate-400">
            <code>{exception}</code>
            <video ref={videoRef} autoPlay muted className="w-full h-full"></video>
        </div>
    )
}