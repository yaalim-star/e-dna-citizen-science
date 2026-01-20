import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { FishData } from './csv-utils';

// 엑셀 파일에서 읽은 원본 데이터 타입
export interface ExcelRow {
  Date?: number;
  sampling?: number;
  Object?: string;
  'DO(mg/L)'?: number;
  'SPC(uS/cm)'?: number;
  pH?: number;
  primer?: string;
  Primer?: string;
  common_name: string;
  'Common name'?: string;
  read?: number;
  Reads?: number;
  Taxa?: string;
  X: number;
  Y: number;
  Manager?: string;
  manager?: string;
  Marker?: string;
  scientific_name?: string;
  'Scientific name'?: string;
}

// 날짜별 데이터
export interface DateSpecificData {
  date: number;
  sampling: number;
  fishData: FishData[];
  metadata: {
    date: number;
    sampling?: number;
    object?: string;
    do?: number;
    spc?: number;
    pH?: number;
    primer?: string;
    manager?: string;
    marker?: string;
  };
}

// 엑셀 파일에서 읽은 place 그룹 데이터
export interface ExcelPlaceData {
  location: {
    lat: number;
    lon: number;
  };
  taxa: string;
  dateData: DateSpecificData[]; // 날짜별 데이터 배열
  // 전체 통합 데이터 (모든 날짜 합산)
  fishData: FishData[];
  // 환경 파라미터 평균
  avgMetadata: {
    do?: number;
    spc?: number;
    pH?: number;
  };
  metadata: {
    location: {
      lat: number;
      lon: number;
    };
    taxa: string;
    marker?: string;
    manager?: string;
    primer?: string;
    object?: string;
  };
}

/**
 * 엑셀 파일을 읽어서 데이터를 파싱합니다.
 * @param excelPath 엑셀 파일 경로
 * @param sheetName 읽을 시트 이름 (기본값: '전체 정리')
 * @returns ExcelPlaceData 배열
 */
