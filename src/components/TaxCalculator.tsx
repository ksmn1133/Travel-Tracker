import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calculator, TrendingDown, Wallet, Receipt, Download } from 'lucide-react';
import { exportTaxDeclaration, exportNonResidentSalaryTemplate, ProfileSnapshot } from '../lib/taxExport';
import { Button } from './ui/button';
import { auth } from '../firebase';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

type Residency = 'resident' | 'non-resident';
type IncomeType = 'salary' | 'service' | 'royalty-author' | 'royalty-ip' | 'bonus' | 'equity';

interface TaxResult {
  grossIncome: number;
  deduction: number;
  taxableIncome: number;
  tax: number;
  effectiveRate: number;
  netIncome: number;
  steps: { label: string; value: string }[];
}

// Annual brackets — resident salary (cumulative method) and resident equity
const ANNUAL_BRACKETS = [
  { limit: 36000,    rate: 0.03, qd: 0 },
  { limit: 144000,   rate: 0.10, qd: 2520 },
  { limit: 300000,   rate: 0.20, qd: 16920 },
  { limit: 420000,   rate: 0.25, qd: 31920 },
  { limit: 660000,   rate: 0.30, qd: 52920 },
  { limit: 960000,   rate: 0.35, qd: 85920 },
  { limit: Infinity, rate: 0.45, qd: 181920 },
];

// Monthly brackets — non-resident wages, bonus, equity
const MONTHLY_BRACKETS = [
  { limit: 3000,    rate: 0.03, qd: 0 },
  { limit: 12000,   rate: 0.10, qd: 210 },
  { limit: 25000,   rate: 0.20, qd: 1410 },
  { limit: 38500,   rate: 0.25, qd: 2660 },
  { limit: 58000,   rate: 0.30, qd: 4410 },
  { limit: 83500,   rate: 0.35, qd: 7160 },
  { limit: Infinity, rate: 0.45, qd: 15160 },
];

function getBracketLabel(taxableIncome: number, brackets: typeof ANNUAL_BRACKETS): string {
  if (taxableIncome <= 0) return '0%';
  const bracket = brackets.find(b => taxableIncome <= b.limit)!;
  return `${(bracket.rate * 100).toFixed(0)}%（速算扣除数 ${bracket.qd.toLocaleString()}）`;
}

function applyBrackets(taxableIncome: number, brackets: typeof MONTHLY_BRACKETS): number {
  if (taxableIncome <= 0) return 0;
  const bracket = brackets.find(b => taxableIncome <= b.limit)!;
  return Math.max(0, taxableIncome * bracket.rate - bracket.qd);
}

function serviceWithholding(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  if (taxableIncome <= 20000) return taxableIncome * 0.20;
  if (taxableIncome <= 50000) return taxableIncome * 0.30 - 2000;
  return taxableIncome * 0.40 - 7000;
}

function serviceWithholdingLabel(taxableIncome: number): string {
  if (taxableIncome <= 20000) return '20%';
  if (taxableIncome <= 50000) return '30%（速算扣除数 2,000）';
  return '40%（速算扣除数 7,000）';
}

function singlePaymentDeduction(gross: number): number {
  return gross <= 4000 ? 800 : gross * 0.2;
}

interface SalaryExtra {
  // Prior cumulative this year
  prevIncome: number;
  prevExempt: number;
  prevPension: number;
  prevMedical: number;
  prevUnemployment: number;
  prevHousingFund: number;
  // Current period
  currentExempt: number;
  currentPension: number;
  currentMedical: number;
  currentUnemployment: number;
  currentHousingFund: number;
  // Other deductions
  cumulativeSpecial: number;
  cumulativeOther: number;
  monthsDeclared: number;
  taxPaid: number;
}

interface EquityExtra {
  prevCumulativeIncome: number;
  prevCumulativeTax: number;
}

