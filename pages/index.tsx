import dynamic from "next/dynamic";
import type { GetServerSideProps } from "next";
import { readFile } from "fs/promises";
import { join } from "path";
import pilot1Metadata from "../data/pilot1/medata.json";
import { parseCSV, summarizeFishData, type FishData } from "@/lib/csv-utils";

const GoogleMapComponent = dynamic(() => import("../components/GoogleMap"), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});

interface HomeProps {
  summary: string;
  fishData: FishData[];
}

// 서버 사이드에서 CSV 파일을 읽어서 props로 전달
export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  try {
    const csvPath = join(process.cwd(), "public", "data", "pilot1", "rows.csv");
    const csvContent = await readFile(csvPath, "utf-8");
    const fishData = parseCSV(csvContent);
    const summary = summarizeFishData(fishData);

    return {
      props: {
        summary,
        fishData,
      },
    };
  } catch (error) {
    console.error("CSV 파일을 읽는 중 오류 발생:", error);
    return {
      props: {
        summary: "데이터를 불러올 수 없습니다.",
        fishData: [],
      },
    };
  }
};

export default function Home({ summary, fishData }: HomeProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY ||
    "";

  // pilot1 위치 정보
  const pilot1Location = {
    lat: pilot1Metadata.location.lat,
    lng: pilot1Metadata.location.lon,
  };

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
          E-DNA Citizen Science
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