export function parseExcelFile(
  excelPath: string, 
  sheetName: string = '전체 정리'
): ExcelPlaceData[] {
  const workbook = XLSX.read(readFileSync(excelPath), { type: 'buffer' });
  
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`시트 "${sheetName}"를 찾을 수 없습니다. 사용 가능한 시트: ${workbook.SheetNames.join(', ')}`);
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

  // 위치(X, Y)만 기준으로 그룹화 (날짜는 무시)
  const locationMap = new Map<string, Map<number, DateSpecificData>>();

  rows.forEach((row) => {
    // 필수 필드 검증 - 다양한 컬럼명 지원
    const date = row.Date || row.sampling;
    const commonName = row.common_name || row['Common name'];
    const reads = row.read || row.Reads;
    
    if (!date || !row.X || !row.Y || !commonName || reads === undefined) {
      return; // 필수 데이터가 없으면 스킵
    }

    // 위치만 기준으로 키 생성 (소수점 6자리까지 정확도)
    const locationKey = `${row.X.toFixed(6)}_${row.Y.toFixed(6)}`;

    if (!locationMap.has(locationKey)) {
      locationMap.set(locationKey, new Map());
    }

    const dateMap = locationMap.get(locationKey)!;

    if (!dateMap.has(date)) {
      // 새로운 날짜 데이터 생성
      dateMap.set(date, {
        date: date,
        sampling: date,
        fishData: [],
        metadata: {
          date: date,
          sampling: date,
          object: row.Object,
          do: row['DO(mg/L)'],
          spc: row['SPC(uS/cm)'],
          pH: row.pH,
          primer: row.primer || row.Primer,
          manager: row.Manager || row.manager,
          marker: row.Marker,
        },
      });
    }

    const dateData = dateMap.get(date)!;

    // 어류 데이터 추가
    const scientificName = row.scientific_name || row['Scientific name'] || commonName;
    const fishData: FishData = {
      scientific_name: scientificName,
      common_name: commonName,
      reads_count: reads || 0,
      taxa: row.Taxa, // 각 행의 Taxa 정보 포함
    };

    dateData.fishData.push(fishData);
  });

  // 위치별로 데이터 처리
  const processedPlaces: ExcelPlaceData[] = Array.from(locationMap.entries()).map(([locationKey, dateMap]) => {
    const dateDataArray = Array.from(dateMap.values());
    
    // 첫 번째 날짜 데이터에서 기본 정보 가져오기
    const firstDateData = dateDataArray[0];
    const firstRow = rows.find(r => {
      const date = r.Date || r.sampling;
      const x = r.X?.toFixed(6);
      const y = r.Y?.toFixed(6);
      return date === firstDateData.date && x === locationKey.split('_')[0] && y === locationKey.split('_')[1];
    });

    // 날짜별로 fishData 합치기
    const dateFishDataMap = new Map<string, FishData>();
    dateDataArray.forEach(dateData => {
      dateData.fishData.forEach((fish) => {
        const key = `${fish.scientific_name}|${fish.common_name}`;
        if (dateFishDataMap.has(key)) {
          const existing = dateFishDataMap.get(key)!;
          existing.reads_count += fish.reads_count;
        } else {
          dateFishDataMap.set(key, { ...fish });
        }
      });
    });

    // 각 날짜별 데이터도 합치기
    const processedDateData: DateSpecificData[] = dateDataArray.map(dateData => {
      const fishMap = new Map<string, FishData>();
      dateData.fishData.forEach((fish) => {
        const key = `${fish.scientific_name}|${fish.common_name}`;
        if (fishMap.has(key)) {
          const existing = fishMap.get(key)!;
          existing.reads_count += fish.reads_count;
        } else {
          fishMap.set(key, { ...fish });
        }
      });
      return {
        ...dateData,
        fishData: Array.from(fishMap.values()),
      };
    });

    // 환경 파라미터 평균 계산
    const doValues = dateDataArray.map(d => d.metadata.do).filter((v): v is number => v !== undefined && v !== null);
    const spcValues = dateDataArray.map(d => d.metadata.spc).filter((v): v is number => v !== undefined && v !== null);
    const pHValues = dateDataArray.map(d => d.metadata.pH).filter((v): v is number => v !== undefined && v !== null);
    
    const avgMetadata = {
      do: doValues.length > 0 ? doValues.reduce((sum, v) => sum + v, 0) / doValues.length : undefined,
      spc: spcValues.length > 0 ? spcValues.reduce((sum, v) => sum + v, 0) / spcValues.length : undefined,
      pH: pHValues.length > 0 ? pHValues.reduce((sum, v) => sum + v, 0) / pHValues.length : undefined,
    };

    return {
      location: {
        lat: firstRow?.Y || 0,
        lon: firstRow?.X || 0,
      },
      taxa: firstRow?.Taxa || '어류',
      dateData: processedDateData.sort((a, b) => a.date - b.date), // 날짜순 정렬
      fishData: Array.from(dateFishDataMap.values()),
      avgMetadata,
      metadata: {
        location: {
          lat: firstRow?.Y || 0,
          lon: firstRow?.X || 0,
        },
        taxa: firstRow?.Taxa || '어류',
        marker: firstRow?.Marker,
        manager: firstRow?.Manager || firstRow?.manager,
        primer: firstRow?.primer || firstRow?.Primer,
        object: firstRow?.Object,
      },
    };
  });

  return processedPlaces;
}

/**
 * 엑셀 파일의 구조를 확인하는 헬퍼 함수
 */
export function inspectExcelFile(excelPath: string, sheetName?: string): void {
  const workbook = XLSX.read(readFileSync(excelPath), { type: 'buffer' });
  
  console.log('시트 목록:', workbook.SheetNames);
  
  const targetSheet = sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`\n시트 "${targetSheet}" 정보:`);
  console.log(`- 전체 행 수: ${rows.length}`);
  if (rows.length > 0) {
    console.log(`- 컬럼: ${Object.keys(rows[0]).join(', ')}`);
    console.log(`- 샘플링 날짜 목록: ${[...new Set(rows.map(r => r.sampling))].slice(0, 10).join(', ')}`);
  }
}

