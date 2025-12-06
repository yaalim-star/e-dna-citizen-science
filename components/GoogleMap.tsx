import {
  GoogleMap,
  LoadScript,
  Marker,
} from "@react-google-maps/api";
import { useMemo, useState, useEffect, useRef } from "react";
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

// 귀여운 만화 스타일 물고기 SVG 아이콘
// SVG를 data URL로 변환하여 사용 (useMemo로 최적화)
const getFishIcon = (isGrayscale: boolean = false) => {
  // 흑백일 경우 회색 톤 사용
  const fillColor = isGrayscale ? "#808080" : "#4285F4";
  const strokeColor = isGrayscale ? "#CCCCCC" : "#ffffff";
  const eyeColor = isGrayscale ? "#666666" : "#000000";
  
  const svg = `
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="fishShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <g filter="url(#fishShadow)">
        <!-- 꼬리 -->
        <path d="M 38 24 C 42 18 46 18 46 24 C 46 30 42 30 38 24 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>
        
        <!-- 몸체 (둥근 모양) -->
        <ellipse cx="22" cy="24" rx="16" ry="13" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        
        <!-- 등 지느러미 -->
        <path d="M 20 11 C 18 6 26 6 26 11" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>
        
        <!-- 배 지느러미 -->
        <path d="M 20 37 C 18 42 26 42 26 37" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>
        
        <!-- 가슴 지느러미 -->
        <path d="M 24 28 C 22 30 22 34 26 32" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>

        <!-- 흰색 줄무늬 (니모 특징) -->
        <path d="M 17 12 C 14 18 14 30 17 36" stroke="${strokeColor}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>
        <path d="M 29 12 C 27 18 27 30 29 36" stroke="${strokeColor}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>

        <!-- 큰 눈 -->
        <circle cx="14" cy="21" r="4.5" fill="${strokeColor}"/>
        <circle cx="14" cy="21" r="2.5" fill="${eyeColor}"/>
        <circle cx="15.5" cy="20" r="1" fill="${strokeColor}" opacity="0.8"/>
        
        <!-- 미소 -->
        <path d="M 12 27 C 14 29 16 27 16 27" stroke="${strokeColor}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </g>
    </svg>
  `.trim();
  
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

// fishIcon을 함수로 변경하여 필요할 때 생성
const createFishIcon = (isGrayscale: boolean = false) => {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return {
      url: getFishIcon(isGrayscale),
      scaledSize: new google.maps.Size(48, 48),
      anchor: new google.maps.Point(24, 24),
    };
  }
  // Google Maps API가 로드되지 않았을 때는 기본 path 사용
  return {
    path: "M 0,0 C -15,-20 -25,-15 -30,-5 C -35,5 -30,15 -20,20 C -10,25 0,25 10,20 C 20,15 25,5 20,-5 C 15,-15 5,-20 0,0 Z",
    fillColor: isGrayscale ? "#808080" : "#4285F4",
    fillOpacity: isGrayscale ? 0.5 : 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: 0.8,
    anchor: { x: 0, y: 0 },
  } as any;
};

interface MarkerData {
  position: { lat: number; lng: number };
  label?: string;
  title?: string;
  summary?: string;
  fishData?: FishData[];
  taxa?: string;
}

interface GoogleMapComponentProps {
  apiKey: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
}

