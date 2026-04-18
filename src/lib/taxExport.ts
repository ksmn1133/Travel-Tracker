import * as XLSX from 'xlsx';

type Residency = 'resident' | 'non-resident';
type IncomeType = 'salary' | 'service' | 'royalty-author' | 'royalty-ip' | 'bonus' | 'equity';

// Column indices in the 无住所个人正常工资薪金收入 sheet (0-based)
const NON_RESIDENT_SALARY_COLS = {
  employeeId: 0,       // 工号
  name: 1,             // *姓名
  certType: 2,         // *证件类型
  certNo: 3,           // *证件号码
  formula: 4,          // 适用公式
  income: 5,           // 收入
  daysInChina: 6,      // 境内工作天数
  daysOutChina: 7,     // 境外工作天数
  paidInChina: 8,      // 境内支付
  paidOutChina: 9,     // 境外支付
  exemptIncome: 10,    // 免税收入
  other: 11,           // 其他
  donations: 12,       // 准予扣除的捐赠额
  taxReduction: 13,    // 减免税额
  remarks: 14,         // 备注
};

export async function exportNonResidentSalaryTemplate(gross: number): Promise<void> {
  // Fetch the template from public folder
  const res = await fetch('/templates/非居民工资薪金申报模板.xls');
  const arrayBuffer = await res.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  // Only keep the data sheet, drop 填表说明
  const sheetName = '无住所个人正常工资薪金收入';
  wb.SheetNames = [sheetName];
  delete wb.Sheets['填表说明'];

  const ws = wb.Sheets[sheetName];

  // Append a data row (row index 1, header is row 0)
  const cols = NON_RESIDENT_SALARY_COLS;
  const dataRow: Record<string, XLSX.CellObject> = {};

  function setCell(col: number, value: string | number, type: XLSX.ExcelDataType) {
    const addr = XLSX.utils.encode_cell({ r: 1, c: col });
    dataRow[addr] = { v: value, t: type };
  }

  setCell(cols.employeeId,    '',    's'); // 工号 — blank
  setCell(cols.name,          '',    's'); // 姓名 — blank
  setCell(cols.certType,      '',    's'); // 证件类型 — blank
  setCell(cols.certNo,        '',    's'); // 证件号码 — blank
  setCell(cols.formula,       '',    's'); // 适用公式 — blank
  setCell(cols.income,        gross, 'n'); // 收入 ← calculated gross
  setCell(cols.daysInChina,   '',    's'); // 境内工作天数 — blank
  setCell(cols.daysOutChina,  '',    's'); // 境外工作天数 — blank
  setCell(cols.paidInChina,   '',    's'); // 境内支付 — blank
  setCell(cols.paidOutChina,  '',    's'); // 境外支付 — blank
  setCell(cols.exemptIncome,  0,     'n'); // 免税收入
  setCell(cols.other,         0,     'n'); // 其他
  setCell(cols.donations,     0,     'n'); // 准予扣除的捐赠额
  setCell(cols.taxReduction,  0,     'n'); // 减免税额
  setCell(cols.remarks,       '',    's'); // 备注

  Object.assign(ws, dataRow);

  // Extend the sheet range to include the new data row
  ws['!ref'] = 'A1:AC2';

  const now = new Date();
  const period = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月`;
  XLSX.writeFile(wb, `月度个人所得税工资薪金申报导入表_${period}.xls`, { bookType: 'xls' });
}

interface SalaryExtra {
  prevIncome: number;
  prevExempt: number;
  prevPension: number;
  prevMedical: number;
  prevUnemployment: number;
  prevHousingFund: number;
  currentExempt: number;
  currentPension: number;
  currentMedical: number;
  currentUnemployment: number;
  currentHousingFund: number;
  cumulativeSpecial: number;
  cumulativeOther: number;
  monthsDeclared: number;
  taxPaid: number;
}

interface EquityExtra {
  prevCumulativeIncome: number;
  prevCumulativeTax: number;
}

interface TaxResult {
  grossIncome: number;
  deduction: number;
  taxableIncome: number;
  tax: number;
  effectiveRate: number;
  netIncome: number;
  steps: { label: string; value: string }[];
}

const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary: '工资薪金所得',
  service: '劳务报酬所得',
  'royalty-author': '稿酬所得',
  'royalty-ip': '特许权使用费所得',
  bonus: '奖金',
  equity: '股权激励',
};

const now = new Date();
const period = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月`;

function fmt(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function addMerge(merges: XLSX.Range[], r1: number, c1: number, r2: number, c2: number) {
  merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

// Build rows as [label, value, label?, value?] tuples
type Row = (string | number | null)[];

function buildRows(
  residency: Residency,
  incomeType: IncomeType,
  gross: number,
  result: TaxResult,
  salaryExtra?: SalaryExtra,
  equityExtra?: EquityExtra,
): { title: string; rows: Row[] } {
  const isResident = residency === 'resident';
  const residencyLabel = isResident ? '居民个人' : '非居民个人';
  const title = `个人所得税扣缴申报表（${INCOME_TYPE_LABELS[incomeType]}）`;

  const rows: Row[] = [
    ['税款所属期', period, '纳税人身份', residencyLabel],
    ['纳税人姓名', '', '身份证号码 / 护照号码', ''],
    ['所得项目', INCOME_TYPE_LABELS[incomeType], '', ''],
    [null, null, null, null],
  ];

  if (incomeType === 'salary' && isResident && salaryExtra) {
    const s = salaryExtra;
    rows.push(
      ['一、当年之前累计项目', null, null, null],
      ['累计收入', fmt(s.prevIncome), '累计免税收入', fmt(s.prevExempt)],
      ['累计基本养老保险', fmt(s.prevPension), '累计基本医疗保险', fmt(s.prevMedical)],
      ['累计失业保险', fmt(s.prevUnemployment), '累计住房公积金', fmt(s.prevHousingFund)],
      [null, null, null, null],
      ['二、本期项目', null, null, null],
      ['本期收入', fmt(gross), '本期免税收入', fmt(s.currentExempt)],
      ['本期基本养老保险', fmt(s.currentPension), '本期基本医疗保险', fmt(s.currentMedical)],
      ['本期失业保险', fmt(s.currentUnemployment), '本期住房公积金', fmt(s.currentHousingFund)],
      [null, null, null, null],
      ['三、扣除项目', null, null, null],
      ['累计专项附加扣除', fmt(s.cumulativeSpecial), '累计其他扣除', fmt(s.cumulativeOther)],
      [`基本减除费用（5,000×${s.monthsDeclared}月）`, fmt(5000 * s.monthsDeclared), '已申报月数', s.monthsDeclared],
      [null, null, null, null],
      ['四、计税结果', null, null, null],
      ['累计应纳税所得额', fmt(result.taxableIncome), '适用年度税率', `${result.steps.find(s => s.label.includes('年度税率'))?.value ?? ''}`],
      ['当年已缴纳个税', fmt(s.taxPaid), '综合税率', `${result.effectiveRate.toFixed(2)}%`],
      ['本期应缴个人所得税', fmt(result.tax), '税后收入', fmt(result.netIncome)],
    );
  } else if (incomeType === 'equity' && equityExtra) {
    rows.push(
      ['一、累计股权激励收入', null, null, null],
      ['当年之前累计股权激励收入', fmt(equityExtra.prevCumulativeIncome), '当月股权激励收入', fmt(gross)],
      ['累计股权激励收入合计', fmt(equityExtra.prevCumulativeIncome + gross), '当年之前累计已缴税额', fmt(equityExtra.prevCumulativeTax)],
      [null, null, null, null],
      ['二、计税结果', null, null, null],
      ['适用税率', result.steps.find(s => s.label.includes('税率'))?.value ?? '', '累计应纳税额', result.steps.find(s => s.label.includes('累计应纳税额'))?.value ?? ''],
      ['本期应缴个人所得税', fmt(result.tax), '综合税率', `${result.effectiveRate.toFixed(2)}%`],
      ['税后收入', fmt(result.netIncome), '', ''],
    );
  } else if (incomeType === 'bonus') {
    rows.push(
      ['一、奖金信息', null, null, null],
      ['奖金金额', fmt(gross), '', ''],
      [null, null, null, null],
      ['二、计税结果', null, null, null],
      ...result.steps.map(s => [s.label, s.value, null, null] as Row),
      ['应缴个人所得税', fmt(result.tax), '综合税率', `${result.effectiveRate.toFixed(2)}%`],
      ['税后收入', fmt(result.netIncome), '', ''],
    );
  } else {
    // service, royalty-author, royalty-ip, non-resident salary
    rows.push(
      ['一、收入信息', null, null, null],
      ['税前收入', fmt(gross), '费用扣除', fmt(result.deduction)],
      ['应纳税所得额', fmt(result.taxableIncome), '', ''],
      [null, null, null, null],
      ['二、计税结果', null, null, null],
      ...result.steps.map(s => [s.label, s.value, null, null] as Row),
      ['应缴个人所得税', fmt(result.tax), '综合税率', `${result.effectiveRate.toFixed(2)}%`],
      ['税后收入', fmt(result.netIncome), '', ''],
    );
  }

  rows.push(
    [null, null, null, null],
    ['申报日期', new Date().toLocaleDateString('zh-CN'), '扣缴义务人（签章）', ''],
    ['纳税人（签章）', '', '备注', ''],
  );

  return { title, rows };
}

export function exportTaxDeclaration(
  residency: Residency,
  incomeType: IncomeType,
  gross: number,
  result: TaxResult,
  salaryExtra?: SalaryExtra,
  equityExtra?: EquityExtra,
) {
  const { title, rows } = buildRows(residency, incomeType, gross, result, salaryExtra, equityExtra);

  const wb = XLSX.utils.book_new();
  const wsData: (string | number | null)[][] = [];
  const merges: XLSX.Range[] = [];

  // Title row (merged across 4 columns)
  wsData.push([title, null, null, null]);
  addMerge(merges, 0, 0, 0, 3);

  // Data rows
  rows.forEach((row, i) => {
    const rowIdx = i + 1;
    if (row[0] === null && row[1] === null) {
      // Empty separator
      wsData.push(['', '', '', '']);
    } else if (row[2] === null && row[3] === null && row[0] !== null) {
      // Section header — merge across all 4 cols
      wsData.push([row[0], null, null, null]);
      addMerge(merges, rowIdx, 0, rowIdx, 3);
    } else {
      wsData.push([row[0], row[1], row[2], row[3]]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 28 }, { wch: 22 }];

  XLSX.utils.book_append_sheet(wb, ws, '申报表');
  XLSX.writeFile(wb, `个人所得税申报表_${INCOME_TYPE_LABELS[incomeType]}_${period}.xlsx`);
}
