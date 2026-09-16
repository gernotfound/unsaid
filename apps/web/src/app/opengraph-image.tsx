import { ImageResponse } from "next/og";
import { BRAND } from "@unsaid/domain";

export const alt = "UNSAID — independent statement-wear archive";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const WORDMARK = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMzIzIDIzNyIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJVTlNBSUQiPgogIDxwYXRoIGZpbGw9IiNmOGZhZmMiIGZpbGwtcnVsZT0iZXZlbm9kZCIgZD0iTSAxMzE4IDEyNCBMIDEyNTYgMTI0IEwgMTI1MyAxMzggTCAxMjQ0IDE1NCBMIDEyMjUgMTcwIEwgMTIwNiAxNzYgTCAxMTMyIDE3NiBMIDExMzEgMTMxIEwgMTA3NyAxMzEgTCAxMDc3IDIzMSBMIDEyMTUgMjMxIEwgMTIzNiAyMjcgTCAxMjUyIDIyMSBMIDEyODIgMjAxIEwgMTMwMCAxODAgTCAxMzA5IDE2NCBMIDEzMTUgMTQ3IFogTSA0OTkgOTYgTCA1MDQgMTEyIEwgNTEyIDEyNSBMIDUyNyAxMzkgTCA1NDUgMTQ4IEwgNTU4IDE1MSBMIDY2OSAxNTEgTCA2NzQgMTUzIEwgNjc5IDE2MSBMIDY3NiAxNzAgTCA2NjMgMTc4IEwgNTAxIDE3OCBMIDUwMSAyMzEgTCA2NzEgMjMxIEwgNjgzIDIyOSBMIDcwNCAyMjAgTCA3MTUgMjEyIEwgNzI3IDE5OSBMIDczNyAxODEgTCA3NDEgMTY0IEwgNzQxIDE0NCBMIDczNiAxMjggTCA3MjAgMTA4IEwgNzAzIDk4IEwgNjkyIDk1IFogTSAxMDc3IDExIEwgMTA3NyA2OCBMIDEyMTQgNjggTCAxMjM1IDc2IEwgMTI0NiA4NiBMIDEyNTQgOTkgTCAxMzE2IDk4IEwgMTMxMCA3NiBMIDEyOTQgNTEgTCAxMjcwIDMwIEwgMTI0NSAxNyBMIDEyMjAgMTEgWiBNIDI2OCAxMSBMIDI2NyAyMjkgTCAzMjYgMjI5IEwgMzI3IDExMyBMIDQzNyAyMzEgTCA0ODUgMjMxIEwgNDg2IDExIEwgNDI3IDEyIEwgNDI4IDEyNyBMIDQyNiAxMzIgTCAzMTYgMTEgWiBNIDI1NSAxMSBMIDE5NyAxMiBMIDE5NyAxNDggTCAxODkgMTY2IEwgMTc4IDE3NiBMIDE2NiAxODIgTCAxNTIgMTgyIEwgNSAxMjAgTCA2IDE1NCBMIDEwIDE2NyBMIDIzIDE5MCBMIDM5IDIwNyBMIDU1IDIxOCBMIDc2IDIyNyBMIDEwMSAyMzIgTCAxNjMgMjMyIEwgMTc2IDIzMCBMIDE5OCAyMjMgTCAyMTkgMjExIEwgMjQxIDE4OSBMIDI1MSAxNzAgTCAyNTQgMTU5IFogTSA1IDExIEwgNSAxMDEgTCA2MyAxMjUgTCA2MyAxMiBaIE0gMTAwNiAxMCBMIDEwMDUgMjMxIEwgMTA2NCAyMzEgTCAxMDY0IDExIFogTSA0OTkgNjggTCA3MTAgNjggTCA3MzcgOCBMIDU2MyA3IEwgNTQ4IDEwIEwgNTI4IDIwIEwgNTEzIDM0IEwgNTAzIDUxIFogTSAxMDAzIDIzMCBMIDg3NiAyNSBMIDg2MSA1IEwgNzE5IDIzMSBMIDc4NiAyMzEgTCA4NjEgMTE2IEwgODk4IDE3NyBMIDgzNCAxNzggTCA4MDEgMjMxIFoiLz4KPC9zdmc+";
const MARK = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzODAgMzY1IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IlVOU0FJRCI+CiAgPHBhdGggZmlsbD0iI2Y4ZmFmYyIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNIDc4IDE4MSBMIDc5IDE4MCBMIDE0MCAyMTIgTCAyMjIgMjU4IEwgMjU2IDI3NSBMIDI2MCAyNzkgTCAyNDAgMjg4IEwgMjE2IDI5MiBMIDE1NCAyOTEgTCAxMzkgMjg4IEwgMTE4IDI3OSBMIDEwNyAyNzIgTCA5MyAyNTggTCA4MyAyNDEgTCA3OCAyMjIgWiBNIDMwMSA4MSBMIDMwMSAyMjcgTCAyOTggMjM5IEwgMjkyIDI1MSBMIDI3MyAyNzEgTCAyMjYgMjQ1IEwgMjQwIDIzNCBMIDI0NSAyMjcgTCAyNDkgMjE2IEwgMjUwIDgyIFogTSA3OSA4MSBMIDEyOSA4MiBMIDEyOCAxOTEgTCA3OCAxNjQgWiBNIDE4IDE5IEwgNyAzNiBMIDQgNDggTCA0IDMxNyBMIDEwIDMzNiBMIDIzIDM1MSBMIDM2IDM1OCBMIDQ2IDM2MCBMIDMzMyAzNjAgTCAzNTIgMzUzIEwgMzY0IDM0MiBMIDM3MSAzMzAgTCAzNzQgMzIwIEwgMzc0IDQ1IEwgMzY4IDI5IEwgMzYwIDE4IEwgMzUwIDExIEwgMzM1IDUgTCAzMTYgNCBMIDU5IDQgTCA0NSA1IEwgMzUgOCBaIi8+Cjwvc3ZnPg==";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        background: "#05070b",
        color: "#f8fafc",
        padding: "42px 56px 46px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ display: "flex", position: "absolute", inset: "0 0 auto 0", height: 18 }}>
        <div style={{ display: "flex", width: 270, background: "#f472b6" }} />
        <div style={{ display: "flex", width: 240, background: "#22d3ee" }} />
        <div style={{ display: "flex", width: 230, background: "#7c3aed" }} />
        <div style={{ display: "flex", width: 220, background: "#fbbf24" }} />
        <div style={{ display: "flex", flex: 1, background: "#ea580c" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32 }}>
        <img src={MARK} alt="" width={126} height={121} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 118,
            height: 68,
            borderRadius: 10,
            background: "#f472b6",
            color: "#05070b",
            fontSize: 19,
            fontWeight: 900,
            letterSpacing: 1,
          }}
        >
          UN/01
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <img src={WORDMARK} alt={BRAND.name} width={1010} height={181} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 900, letterSpacing: 1.5 }}>
            INDEPENDENT STATEMENT-WEAR ARCHIVE
          </div>
          <div style={{ display: "flex", color: "#8b95a7", fontSize: 22, fontWeight: 700 }}>
            Continuous archive · Italy · {BRAND.tagline}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