// taxa를 한국어로 변환하는 함수
function translateTaxa(taxa: string): string {
  const taxaMap: Record<string, string> = {
    'Actinopterygii': '조기어류',
    'Chondrichthyes': '연골어류',
    'Sarcopterygii': '육기어류',
    'Agnatha': '무악류',
  };
  
  return taxaMap[taxa] || taxa;
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
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart margin={{ top: 30, right: 70, bottom: 20, left: 70 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius, payload }: any) => {
              const percentageValue = (percent || 0) * 100;
              if (percentageValue <= 3) return "";
              
              const percentage = percentageValue.toFixed(1);
              const RADIAN = Math.PI / 180;
              
              // 각 세그먼트의 중앙 각도에 정확히 맞춰 레이블 배치
              // midAngle은 이미 각 세그먼트의 중앙 각도를 나타냄
              const labelRadius = outerRadius + 10; // 차트 외부에 더 가깝게 배치
              const fontSize = 12;
              
              // 각도 계산 (midAngle은 도 단위이므로 라디안으로 변환)
              const angle = -midAngle * RADIAN;
              
              // 각 세그먼트의 중앙 방향으로 레이블 위치 계산
              const x = cx + labelRadius * Math.cos(angle);
              const y = cy + labelRadius * Math.sin(angle);
              
              // x 위치에 따라 텍스트 정렬 방향 결정
              const textAnchor = x > cx ? "start" : "end";
              
              // 데이터 색상 가져오기
              const dataIndex = chartData.findIndex((d) => d.name === name);
              const labelColor = dataIndex >= 0 ? COLORS[dataIndex % COLORS.length] : "#374151";
              
              return (
                <g>
                  {/* 흰색 테두리 텍스트 (배경) */}
                  <text
                    x={x}
                    y={y}
                    fill="white"
                    stroke="white"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fontSize={fontSize}
                    fontWeight={600}
                    opacity={0.9}
                  >
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="-5">{name}</tspan>
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="16">{percentage}%</tspan>
                  </text>
                  {/* 실제 색상 텍스트 (전경) */}
                  <text
                    x={x}
                    y={y}
                    fill={labelColor}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fontSize={fontSize}
                    fontWeight={600}
                  >
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="-5">{name}</tspan>
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="16">{percentage}%</tspan>
                  </text>
                </g>
              );
            }}
            outerRadius={100}
            innerRadius={50}
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
      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
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
  title,
  fishData,
  onClose,
}: {
  title?: string;
  fishData?: FishData[];
  onClose: () => void;
}) {
  // 초기 위치는 top-4 right-4 (16px)에 해당
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 초기 위치 설정 (컴포넌트 마운트 시)
  useEffect(() => {
    if (tooltipRef.current && containerRef.current && position === null) {
      const container = containerRef.current;
      const tooltip = tooltipRef.current;
      
      // top-4 right-4 위치 계산 (16px from top and right)
      // 컨테이너의 크기를 기준으로 계산
      const initialX = container.offsetWidth - tooltip.offsetWidth - 16;
      const initialY = 16;
      
      setPosition({ x: initialX, y: initialY });
    }
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 닫기 버튼이나 내부 요소 클릭 시 드래그 방지
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (!position || !containerRef.current) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    setIsDragging(true);
    // 드래그 시작 위치를 컨테이너 기준 상대 좌표로 계산
    setDragStart({
      x: e.clientX - containerRect.left - position.x,
      y: e.clientY - containerRect.top - position.y,
    });
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && tooltipRef.current && containerRef.current) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        
        // 마우스 위치를 컨테이너 기준 상대 좌표로 변환
        const newX = e.clientX - containerRect.left - dragStart.x;
        const newY = e.clientY - containerRect.top - dragStart.y;
        
        // 지도 컨테이너 내부로 제한
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const maxX = containerRect.width - tooltipRect.width;
        const maxY = containerRect.height - tooltipRect.height;
        
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));
        
        setPosition({
          x: clampedX,
          y: clampedY,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-50"
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={tooltipRef}
        className={cn(
          "relative bg-white text-gray-900",
          "rounded-xl border border-gray-200 shadow-2xl",
          "px-6 py-4 min-w-[360px] max-w-[420px]",
          "animate-in fade-in-0 zoom-in-95",
          "pointer-events-auto flex flex-col",
          "backdrop-blur-sm",
          isDragging && "cursor-move"
        )}
        style={
          position
            ? {
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
              }
            : {
                position: 'absolute',
                right: '16px',
                top: '16px',
              }
        }
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
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

      {/* 제목 - 드래그 핸들 */}
      <div 
        className="pr-8 mb-2 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-xl font-bold text-gray-900">
          {title || "어류 정보"}
        </h3>
      </div>

      {/* 파이 차트와 통계 */}
      {fishData && fishData.length > 0 && (
        <>
          <PieChartComponent fishData={fishData} />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="text-xs text-blue-600 font-medium mb-1">
                발견된 종류
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {fishData.length}
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
                {fishData.reduce((sum, fish) => sum + fish.reads_count, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

function MarkerListPanel({
  markers,
  onMarkerClick,
}: {
  markers: MarkerData[];
  onMarkerClick: (index: number) => void;
}) {
  return (
    <div className="h-full bg-white border border-gray-200 rounded-lg flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">
          마커 목록
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {markers.length}개의 마커
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {markers.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-xs">표시할 마커가 없습니다</p>
          </div>
        ) : (
          markers.map((marker, index) => {
            const speciesCount = marker.fishData?.length || 0;
            const totalReads =
              marker.fishData?.reduce(
                (sum, fish) => sum + fish.reads_count,
                0
              ) || 0;

            return (
              <button
                key={index}
                onClick={() => onMarkerClick(index)}
                className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg p-3 border border-gray-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></div>
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {marker.title || marker.label || `마커 ${index + 1}`}
                      </span>
                    </div>
                    <div className="ml-4 space-y-0.5">
                      {marker.taxa && (
                        <div className="text-[10px] text-blue-600 font-medium">
                          {translateTaxa(marker.taxa)}
                        </div>
                      )}
                      {marker.fishData && marker.fishData.length > 0 && (
                        <div className="text-[10px] text-gray-600">
                          {speciesCount}종 · {totalReads.toLocaleString()} 읽기
                        </div>
                      )}
                    </div>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-gray-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  title,
  summary,
  fishData,
}: {
  title?: string;
  summary?: string;
  fishData?: FishData[];
}) {
  const totalReads =
    fishData?.reduce((sum, fish) => sum + fish.reads_count, 0) || 0;
  const speciesCount = fishData?.length || 0;
  const topSpecies = fishData
    ? [...fishData].sort((a, b) => b.reads_count - a.reads_count)
    : [];

  return (
    <div className="h-full bg-white border border-gray-200 rounded-lg flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">
          {title || "상세 정보"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* 통계 정보 */}
        {fishData && fishData.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-[10px] text-blue-600 font-medium mb-1">
                발견된 종류
              </div>
              <div className="text-xl font-bold text-blue-900">
                {speciesCount}
                <span className="text-xs font-normal text-blue-700 ml-1">
                  종
                </span>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <div className="text-[10px] text-green-600 font-medium mb-1">
                총 읽기 수
              </div>
              <div className="text-xl font-bold text-green-900">
                {totalReads.toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {/* 주요 종류 */}
        {topSpecies.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="text-xs font-semibold text-gray-700 mb-3">
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
                        <span className="text-[10px] font-semibold text-gray-500 w-4">
                          {index + 1}.
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {fish.common_name}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-600 ml-6 mt-0.5">
                        {fish.scientific_name}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-semibold text-gray-900">
                        {fish.reads_count.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {percentage}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 요약 텍스트 */}
        {summary && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="text-xs font-semibold text-gray-700 mb-3">
              요약
            </div>
            <div className="text-xs text-gray-600 whitespace-pre-line">
              {summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 여러 마커의 fishData를 합치는 함수
function mergeFishData(fishDataArrays: FishData[][]): FishData[] {
  const merged = new Map<string, FishData>();
  
  fishDataArrays.forEach((fishData) => {
    fishData.forEach((fish) => {
      const key = `${fish.scientific_name}|${fish.common_name}`;
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.reads_count += fish.reads_count;
      } else {
        merged.set(key, {
          ...fish,
        });
      }
    });
  });
  
  return Array.from(merged.values()).sort((a, b) => b.reads_count - a.reads_count);
}

function MapContent({
  center = defaultCenter,
  zoom = 13,
  markers = [],
  selectedMarkerIndices,
  setSelectedMarkerIndices,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MarkerData[];
  selectedMarkerIndices: number[];
  setSelectedMarkerIndices: (indices: number[]) => void;
}) {
  const selectedMarkers = selectedMarkerIndices.map((index) => markers[index]).filter(Boolean);
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // 지도 bounds 업데이트 함수
  const updateBounds = useMemo(
    () => () => {
      if (mapInstance) {
        const bounds = mapInstance.getBounds();
        if (bounds) {
          setMapBounds(bounds);
        }
      }
    },
    [mapInstance]
  );

  // 지도 로드 시 map 인스턴스 저장
  const onMapLoad = (map: google.maps.Map) => {
    setMapInstance(map);
  };

  // 지도 이벤트 리스너 등록 및 정리
  useEffect(() => {
    if (!mapInstance) return;

    // 여러 이벤트에서 bounds 업데이트
    const listeners: google.maps.MapsEventListener[] = [
      mapInstance.addListener("bounds_changed", updateBounds),
      mapInstance.addListener("idle", updateBounds),
      mapInstance.addListener("zoom_changed", updateBounds),
      mapInstance.addListener("center_changed", updateBounds),
    ];

    // 초기 bounds 설정
    updateBounds();

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      listeners.forEach((listener) => {
        google.maps.event.removeListener(listener);
      });
    };
  }, [mapInstance, updateBounds]);

  // 현재 bounds 안에 있는 마커만 필터링
  const visibleMarkers = useMemo(() => {
    if (!mapBounds) return markers; // bounds가 없으면 모든 마커 표시

    // 원본 bounds 사용 (padding 제거)
    // Google Maps의 bounds는 이미 실제 viewport를 포함하므로 추가 축소 불필요
    return markers.filter((marker) => {
      const latLng = new google.maps.LatLng(marker.position.lat, marker.position.lng);
      return mapBounds.contains(latLng);
    });
  }, [markers, mapBounds]);

  // 선택된 마커는 컬러, 선택되지 않은 마커는 흑백 아이콘 사용
  // 단, 아무것도 선택하지 않은 상태에서는 모든 마커가 컬러
  const getMarkerIcon = (index: number) => {
    // 아무것도 선택하지 않은 상태면 모든 마커 컬러
    if (selectedMarkerIndices.length === 0) {
      return createFishIcon(false);
    }
    // 선택된 마커는 컬러, 선택되지 않은 마커는 흑백
    const isSelected = selectedMarkerIndices.includes(index);
    return createFishIcon(!isSelected); // 선택되지 않은 경우 흑백
  };

  // 선택된 마커들의 데이터 합치기
  const mergedFishData = useMemo(() => {
    if (selectedMarkers.length === 0) return [];
    const allFishData = selectedMarkers
      .map((marker) => marker.fishData || [])
      .filter((data) => data.length > 0);
    return mergeFishData(allFishData);
  }, [selectedMarkers]);

  // 합쳐진 데이터의 요약 생성
  const mergedSummary = useMemo(() => {
    if (mergedFishData.length === 0) return "";
    const totalReads = mergedFishData.reduce((sum, fish) => sum + fish.reads_count, 0);
    const speciesCount = mergedFishData.length;
    const topSpecies = mergedFishData.slice(0, 3);
    const taxa = selectedMarkers[0]?.taxa || "";

    let summary = '';
    if (taxa) {
      const taxaKorean = translateTaxa(taxa);
      summary += `분류: ${taxaKorean} (${taxa})\n`;
    }
    summary += `선택된 위치: ${selectedMarkers.length}개\n`;
    summary += `총 ${speciesCount}종의 어류가 발견되었습니다.\n`;
    summary += `총 읽기 수: ${totalReads.toLocaleString()}\n\n`;
    summary += `주요 종류:\n`;
    
    topSpecies.forEach((fish, index) => {
      summary += `${index + 1}. ${fish.common_name} (${fish.scientific_name})\n`;
      summary += `   읽기 수: ${fish.reads_count.toLocaleString()}\n`;
    });

    return summary;
  }, [mergedFishData, selectedMarkers]);

  return (
    <div className="flex h-[600px] gap-4">
      {/* 지도 영역 */}
      <div className="relative flex-1" style={{ height: "600px" }}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={zoom}
          onLoad={onMapLoad}
          onClick={() => {
            setSelectedMarkerIndices([]);
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
              icon={getMarkerIcon(index)}
              title={marker.title || marker.label}
              onClick={() => {
                // 토글 방식: 이미 선택된 마커면 해제, 아니면 추가
                if (selectedMarkerIndices.includes(index)) {
                  setSelectedMarkerIndices(selectedMarkerIndices.filter((i) => i !== index));
                } else {
                  setSelectedMarkerIndices([...selectedMarkerIndices, index]);
                }
              }}
            />
          ))}
        </GoogleMap>
        {selectedMarkers.length > 0 && (
          <TooltipOverlay
            title={
              selectedMarkers.length === 1
                ? selectedMarkers[0].title || selectedMarkers[0].label || "선택된 위치"
                : `${selectedMarkers.length}개 위치 선택됨`
            }
            fishData={mergedFishData}
            onClose={() => setSelectedMarkerIndices([])}
          />
        )}
      </div>

      {/* 오른쪽 상세 정보 패널 - 항상 표시 */}
      <div className="w-[17.6rem] flex-shrink-0 h-full">
        {selectedMarkers.length > 0 ? (
          <DetailPanel
            title={
              selectedMarkers.length === 1
                ? selectedMarkers[0].title || selectedMarkers[0].label || "상세 정보"
                : `${selectedMarkers.length}개 위치 합계`
            }
            summary={mergedSummary}
            fishData={mergedFishData}
          />
        ) : (
          <MarkerListPanel
            markers={visibleMarkers}
            onMarkerClick={(index) => {
              // visibleMarkers의 인덱스를 원본 markers의 인덱스로 변환
              const visibleMarker = visibleMarkers[index];
              const originalIndex = markers.findIndex(
                (m) =>
                  m.position.lat === visibleMarker.position.lat &&
                  m.position.lng === visibleMarker.position.lng
              );
              if (originalIndex !== -1) {
                // 토글 방식으로 선택/해제
                if (selectedMarkerIndices.includes(originalIndex)) {
                  setSelectedMarkerIndices(selectedMarkerIndices.filter((i) => i !== originalIndex));
                } else {
                  setSelectedMarkerIndices([...selectedMarkerIndices, originalIndex]);
                }
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function GoogleMapComponent({
  apiKey,
  center = defaultCenter,
  zoom = 13,
  markers = [],
}: GoogleMapComponentProps) {
  const libraries: any[] = useMemo(() => ["places"], []);
  const [selectedMarkerIndices, setSelectedMarkerIndices] = useState<number[]>([]);

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <MapContent
        center={center}
        zoom={zoom}
        markers={markers}
        selectedMarkerIndices={selectedMarkerIndices}
        setSelectedMarkerIndices={setSelectedMarkerIndices}
      />
    </LoadScript>
  );
}
