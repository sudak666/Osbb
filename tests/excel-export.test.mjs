import test from 'node:test';
import assert from 'node:assert/strict';
import writeExcelFile from 'write-excel-file/node';
import {unzipSync,strFromU8} from 'fflate';
import {exportSheetData} from '../src/excel-export.js';

test('Excel export preserves Ukrainian text, numeric cells and multiple sheets without formulas',async()=>{
  const data=exportSheetData([{'Товар':'=1+1','Кількість':2,'Примітка':'Кабель & лампа'}]);
  const buffer=await writeExcelFile([{sheet:'Товари',data},{sheet:'Баланс',data:[['Сума'],[42.5]]}]).toBuffer();
  const files=unzipSync(new Uint8Array(buffer));
  const workbook=strFromU8(files['xl/workbook.xml']);
  assert.match(workbook,/Товари/);assert.match(workbook,/Баланс/);
  const sheet=strFromU8(files['xl/worksheets/sheet1.xml']);assert.match(sheet,/<v>2<\/v>/);assert.doesNotMatch(sheet,/<f[ >]/);
  const strings=strFromU8(files['xl/sharedStrings.xml']);assert.match(strings,/Кабель &amp; лампа/);assert.match(strings,/=1\+1/);
});
