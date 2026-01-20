import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';

const excelPath = join(process.cwd(), 'data', 'edna_result_demo.xlsx');

console.log('엑셀 파일 읽는 중...');
const workbook = XLSX.read(readFileSync(excelPath), { type: 'buffer' });

console.log('\n시트 목록:');
console.log(workbook.SheetNames);

workbook.SheetNames.forEach((sheetName) => {
  console.log(`\n=== 시트: ${sheetName} ===`);
  const worksheet = workbook.Sheets[sheetName];
  
  // 시트의 범위 확인
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  console.log(`범위: ${worksheet['!ref']}`);
  console.log(`행 수: ${range.e.r + 1}, 열 수: ${range.e.c + 1}`);
  
  // 첫 10행 출력
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('\n첫 10행 데이터:');
  data.slice(0, 10).forEach((row, idx) => {
    console.log(`${idx + 1}:`, row);
  });
  
  // 헤더 확인
  if (data.length > 0) {
    console.log('\n헤더 (첫 번째 행):');
    console.log(data[0]);
  }
});