const fmt2 = (n: number) =>
  n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function calculate(
  residency: Residency,
  incomeType: IncomeType,
  gross: number,
  salaryExtra?: SalaryExtra,
  equityExtra?: EquityExtra,
): TaxResult | null {
  if (!gross || gross <= 0) return null;

  let deduction = 0;
  let taxableIncome = 0;
  let tax = 0;
  const steps: { label: string; value: string }[] = [];

  if (incomeType === 'salary') {
    if (residency === 'resident') {
      // Cumulative withholding method (累计预扣法)
      const s = salaryExtra!;
      const prevNet = s.prevIncome - s.prevExempt - s.prevPension - s.prevMedical - s.prevUnemployment - s.prevHousingFund;
      const currentNet = gross - s.currentExempt - s.currentPension - s.currentMedical - s.currentUnemployment - s.currentHousingFund;
      const standardDeduction = 5000 * s.monthsDeclared;
      taxableIncome = Math.max(0, prevNet + currentNet - s.cumulativeSpecial - s.cumulativeOther - standardDeduction);
      const bracket = ANNUAL_BRACKETS.find(b => taxableIncome <= b.limit)!;
      const grossTax = taxableIncome * bracket.rate - bracket.qd;
      tax = Math.max(0, grossTax - s.taxPaid);

      steps.push(
        { label: '当年之前累计收入', value: `¥${fmt2(s.prevIncome)}` },
        { label: '　- 累计免税收入', value: `¥${fmt2(s.prevExempt)}` },
        { label: '　- 累计基本养老保险', value: `¥${fmt2(s.prevPension)}` },
        { label: '　- 累计基本医疗保险', value: `¥${fmt2(s.prevMedical)}` },
        { label: '　- 累计失业保险', value: `¥${fmt2(s.prevUnemployment)}` },
        { label: '　- 累计住房公积金', value: `¥${fmt2(s.prevHousingFund)}` },
        { label: '本期收入', value: `¥${fmt2(gross)}` },
        { label: '　- 本期免税收入', value: `¥${fmt2(s.currentExempt)}` },
        { label: '　- 本期基本养老保险', value: `¥${fmt2(s.currentPension)}` },
        { label: '　- 本期基本医疗保险', value: `¥${fmt2(s.currentMedical)}` },
        { label: '　- 本期失业保险', value: `¥${fmt2(s.currentUnemployment)}` },
        { label: '　- 本期住房公积金', value: `¥${fmt2(s.currentHousingFund)}` },
        { label: '　- 累计专项附加扣除', value: `¥${fmt2(s.cumulativeSpecial)}` },
        { label: '　- 累计其他扣除', value: `¥${fmt2(s.cumulativeOther)}` },
        { label: `　- 基本减除费用（5,000×${s.monthsDeclared}月）`, value: `¥${fmt2(standardDeduction)}` },
        { label: '累计应纳税所得额', value: `¥${fmt2(taxableIncome)}` },
        { label: '适用年度税率', value: taxableIncome > 0 ? getBracketLabel(taxableIncome, ANNUAL_BRACKETS) : '0%' },
        { label: '累计应纳税额', value: `¥${fmt2(Math.max(0, grossTax))}` },
        { label: '当年已缴纳个税', value: `¥${fmt2(s.taxPaid)}` },
      );
    } else {
      // Non-resident: monthly, 5,000 deduction, monthly brackets
      deduction = 5000;
      taxableIncome = Math.max(0, gross - deduction);
      tax = applyBrackets(taxableIncome, MONTHLY_BRACKETS);
      steps.push(
        { label: '月度标准扣除额', value: `¥${deduction.toLocaleString()}` },
        { label: '应纳税所得额', value: `¥${taxableIncome.toLocaleString()}` },
        { label: '适用税率', value: taxableIncome > 0 ? getBracketLabel(taxableIncome, MONTHLY_BRACKETS) : '0%' },
      );
    }

  } else if (incomeType === 'service') {
    deduction = singlePaymentDeduction(gross);
    taxableIncome = gross - deduction;
    tax = serviceWithholding(taxableIncome);
    steps.push(
      { label: '费用扣除', value: gross <= 4000 ? '¥800（定额）' : `¥${deduction.toLocaleString()}（收入×20%）` },
      { label: '应纳税所得额', value: `¥${taxableIncome.toLocaleString()}` },
      { label: '适用预扣税率', value: serviceWithholdingLabel(taxableIncome) },
    );

  } else if (incomeType === 'royalty-author') {
    deduction = singlePaymentDeduction(gross);
    const afterDeduction = gross - deduction;
    taxableIncome = afterDeduction * 0.7;
    tax = taxableIncome * 0.20;
    steps.push(
      { label: '费用扣除', value: gross <= 4000 ? '¥800（定额）' : `¥${deduction.toLocaleString()}（收入×20%）` },
      { label: '扣除后所得', value: `¥${afterDeduction.toLocaleString()}` },
      { label: '应纳税所得额（×70%）', value: `¥${taxableIncome.toLocaleString()}` },
      { label: '适用税率', value: '20%' },
    );

  } else if (incomeType === 'royalty-ip') {
    deduction = singlePaymentDeduction(gross);
    taxableIncome = gross - deduction;
    tax = taxableIncome * 0.20;
    steps.push(
      { label: '费用扣除', value: gross <= 4000 ? '¥800（定额）' : `¥${deduction.toLocaleString()}（收入×20%）` },
      { label: '应纳税所得额', value: `¥${taxableIncome.toLocaleString()}` },
      { label: '适用税率', value: '20%' },
    );

  } else if (incomeType === 'bonus') {
    if (residency === 'resident') {
      const monthly = gross / 12;
      const bracket = MONTHLY_BRACKETS.find(b => monthly <= b.limit)!;
      tax = Math.max(0, gross * bracket.rate - bracket.qd);
      taxableIncome = gross;
      steps.push(
        { label: '月均化金额（÷12）', value: `¥${monthly.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
        { label: '适用税率', value: `${(bracket.rate * 100).toFixed(0)}%（速算扣除数 ${bracket.qd.toLocaleString()}）` },
        { label: '计税基数（全额）', value: `¥${gross.toLocaleString()}` },
      );
    } else {
      const sixth = gross / 6;
      const bracket = MONTHLY_BRACKETS.find(b => sixth <= b.limit)!;
      tax = Math.max(0, (sixth * bracket.rate - bracket.qd) * 6);
      taxableIncome = gross;
      steps.push(
        { label: '奖金÷6', value: `¥${sixth.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
        { label: '适用月度税率', value: `${(bracket.rate * 100).toFixed(0)}%（速算扣除数 ${bracket.qd.toLocaleString()}）` },
        { label: '计算公式', value: `(÷6 × ${(bracket.rate * 100).toFixed(0)}% - ${bracket.qd.toLocaleString()}) × 6` },
      );
    }

  } else if (incomeType === 'equity') {
    if (residency === 'resident') {
      const prevIncome = equityExtra?.prevCumulativeIncome ?? 0;
      const prevTax = equityExtra?.prevCumulativeTax ?? 0;
      const cumulative = prevIncome + gross;
      const bracket = ANNUAL_BRACKETS.find(b => cumulative <= b.limit)!;
      const grossTax = cumulative * bracket.rate - bracket.qd;
      tax = Math.max(0, grossTax - prevTax);
      taxableIncome = cumulative;
      steps.push(
        { label: '当年之前累计股权激励收入', value: `¥${prevIncome.toLocaleString()}` },
        { label: '本月股权激励收入', value: `¥${gross.toLocaleString()}` },
        { label: '累计股权激励收入合计', value: `¥${cumulative.toLocaleString()}` },
        { label: '适用年度税率', value: `${(bracket.rate * 100).toFixed(0)}%（速算扣除数 ${bracket.qd.toLocaleString()}）` },
        { label: '累计应纳税额', value: `¥${Math.max(0, grossTax).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
        { label: '当年之前累计已缴税额', value: `¥${prevTax.toLocaleString()}` },
      );
    } else {
      const prevIncome = equityExtra?.prevCumulativeIncome ?? 0;
      const prevTax = equityExtra?.prevCumulativeTax ?? 0;
      const cumulative = prevIncome + gross;
      const sixth = cumulative / 6;
      const bracket = MONTHLY_BRACKETS.find(b => sixth <= b.limit)!;
      const grossTax = (sixth * bracket.rate - bracket.qd) * 6;
      tax = Math.max(0, grossTax - prevTax);
      taxableIncome = cumulative;
      steps.push(
        { label: '当年之前累计股权激励收入', value: `¥${prevIncome.toLocaleString()}` },
        { label: '当月股权激励收入', value: `¥${gross.toLocaleString()}` },
        { label: '累计股权激励收入合计', value: `¥${cumulative.toLocaleString()}` },
        { label: '累计÷6', value: `¥${sixth.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
        { label: '适用月度税率', value: `${(bracket.rate * 100).toFixed(0)}%（速算扣除数 ${bracket.qd.toLocaleString()}）` },
        { label: '累计应纳税额（×6）', value: `¥${Math.max(0, grossTax).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
        { label: '当年之前累计已缴税额', value: `¥${prevTax.toLocaleString()}` },
      );
    }
  }

  tax = Math.max(0, tax);
  const netIncome = gross - tax;
  const effectiveRate = gross > 0 ? (tax / gross) * 100 : 0;
  return { grossIncome: gross, deduction, taxableIncome, tax, effectiveRate, netIncome, steps };
}

const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary: '工资薪金',
  service: '劳务报酬',
  'royalty-author': '稿酬',
  'royalty-ip': '特许权使用费',
  bonus: '奖金',
  equity: '股权激励',
};

function NumInput({ label, hint, value, onChange }: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-7 bg-white h-9 text-right text-sm"
        />
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function p(s: string) { return parseFloat(s.replace(/,/g, '')) || 0; }

export function TaxCalculator() {
  const [residency, setResidency] = useState<Residency>('resident');
  const [incomeType, setIncomeType] = useState<IncomeType>('salary');
  const [amountStr, setAmountStr] = useState('');

  // Equity extra
  const [prevEqIncomeStr, setPrevEqIncomeStr] = useState('');
  const [prevEqTaxStr, setPrevEqTaxStr] = useState('');

  // Resident salary extra — prior cumulative
  const [prevIncomeStr, setPrevIncomeStr] = useState('');
  const [prevExemptStr, setPrevExemptStr] = useState('');
  const [prevPensionStr, setPrevPensionStr] = useState('');
  const [prevMedicalStr, setPrevMedicalStr] = useState('');
  const [prevUnemployStr, setPrevUnemployStr] = useState('');
  const [prevHousingStr, setPrevHousingStr] = useState('');
  // Resident salary extra — current period
  const [curExemptStr, setCurExemptStr] = useState('');
  const [curPensionStr, setCurPensionStr] = useState('');
  const [curMedicalStr, setCurMedicalStr] = useState('');
  const [curUnemployStr, setCurUnemployStr] = useState('');
  const [curHousingStr, setCurHousingStr] = useState('');
  // Resident salary extra — other
  const [cumSpecialStr, setCumSpecialStr] = useState('');
  const [cumOtherStr, setCumOtherStr] = useState('');
  const [monthsDeclaredStr, setMonthsDeclaredStr] = useState('1');
  const [taxPaidStr, setTaxPaidStr] = useState('');

  // Load profile for pre-filling the export
  const [exportProfile, setExportProfile] = useState<ProfileSnapshot | undefined>();
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then((snap) => {
      if (snap.exists()) {
        const p = snap.data()?.profile;
        if (p) setExportProfile({ firstName: p.firstName ?? '', lastName: p.lastName ?? '', documentType: p.documentType ?? '', documentNumber: p.documentNumber ?? '' });
      }
    });
  }, []);

  const isResidentSalary = residency === 'resident' && incomeType === 'salary';
  const isEquity = incomeType === 'equity';
  const gross = p(amountStr);

  const salaryExtra: SalaryExtra = {
    prevIncome: p(prevIncomeStr),
    prevExempt: p(prevExemptStr),
    prevPension: p(prevPensionStr),
    prevMedical: p(prevMedicalStr),
    prevUnemployment: p(prevUnemployStr),
    prevHousingFund: p(prevHousingStr),
    currentExempt: p(curExemptStr),
    currentPension: p(curPensionStr),
    currentMedical: p(curMedicalStr),
    currentUnemployment: p(curUnemployStr),
    currentHousingFund: p(curHousingStr),
    cumulativeSpecial: p(cumSpecialStr),
    cumulativeOther: p(cumOtherStr),
    monthsDeclared: parseInt(monthsDeclaredStr) || 1,
    taxPaid: p(taxPaidStr),
  };

  const equityExtra: EquityExtra = {
    prevCumulativeIncome: p(prevEqIncomeStr),
    prevCumulativeTax: p(prevEqTaxStr),
  };

  const result = useMemo(
    () => calculate(
      residency, incomeType, gross,
      isResidentSalary ? salaryExtra : undefined,
      isEquity ? equityExtra : undefined,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [residency, incomeType, gross,
      salaryExtra.prevIncome, salaryExtra.prevExempt, salaryExtra.prevPension,
      salaryExtra.prevMedical, salaryExtra.prevUnemployment, salaryExtra.prevHousingFund,
      salaryExtra.currentExempt, salaryExtra.currentPension, salaryExtra.currentMedical,
      salaryExtra.currentUnemployment, salaryExtra.currentHousingFund,
      salaryExtra.cumulativeSpecial, salaryExtra.cumulativeOther,
      salaryExtra.monthsDeclared, salaryExtra.taxPaid,
      equityExtra.prevCumulativeIncome, equityExtra.prevCumulativeTax,
    ],
  );

  const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">个人所得税计算器</h2>
          <p className="text-slate-500 text-sm mt-1">China Individual Income Tax Calculator</p>
        </div>
        <div className="bg-blue-50 p-2 rounded-lg">
          <Calculator className="w-5 h-5 text-blue-600" />
        </div>
      </div>

      {/* Filters + Input */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">计税信息</CardTitle>
          <CardDescription>选择纳税人身份与所得类型，输入收入金额</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Residency + Income type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">纳税人身份</Label>
              <Select value={residency} onValueChange={(v) => setResidency(v as Residency)}>
                <SelectTrigger className="w-full bg-white h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resident">居民个人（Resident）</SelectItem>
                  <SelectItem value="non-resident">非居民个人（Non-Resident）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">所得类型</Label>
              <Select value={incomeType} onValueChange={(v) => setIncomeType(v as IncomeType)}>
                <SelectTrigger className="w-full bg-white h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">工资薪金</SelectItem>
                  <SelectItem value="service">劳务报酬</SelectItem>
                  <SelectItem value="royalty-author">稿酬</SelectItem>
                  <SelectItem value="royalty-ip">特许权使用费</SelectItem>
                  <SelectItem value="bonus">奖金</SelectItem>
                  <SelectItem value="equity">股权激励</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Main income amount */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {isResidentSalary ? '本期收入（元）' : isEquity ? '当月股权激励收入（元）' : '收入金额（元）'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">¥</span>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="pl-7 bg-white h-10 text-right"
              />
            </div>
          </div>

          {/* Resident salary: cumulative fields */}
          {isResidentSalary && (
            <>
              {/* Prior cumulative */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">当年之前累计项目</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NumInput label="累计收入" value={prevIncomeStr} onChange={setPrevIncomeStr} />
                  <NumInput label="累计免税收入" value={prevExemptStr} onChange={setPrevExemptStr} />
                  <NumInput label="累计基本养老保险" value={prevPensionStr} onChange={setPrevPensionStr} />
                  <NumInput label="累计基本医疗保险" value={prevMedicalStr} onChange={setPrevMedicalStr} />
                  <NumInput label="累计失业保险" value={prevUnemployStr} onChange={setPrevUnemployStr} />
                  <NumInput label="累计住房公积金" value={prevHousingStr} onChange={setPrevHousingStr} />
                </div>
              </div>

              {/* Current period */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">本期扣除项目</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NumInput label="本期免税收入" value={curExemptStr} onChange={setCurExemptStr} />
                  <NumInput label="本期基本养老保险" value={curPensionStr} onChange={setCurPensionStr} />
                  <NumInput label="本期基本医疗保险" value={curMedicalStr} onChange={setCurMedicalStr} />
                  <NumInput label="本期失业保险" value={curUnemployStr} onChange={setCurUnemployStr} />
                  <NumInput label="本期住房公积金" value={curHousingStr} onChange={setCurHousingStr} />
                </div>
              </div>

              {/* Other deductions */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">其他扣除</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <NumInput label="累计专项附加扣除" value={cumSpecialStr} onChange={setCumSpecialStr} />
                  <NumInput label="累计其他扣除" value={cumOtherStr} onChange={setCumOtherStr} />
                  <NumInput label="当年已缴纳个税" value={taxPaidStr} onChange={setTaxPaidStr} />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">已申报月数</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      placeholder="1"
                      value={monthsDeclaredStr}
                      onChange={(e) => setMonthsDeclaredStr(e.target.value)}
                      className="bg-white h-9 text-right text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Equity extra fields */}
          {isEquity && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <NumInput
                label="当年之前累计股权激励收入（元）"
                hint="本次发放前，本年度已取得的股权激励收入合计"
                value={prevEqIncomeStr}
                onChange={setPrevEqIncomeStr}
              />
              <NumInput
                label="当年之前累计已缴税额（元）"
                hint="本次发放前，本年度股权激励已缴纳的个税合计"
                value={prevEqTaxStr}
                onChange={setPrevEqTaxStr}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">本期收入</span>
                </div>
                <p className="text-lg font-bold text-slate-800">¥{fmt(result.grossIncome)}</p>
              </CardContent>
            </Card>
            <Card className="border-red-50 shadow-sm bg-red-50/60">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-slate-500">应缴税额</span>
                </div>
                <p className="text-lg font-bold text-red-600">¥{fmt(result.tax)}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">综合税率</span>
                </div>
                <p className="text-lg font-bold text-slate-800">{result.effectiveRate.toFixed(2)}%</p>
              </CardContent>
            </Card>
            <Card className="border-green-50 shadow-sm bg-green-50/60">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-slate-500">税后收入</span>
                </div>
                <p className="text-lg font-bold text-green-600">¥{fmt(result.netIncome)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">计税过程</CardTitle>
              <CardDescription>
                {residency === 'resident' ? '居民个人' : '非居民个人'} · {INCOME_TYPE_LABELS[incomeType]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {result.steps.map((step, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-600">{step.label}</span>
                    <span className="text-sm font-medium text-slate-800">{step.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 mt-1">
                  <span className="text-sm font-semibold text-slate-700">本期应缴个人所得税</span>
                  <span className="text-sm font-bold text-red-600">¥{fmt(result.tax)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (residency === 'non-resident' && incomeType === 'salary') {
                  exportNonResidentSalaryTemplate(gross, exportProfile);
                } else {
                  exportTaxDeclaration(
                    residency, incomeType, gross, result,
                    isResidentSalary ? salaryExtra : undefined,
                    isEquity ? equityExtra : undefined,
                  );
                }
              }}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <Download className="w-4 h-4" />
              导出申报表
            </Button>
          </div>
        </>
      )}

      {!result && (
        <div className="text-center py-16 text-slate-400">
          <Calculator className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">输入收入金额以计算应缴税额</p>
        </div>
      )}
    </div>
  );
}
