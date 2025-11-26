import {
  GoogleMap,
  LoadScript,
  Marker,
  OverlayView,
} from "@react-google-maps/api";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { FishData } from "@/lib/csv-utils";

const containerStyle = {
  width: "100%",
  height: "600px",
};

const defaultCenter = {
  lat: 37.5665,
  lng: 126.978, // 서울시청 좌표
};

// 물고기 모양 SVG 아이콘 (Font Awesome Fish)
const fishIcon = {
  path: "M546.2 9.7c-5.6-12.5-21.6-13-28.3-1.2C486.9 62.4 431.4 96 368 96h-80C182 96 96 182 96 288c0 7 .8 13.7 1.5 20.5C161.3 262.2 253.4 224 384 224c8.8 0 16 7.2 16 16s-7.2 16-16 16C253.4 256 161.3 293.8 97.5 343.5c-.8 6.8-1.5 13.5-1.5 20.5 0 106 86 192 192 192h80c63.4 0 118.9 33.6 149.9 87.5 6.7 11.8 22.7 11.3 28.3-1.2 5.5-12.3 1.2-27-13-31-34.2-9.6-58.3-41.3-58.3-76.9V107.7c0-35.6 24.1-67.3 58.3-76.9 14.2-4 18.5-18.7 13-31zM352 352c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z",
  fillColor: "#4285F4",
  fillOpacity: 1,
  strokeColor: "#ffffff",
  strokeWeight: 2,
  scale: 0.06,
  anchor: { x: 288, y: 256 },
} as any;

interface MarkerData {
  position: { lat: number; lng: number };
  label?: string;
  title?: string;
  summary?: string;
  fishData?: FishData[];
}

interface GoogleMapComponentProps {
  apiKey: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
}

// 차트 색상 팔레트
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF7C7C",
  "#8DD1E1",
  "#D084D0",
  "#FFB347",
  "#87CEEB",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
];

