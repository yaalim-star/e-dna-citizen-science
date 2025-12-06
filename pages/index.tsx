import dynamic from "next/dynamic";
import type { GetServerSideProps } from "next";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { parseCSV, summarizeFishData, type FishData } from "@/lib/csv-utils";

const GoogleMapComponent = dynamic(() => import("../components/GoogleMap"), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});

interface PlaceData {
  summary: string;
  fishData: FishData[];
  metadata: {
    location: {
      lat: number;
      lon: number;
    };
    taxa: string;
    sample_name?: string;
  };
}

interface HomeProps {
  places: Array<{
    placeName: string;
    data: PlaceData;
  }>;
}

// 서버 사이드에서 CSV 파일을 읽어서 props로 전달
export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  try {
    const dataDir = join(process.cwd(), "data");
    const dirs = await readdir(dataDir, { withFileTypes: true });
    
    // place로 시작하는 폴더만 필터링
    const placeDirs = dirs
      .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith("place"))
      .map((dirent) => dirent.name)
      .sort(); // place1, place2, ... 순서로 정렬

    const places = await Promise.all(
      placeDirs.map(async (placeName) => {
        try {
          const metadataPath = join(dataDir, placeName, "medata.json");
          const csvPath = join(dataDir, placeName, "rows.csv");

          const [metadataContent, csvContent] = await Promise.all([
            readFile(metadataPath, "utf-8"),
            readFile(csvPath, "utf-8"),
          ]);

          const metadata = JSON.parse(metadataContent);
          const fishData = parseCSV(csvContent);
          const summary = summarizeFishData(fishData, metadata.taxa);

          return {
            placeName,
            data: {
              summary,
              fishData,
              metadata,
            },
          };
        } catch (error) {
          console.error(`Error loading ${placeName}:`, error);
          return null;
        }
      })
    );

    // null 값 제거
    const validPlaces = places.filter((place) => place !== null) as Array<{
      placeName: string;
      data: PlaceData;
    }>;

    return {
      props: {
        places: validPlaces,
      },
    };
  } catch (error) {
    console.error("CSV 파일을 읽는 중 오류 발생:", error);
    return {
      props: {
        places: [],
      },
    };
  }
};

export default function Home({ places }: HomeProps) {
  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY ||
    process.env.GOOGLE_MAP_API_KEY ||
    "";

  // 모든 마커 생성
  const markers = places.map((place) => ({
    position: {
      lat: place.data.metadata.location.lat,
      lng: place.data.metadata.location.lon,
    },
    title: place.placeName,
    summary: place.data.summary,
    fishData: place.data.fishData,
    taxa: place.data.metadata.taxa,
  }));

  // 모든 마커의 중심점 계산
  const centerLocation =
    markers.length > 0
      ? {
          lat:
            markers.reduce((sum, m) => sum + m.position.lat, 0) /
            markers.length,
          lng:
            markers.reduce((sum, m) => sum + m.position.lng, 0) /
            markers.length,
        }
      : { lat: 37.4, lng: 127.1 };

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
    <main className="flex min-h-screen flex-col p-8">
      <div className="z-10 w-full items-center justify-between text-sm mb-2">
        <h1 className="text-3xl font-bold text-center mb-2">
          E-DNA Citizen Science
        </h1>
      </div>
      <div className="w-full rounded-lg overflow-hidden shadow-lg">
        <GoogleMapComponent
          apiKey={apiKey}
          center={centerLocation}
          markers={markers}
        />
      </div>
    </main>
  );
}
