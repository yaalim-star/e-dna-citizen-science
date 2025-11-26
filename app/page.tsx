import GoogleMapComponent from "./components/GoogleMap";
import pilot1Metadata from "./data/pilot1/medata.json";
import { readFileSync } from "fs";
import { join } from "path";
import { parseCSV, summarizeFishData } from "@/lib/csv-utils";

export default function Home() {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY ||
    "";

  // pilot1 위치 정보
  const pilot1Location = {
    lat: pilot1Metadata.location.lat,
    lng: pilot1Metadata.location.lon,
  };

  // rows.csv 파일 읽기 및 처리
  let summary = "";
  let fishData: ReturnType<typeof parseCSV> = [];
  try {
    const csvPath = join(process.cwd(), "app/data/pilot1/rows.csv");
    const csvContent = readFileSync(csvPath, "utf-8");
    fishData = parseCSV(csvContent);
    summary = summarizeFishData(fishData);
  } catch (error) {
    console.error("CSV 파일을 읽는 중 오류 발생:", error);
    summary = "데이터를 불러올 수 없습니다.";
  }

  if (!apiKey) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
          <h1 className="text-4xl font-bold text-center mb-8">
            e-DNA Citizen Science
          </h1>
          <p className="text-center text-lg text-red-500">
            구글 지도 API 키가 설정되지 않았습니다.
            NEXT_PUBLIC_GOOGLE_MAP_API_KEY 환경 변수를 설정해주세요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="z-10 max-w-7xl w-full items-center justify-between font-mono text-sm mb-8">
        <h1 className="text-4xl font-bold text-center mb-4">
          e-DNA Citizen Science
        </h1>
      </div>
      <div className="w-full max-w-7xl rounded-lg overflow-hidden shadow-lg">
        <GoogleMapComponent
          apiKey={apiKey}
          center={pilot1Location}
          markers={[
            {
              position: pilot1Location,
              title: "Pilot 1",
              summary: summary,
              fishData: fishData,
            },
          ]}
        />
      </div>
    </main>
  );
}