function PieChartComponent({ fishData }: { fishData: FishData[] }) {
  // reads_count 기준으로 정렬
  const sortedData = [...fishData].sort(
    (a, b) => b.reads_count - a.reads_count
  );

  // 상위 5개만 표시
  const top5 = sortedData.slice(0, 5);

  // 나머지는 Others로 묶기
  const others = sortedData.slice(5);
  const othersTotal = others.reduce((sum, fish) => sum + fish.reads_count, 0);

  const chartData = top5.map((fish) => ({
    name: fish.common_name,
    value: fish.reads_count,
    scientificName: fish.scientific_name,
  }));

  // Others가 있으면 추가
  if (othersTotal > 0) {
    chartData.push({
      name: "Others",
      value: othersTotal,
      scientificName: "",
    });
  }

  const totalReads = fishData.reduce((sum, fish) => sum + fish.reads_count, 0);

  return (
    <div className="w-full space-y-4">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }: any) => {
              const percentageValue = (percent || 0) * 100;
              const percentage = percentageValue.toFixed(1);
              return percentageValue > 3 ? `${name}\n${percentage}%` : "";
            }}
            outerRadius={85}
            innerRadius={30}
            fill="#8884d8"
            dataKey="value"
            stroke="#fff"
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <RechartsTooltip
            formatter={(value: number, payload: any) => {
              const percentage = ((value / totalReads) * 100).toFixed(1);
              const data = Array.isArray(payload) ? payload[0] : payload;
              const name = data?.payload?.name || data?.name || "";
              const scientificName = data?.payload?.scientificName || "";
              const label = scientificName
                ? `${name}\n${scientificName}\n읽기 수: ${value.toLocaleString()} (${percentage}%)`
                : `${name}\n읽기 수: ${value.toLocaleString()} (${percentage}%)`;
              return [label, "읽기 수"];
            }}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              whiteSpace: "pre-line",
            }}
            labelStyle={{
              fontWeight: "600",
              marginBottom: "4px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {chartData.slice(0, 6).map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{entry.name}</div>
              {entry.scientificName && (
                <div className="text-muted-foreground text-[10px] truncate">
                  {entry.scientificName}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TooltipOverlay({
  position,
  title,
  summary,
  fishData,
  onClose,
}: {
  position: { lat: number; lng: number };
  title?: string;
  summary?: string;
  fishData?: FishData[];
  onClose: () => void;
}) {
  const totalReads =
    fishData?.reduce((sum, fish) => sum + fish.reads_count, 0) || 0;
  const speciesCount = fishData?.length || 0;
  const topSpecies = fishData
    ? [...fishData].sort((a, b) => b.reads_count - a.reads_count).slice(0, 3)
    : [];

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: -(width / 2),
        y: -(height + 10),
      })}
    >
      <div
        className={cn(
          "relative bg-white text-gray-900",
          "rounded-xl border border-gray-200 shadow-2xl",
          "px-6 py-5 min-w-[360px] max-w-[420px] max-h-[600px]",
          "animate-in fade-in-0 zoom-in-95",
          "pointer-events-auto flex flex-col",
          "backdrop-blur-sm"
        )}
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-colors z-20 shadow-sm"
          aria-label="닫기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* 제목 */}
        <div className="pr-8 mb-4">
          <h3 className="text-xl font-bold text-gray-900">
            {title || "어류 정보"}
          </h3>
        </div>

        {/* 파이 차트 */}
        {fishData && fishData.length > 0 && (
          <div className="mb-5 flex-shrink-0 border-b border-gray-100 pb-5">
            <PieChartComponent fishData={fishData} />
          </div>
        )}

        {/* 통계 정보 */}
        {fishData && fishData.length > 0 && (
          <div className="space-y-4 mb-4 flex-shrink-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-xs text-blue-600 font-medium mb-1">
                  발견된 종류
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {speciesCount}
                  <span className="text-sm font-normal text-blue-700 ml-1">
                    종
                  </span>
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                <div className="text-xs text-green-600 font-medium mb-1">
                  총 읽기 수
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {totalReads.toLocaleString()}
                </div>
              </div>
            </div>

            {/* 주요 종류 */}
            {topSpecies.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="text-sm font-semibold text-gray-700 mb-3">
                  주요 종류
                </div>
                <div className="space-y-2">
                  {topSpecies.map((fish, index) => {
                    const percentage = (
                      (fish.reads_count / totalReads) *
                      100
                    ).toFixed(1);
                    return (
                      <div
                        key={index}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 w-4">
                              {index + 1}.
                            </span>
                            <span className="font-semibold text-gray-900">
                              {fish.common_name}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 ml-6 mt-0.5">
                            {fish.scientific_name}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-gray-900">
                            {fish.reads_count.toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {percentage}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 요약 텍스트 */}
        {summary && (
          <div
            className="text-sm text-gray-600 whitespace-pre-line overflow-y-auto flex-1 max-h-[200px] pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
            onWheel={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {summary}
          </div>
        )}
      </div>
    </OverlayView>
  );
}

function MapContent({
  center = defaultCenter,
  zoom = 13,
  markers = [],
  selectedMarkerIndex,
  setSelectedMarkerIndex,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MarkerData[];
  selectedMarkerIndex: number | null;
  setSelectedMarkerIndex: (index: number | null) => void;
}) {
  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom}
      onClick={() => {
        setSelectedMarkerIndex(null);
      }}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: "greedy",
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "landscape",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "road",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      }}
    >
      {markers.map((marker, index) => (
        <Marker
          key={index}
          position={marker.position}
          icon={fishIcon}
          title={marker.title || marker.label}
          onClick={() => {
            setSelectedMarkerIndex(index);
          }}
        />
      ))}
      {selectedMarkerIndex !== null &&
        markers[selectedMarkerIndex]?.summary && (
          <TooltipOverlay
            position={markers[selectedMarkerIndex].position}
            title={
              markers[selectedMarkerIndex].title ||
              markers[selectedMarkerIndex].label
            }
            summary={markers[selectedMarkerIndex].summary}
            fishData={markers[selectedMarkerIndex].fishData}
            onClose={() => setSelectedMarkerIndex(null)}
          />
        )}
    </GoogleMap>
  );
}

export default function GoogleMapComponent({
  apiKey,
  center = defaultCenter,
  zoom = 13,
  markers = [],
}: GoogleMapComponentProps) {
  const libraries: any[] = useMemo(() => ["places"], []);
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(
    null
  );

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <MapContent
        center={center}
        zoom={zoom}
        markers={markers}
        selectedMarkerIndex={selectedMarkerIndex}
        setSelectedMarkerIndex={setSelectedMarkerIndex}
      />
    </LoadScript>
  );
}
