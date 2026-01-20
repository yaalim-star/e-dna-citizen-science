import dynamic from "next/dynamic";
import type { GetServerSideProps } from "next";
import { readFile, readdir, access } from "fs/promises";
import { join } from "path";
import { parseCSV, summarizeFishData, type FishData } from "@/lib/csv-utils";
import { parseExcelFile } from "@/lib/xlsx-utils";

const GoogleMapComponent = dynamic(() => import("../components/GoogleMap"), {
  ssr: false,
  loading: () => <p>Loading map...</p>,
});

interface DateSpecificData {
  date: number;
  sampling: number;
  fishData: FishData[];
  metadata: {
    date: number;
    sampling?: number | null;
    object?: string | null;
    do?: number | null;
    spc?: number | null;
    pH?: number | null;
    primer?: string | null;
    manager?: string | null;
    marker?: string | null;
  };
}

interface PlaceData {
  summary: string;
  fishData: FishData[];
  dateData: DateSpecificData[];
  avgMetadata: {
    do?: number | null;
    spc?: number | null;
    pH?: number | null;
  };
  metadata: {
    location: {
      lat: number;
      lon: number;
    };
    taxa: string;
    marker?: string | null;
    manager?: string | null;
    primer?: string | null;
    object?: string | null;
    sample_name?: string;
  };
}

interface HomeProps {
  places: Array<{
    placeName: string;
    data: PlaceData;
  }>;
}

// undefined 값을 null로 변환하는 헬퍼 함수 (Next.js JSON 직렬화를 위해 필요)
function replaceUndefinedWithNull<T>(obj: T): T {
  if (obj === undefined) {
    return null as T;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(replaceUndefinedWithNull) as T;
  }
  const result: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = (obj as any)[key];
      result[key] = replaceUndefinedWithNull(value);
    }
  }
  return result;
}

// 서버 사이드에서 엑셀 또는 CSV 파일을 읽어서 props로 전달
export const getServerSideProps: GetServerSideProps<HomeProps> = async () => {
  try {
    const dataDir = join(process.cwd(), "data");
    const excelPath = join(dataDir, "edna_result_demo_ver2.xlsx");

    // 엑셀 파일이 있으면 엑셀 파일 사용, 없으면 기존 CSV 방식 사용
    try {
      await access(excelPath);
      // 엑셀 파일 읽기 ('전체 정리' 시트 사용)
      const excelPlaces = parseExcelFile(excelPath, '전체 정리');

      const places = excelPlaces.map((excelPlace, index) => {
        const summary = summarizeFishData(excelPlace.fishData, excelPlace.taxa);
        
        return {
          placeName: excelPlace.metadata.marker || `place${index + 1}`,
          data: {
            summary,
            fishData: excelPlace.fishData,
            dateData: excelPlace.dateData,
            avgMetadata: excelPlace.avgMetadata,
            metadata: excelPlace.metadata,
          },
        };
      });

      // undefined 값을 null로 변환하여 JSON 직렬화 오류 방지
      const sanitizedPlaces = replaceUndefinedWithNull(places);

      return {
        props: {
          places: sanitizedPlaces,
        },
      };
    } catch (excelError) {
      // 엑셀 파일이 없으면 기존 CSV 방식 사용
      console.log("엑셀 파일을 찾을 수 없어 CSV 방식으로 전환합니다.");

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
    }
  } catch (error) {
    console.error("데이터 파일을 읽는 중 오류 발생:", error);
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
    title: place.data.metadata.marker || place.placeName,
    summary: place.data.summary,
    fishData: place.data.fishData,
    taxa: place.data.metadata.taxa,
    metadata: place.data.metadata,
    dateData: place.data.dateData,
    avgMetadata: place.data.avgMetadata,
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
    <main className="flex min-h-screen flex-col pt-4 px-8 pb-8">
      <div className="z-10 w-full items-center justify-between text-sm mb-2 flex items-center">
        <div className="flex-1"></div>
        <div className="flex-1 text-center">
          <h1 className="text-3xl font-bold mb-2">
            E-DNA Citizen Science
          </h1>
          <h2 className="text-lg font-medium text-gray-600">
            <a 
              href="https://yerimyu.shinyapps.io/r_studio/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-blue-600 hover:underline transition-colors"
            >
              eDNA metabarcording dashbord
            </a>
          </h2>
        </div>
        <div className="flex-1 flex justify-end">
          <img 
            src="/LEP 로고.png" 
            alt="LEP 로고" 
            className="h-10 w-auto object-contain"
          />
        </div>
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
