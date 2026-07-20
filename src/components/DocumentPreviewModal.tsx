import React from 'react';
import { Agreement, Customer } from '../types';
import { Download, Printer, X, FileText, Table, Check, Award, ShieldAlert, Sparkles } from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'aod' | 'invoice' | 'csv' | 'salary_consent' | 'affordability_dec';
  agreement?: Agreement | null;
  customer?: Customer | null;
  csvData?: {
    headers: string[];
    rows: string[][];
  } | null;
  onDownload: () => void;
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  title,
  type,
  agreement,
  customer,
  csvData,
  onDownload
}: DocumentPreviewModalProps) {
  if (!isOpen) return null;

  const formatCurrency = (amount: number): string => {
    return 'R ' + (amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatDateFriendly = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderSignature = () => {
    if (agreement?.electronicSignature) {
      if (agreement.electronicSignatureType === 'drawn') {
        return (
          <div className="flex flex-col items-center justify-center">
            <img src={agreement.electronicSignature} className="max-h-12 max-w-[150px] object-contain border-b border-slate-300 pb-1" alt="Electronic Signature" />
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono mt-0.5">Digitally Signed</span>
            <span className="text-[7px] text-slate-400 font-mono">Date: {formatDateFriendly(agreement.electronicSignatureDate || agreement.date)}</span>
          </div>
        );
      } else {
        return (
          <div className="flex flex-col items-center justify-center">
            <span className="font-serif italic text-base text-amber-600 block border-b border-slate-300 pb-1 px-2 font-bold select-none">{agreement.electronicSignature}</span>
            <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono mt-0.5">Digitally Attested</span>
            <span className="text-[7px] text-slate-400 font-mono">Date: {formatDateFriendly(agreement.electronicSignatureDate || agreement.date)}</span>
          </div>
        );
      }
    }
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="border-b border-slate-300 w-4/5 h-8"></div>
        <span className="text-[8px] text-red-500 font-bold uppercase tracking-wider mt-1">Pending Sign</span>
      </div>
    );
  };

  const renderContent = () => {
    if (type === 'csv' && csvData) {
      return (
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Table size={12} className="text-amber-500" /> Spreadsheet Data Preview ({csvData.rows.length} records)
            </span>
            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-bold uppercase">
              Before Exporting
            </span>
          </div>
          <div className="overflow-x-auto max-h-[350px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-sm shadow z-10">
                <tr className="border-b border-slate-800">
                  {csvData.headers.map((h, i) => (
                    <th key={i} className="p-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 font-mono text-[11px] text-slate-300">
                {csvData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={csvData.headers.length} className="p-8 text-center text-slate-500 italic font-sans">
                      No records match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  csvData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-slate-900/50">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="p-2.5 max-w-[200px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (!agreement || !customer) {
      return <div className="text-center p-6 text-slate-500">No preview data available.</div>;
    }

    const customerName = `${customer.firstNames || ''} ${customer.surname || ''}`.trim() || customer.name;
    const totalRepay = agreement.totalAmount;
    const repaymentDate = formatDateFriendly(agreement.dueDate);
    const contact = customer.phone || '—';
    const idNum = customer.idNumber || '—';
    const fileNo = customer.fileNo || '—';
    const address = customer.address || '—';
    const agreementNumber = agreement.agrNumber;
    const agreementDate = formatDateFriendly(agreement.date);

    if (type === 'aod') {
      return (
        <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-inner max-w-lg mx-auto font-sans leading-relaxed text-xs border border-slate-200">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-4">
            <h4 className="text-base font-black uppercase tracking-wider text-slate-950">Acknowledgement of Debt</h4>
            <div className="text-[10px] text-slate-600 font-bold uppercase mt-1">Lerato Community Financial Services</div>
          </div>

          <div className="space-y-4">
            <p>
              I, the undersigned, <strong>{customerName}</strong>, with South African Identity Number <strong>{idNum}</strong>,
              hereby unconditionally acknowledge that I am truly and lawfully indebted to <strong>Lerato (Pty) Ltd</strong> in the total sum of
              {' '}<strong className="text-sm font-bold text-slate-950">{formatCurrency(totalRepay)}</strong>.
            </p>

            <p>
              This debt arises from credit facilities granted for the purchase of essential household goods and/or cash advance
              as listed under Invoice Number <strong>{agreementNumber}</strong> dated <strong>{agreementDate}</strong>.
            </p>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Repayment Details</div>
              <div className="grid grid-cols-2 gap-y-1 text-slate-700">
                <span>Principal Capital (Goods):</span>
                <span className="text-right font-semibold">{formatCurrency(agreement.goods)}</span>
                <span>Loan Capital (Advance):</span>
                <span className="text-right font-semibold">{formatCurrency(agreement.loan)}</span>
                <span>Initiation Fee (10%):</span>
                <span className="text-right font-semibold">{formatCurrency(agreement.initiationFee || 0)}</span>
                <span>Monthly Service Fee:</span>
                <span className="text-right font-semibold">{formatCurrency(agreement.serviceFee || 0)}</span>
                <span className="font-bold border-t border-slate-200 pt-1.5 mt-1.5 text-slate-900">Total Owed Debt:</span>
                <span className="font-black border-t border-slate-200 pt-1.5 mt-1.5 text-right text-slate-950">{formatCurrency(totalRepay)}</span>
              </div>
            </div>

            <p>
              I hereby agree to repay the outstanding sum in full on or before <strong>{repaymentDate}</strong>. I acknowledge
              that failure to do so will result in default proceedings as regulated under the National Credit Act.
            </p>

            <div className="pt-6 border-t border-slate-200 mt-6 grid grid-cols-2 gap-4 text-[10px] text-slate-600">
              <div className="space-y-4">
                <div className="text-center">
                  {renderSignature()}
                  <div className="mt-1 font-semibold text-slate-800">Debtor Signature ({customerName})</div>
                </div>
                <div>
                  <div className="border-b border-slate-300 text-center font-medium pb-0.5">{agreementDate}</div>
                  <div className="mt-1 text-center">Date</div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="font-serif italic text-base text-slate-700 block border-b border-slate-300 pb-1 font-bold">Lerato Financials</span>
                    <span className="text-[8px] text-slate-400 font-mono mt-0.5">Authorised Signatory</span>
                  </div>
                  <div className="mt-1 font-semibold text-slate-800">For Lerato Representative</div>
                </div>
                <div>
                  <div className="border-b border-slate-300 text-center font-medium pb-0.5">{agreementDate}</div>
                  <div className="mt-1 text-center">Date</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'invoice') {
      const items = agreement.items || [];
      return (
        <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-inner max-w-lg mx-auto font-sans leading-relaxed text-xs border border-slate-200">
          <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
            <div>
              <h4 className="text-base font-black uppercase text-slate-950">Tax Invoice</h4>
              <span className="text-[10px] text-slate-500 font-mono">{agreementNumber}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-800">Lerato Community Financial Services</div>
              <div className="text-[10px] text-slate-500">VAT Reg: 4830192842</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-[11px]">
            <div>
              <span className="text-slate-400 block uppercase text-[9px] font-bold">Billed To:</span>
              <strong className="text-slate-900">{customerName}</strong>
              <div className="text-slate-600 mt-0.5">
                ID: {idNum} <br />
                File: {fileNo} <br />
                Cell: {contact}
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block uppercase text-[9px] font-bold">Details:</span>
              <div className="text-slate-600 mt-0.5">
                Date: {agreementDate} <br />
                Due Date: {repaymentDate} <br />
                Type: Credit Facility
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <span className="text-slate-400 block uppercase text-[9px] font-bold">Deductions Breakdown:</span>
            <div className="border border-slate-150 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold">
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {items.length > 0 ? (
                    items.map((item, index) => (
                      <tr key={index}>
                        <td className="p-2 font-medium">
                          {item.name} <span className="text-slate-400 text-[10px] font-normal">x{item.qty}</span>
                        </td>
                        <td className="p-2 text-right font-mono">{formatCurrency(item.price * item.qty)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-2 font-medium">
                        Groceries Credit Allocation
                      </td>
                      <td className="p-2 text-right font-mono">{formatCurrency(agreement.goods)}</td>
                    </tr>
                  )}
                  {agreement.loan > 0 && (
                    <tr>
                      <td className="p-2 font-medium text-slate-900">Cash Loan Advance Capital</td>
                      <td className="p-2 text-right font-mono text-slate-900">{formatCurrency(agreement.loan)}</td>
                    </tr>
                  )}
                  {agreement.initiationFee > 0 && (
                    <tr>
                      <td className="p-2 text-slate-500">Initiation Fee (10% NCA Allowed)</td>
                      <td className="p-2 text-right font-mono text-slate-500">{formatCurrency(agreement.initiationFee)}</td>
                    </tr>
                  )}
                  {agreement.serviceFee > 0 && (
                    <tr>
                      <td className="p-2 text-slate-500">Monthly Credit Service Fee</td>
                      <td className="p-2 text-right font-mono text-slate-500">{formatCurrency(agreement.serviceFee)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 flex justify-end">
            <div className="w-48 text-right space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(agreement.goods + agreement.loan)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>All Fees:</span>
                <span className="font-mono">{formatCurrency((agreement.initiationFee || 0) + (agreement.serviceFee || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-950 font-black text-sm border-t border-slate-150 pt-1.5">
                <span>Total Amount:</span>
                <span className="text-emerald-700 font-mono">{formatCurrency(totalRepay)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'salary_consent') {
      const employerName = customer.employer || 'Designated Employer';
      return (
        <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-inner max-w-lg mx-auto font-sans leading-relaxed text-[11px] border border-slate-200">
          <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
            <h4 className="text-sm font-black uppercase text-slate-950">Phoenix Financial Services</h4>
            <p className="text-[9px] text-slate-600 font-bold uppercase">Authorized Credit Provider | Reg No: 2025/685262/07</p>
            <p className="text-[8px] text-slate-500">50A Von Weilligh Street, Rustenburg, 0300 | Tel: 086 100 2472 | Email: CBRDUPLESSIS.X2@GMAIL.COM</p>
          </div>

          <div className="text-right text-slate-600 mb-3 text-[10px]">
            Date: <strong className="text-slate-900">{agreementDate}</strong>
          </div>

          <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded border border-slate-100 text-[10px]">
            <div><strong>To:</strong> Employment Payroll Department / SASSA Welfare Disbursements</div>
            <div><strong>File Reference:</strong> #{fileNo}</div>
            <div><strong>Customer:</strong> {customerName} (ID: {idNum})</div>
            <div><strong>Address:</strong> {address}</div>
          </div>

          <div className="font-bold text-center border-b border-slate-900 pb-1.5 mb-3 text-[11px] uppercase text-slate-950">
            Subject: Consent &amp; Authorization for Salary Deduction and Legal Action in Case of Default
          </div>

          <div className="space-y-3 text-justify text-slate-700 text-[10px]">
            <p>Dear {customerName},</p>
            <p>
              You hereby give your full and irrevocable consent for the deduction of loan repayments directly from your salary and authorize <strong>Phoenix Financial Services</strong> to take necessary legal action under the South African National Credit Act (NCA) 34 of 2005 in the event of default on <strong>{agreementDate}</strong>.
            </p>
            <p>
              <strong>1. Authority to Deduct Salary:</strong> You authorize Phoenix Financial Services to instruct your employer, <strong>{employerName}</strong>, to deduct the agreed loan repayment amount from your monthly salary and transfer it directly to <strong>Phoenix Financial Services Trust Account</strong> until the full outstanding amount of <strong>{formatCurrency(totalRepay)}</strong> is settled.
            </p>
            <p>
              <strong>2. Legal Action in Case of Default:</strong> In the event of non-payment, you acknowledge that Phoenix Financial Services has the right to report the outstanding debt to credit bureaus, recover legal costs and collection fees, and obtain a court garnishee order against your salary.
            </p>
            <p>
              <strong>3. Acknowledgment of Debt:</strong> You confirm that the total repayable amount of <strong>{formatCurrency(totalRepay)}</strong> constitutes a legally binding debt and you voluntarily agree to these terms.
            </p>
          </div>

          <div className="pt-6 border-t border-slate-200 mt-5 grid grid-cols-2 gap-4 text-[10px] text-slate-600">
            <div className="text-center">
              {renderSignature()}
              <div className="mt-1 font-semibold text-slate-800">CLIENT (DEBTOR) SIGNATURE</div>
            </div>
            <div className="text-center">
              <div className="flex flex-col items-center justify-center">
                <span className="font-serif italic text-sm text-slate-700 block border-b border-slate-300 pb-1 font-bold">C. du Plessis</span>
                <span className="text-[8px] text-slate-400 font-mono mt-0.5">Authorised Representative</span>
              </div>
              <div className="mt-1 font-semibold text-slate-800">WITNESS / REP SIGNATURE</div>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'affordability_dec') {
      const aff = agreement.affordability || {
        income: 0,
        expensesTotal: 0,
        disposable: 0,
        afterAgreement: 0
      };

      const rent = aff.rent ?? 0;
      const municipal = aff.municipal ?? 0;
      const food = aff.food ?? 0;
      const transport = aff.transport ?? 0;
      const clothing = aff.clothing ?? 0;
      const telephone = aff.telephone ?? 0;
      const otherLoans = aff.otherLoans ?? 0;
      const insurance = aff.insurance ?? 0;
      const pocketMoney = aff.pocketMoney ?? 0;
      const expensesTotal = aff.expensesTotal ?? (rent + municipal + food + transport + clothing + telephone + otherLoans + insurance + pocketMoney);

      return (
        <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-inner max-w-lg mx-auto font-sans leading-relaxed text-[11px] border border-slate-200">
          <div className="text-center border-b-2 border-slate-900 pb-2 mb-3">
            <h4 className="text-sm font-black uppercase text-slate-950">Phoenix Financial Services</h4>
            <p className="text-[9px] text-slate-500">Reg No: 2025/685262/07 | NCR Reg No: NCR/CP/10452 | 50A Von Weilligh Street, Rustenburg, 0300</p>
          </div>

          <div className="text-center font-bold text-slate-950 border-b border-slate-800 pb-1.5 mb-3 text-[11px] uppercase tracking-wide">
            CONSUMER NECESSARY EXPENSE DECLARATION (NCA SECTION 81)
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] mb-3 border border-slate-200 p-2.5 rounded bg-slate-50">
            <div><span className="text-slate-500 font-semibold uppercase text-[8px]">Surname:</span> <strong>{customer.surname || '—'}</strong></div>
            <div><span className="text-slate-500 font-semibold uppercase text-[8px]">First Names:</span> <strong>{customer.firstNames || customer.name}</strong></div>
            <div><span className="text-slate-500 font-semibold uppercase text-[8px]">ID Number:</span> <strong>{idNum}</strong></div>
            <div><span className="text-slate-500 font-semibold uppercase text-[8px]">Contact Number:</span> <strong>{contact}</strong></div>
            <div className="col-span-2 border-t border-slate-200 pt-1 mt-1"><span className="text-slate-500 font-semibold uppercase text-[8px]">Nominated Address:</span> <span className="text-slate-700">{address}</span></div>
          </div>

          <div className="text-[8.5px] leading-tight text-slate-500 bg-amber-500/5 border border-amber-500/10 p-2 rounded mb-3 text-justify">
            <strong>NCA SEC 81(1) WARNING:</strong> Prospective consumers must answer fully and truthfully. Misrepresentation of living expenses is an offence under South African credit regulatory law.
          </div>

          <div className="space-y-1 mb-4 text-[9.5px]">
            <div className="text-[9px] font-bold text-slate-800 uppercase tracking-wider mb-1">Declared Monthly Household Expenses</div>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left text-[9.5px]">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-1 px-2">Expense category</th>
                    <th className="p-1 text-right pr-2">Declared Monthly Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr><td className="p-1 px-2">Housing (Rent/Bond)</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(rent)}</td></tr>
                  <tr><td className="p-1 px-2">Municipal Utilities</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(municipal)}</td></tr>
                  <tr><td className="p-1 px-2">Groceries / Food Supplies</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(food)}</td></tr>
                  <tr><td className="p-1 px-2">Transport Services</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(transport)}</td></tr>
                  <tr><td className="p-1 px-2">Clothing &amp; Attire</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(clothing)}</td></tr>
                  <tr><td className="p-1 px-2">Telephone &amp; Cellular Services</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(telephone)}</td></tr>
                  <tr><td className="p-1 px-2">Other Instalments &amp; Debts</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(otherLoans)}</td></tr>
                  <tr><td className="p-1 px-2">Insurance Policies</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(insurance)}</td></tr>
                  <tr><td className="p-1 px-2">Sundries &amp; Pocket Money</td><td className="p-1 text-right pr-2 font-mono">{formatCurrency(pocketMoney)}</td></tr>
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="p-1 px-2">TOTAL MONTHLY EXPENSES</td>
                    <td className="p-1 text-right pr-2 font-mono">{formatCurrency(expensesTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1 mb-4 text-[9.5px]">
            <div className="text-[9px] font-bold text-slate-800 uppercase tracking-wider mb-1">Affordability Summary</div>
            <div className="grid grid-cols-2 gap-2 text-[10px] border border-slate-250 rounded p-2 bg-slate-50">
              <div className="text-slate-500">Gross/Net Monthly Income:</div>
              <div className="text-right font-bold text-slate-900 font-mono">{formatCurrency(aff.income)}</div>
              <div className="text-slate-500">Calculated Disposable Surplus [A]:</div>
              <div className="text-right font-bold text-slate-900 font-mono">{formatCurrency(aff.disposable)}</div>
              <div className="text-slate-500">Proposed Instalment Sum [B]:</div>
              <div className="text-right font-bold text-orange-600 font-mono">{formatCurrency(agreement.totalAmount)}</div>
              <div className="text-slate-500 border-t border-slate-200 pt-1 mt-1 font-bold">Surplus after instalment [A - B]:</div>
              <div className="text-right border-t border-slate-200 pt-1 mt-1 font-black text-emerald-700 font-mono">{formatCurrency(aff.afterAgreement)}</div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 mt-4 grid grid-cols-2 gap-4 text-[10px] text-slate-600">
            <div className="text-center">
              {renderSignature()}
              <div className="mt-1 font-semibold text-slate-800">BORROWER SIGNATURE</div>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-300 text-center font-medium pb-0.5">{agreementDate}</div>
              <div className="mt-1 font-semibold text-slate-800">Date of Declaration</div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="modal-overlay open" style={{ zIndex: 9999 }} onClick={onClose}>
      <div 
        className="modal max-w-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-2xl relative flex flex-col max-h-[95vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header bg-slate-950/80 sticky top-0 backdrop-blur-md z-10 border-b border-slate-850 p-4">
          <div className="flex items-center gap-2">
            <FileText className="text-amber-500 h-5 w-5 animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-1.5">
                {title}
                {agreement?.electronicSignature && (
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <Check size={8} className="stroke-[3]" /> SIGNED
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">Verify accuracy before downloading output format</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body p-6 overflow-y-auto flex-1 bg-slate-950/30">
          {renderContent()}
        </div>

        <div className="modal-footer bg-slate-950/80 sticky bottom-0 border-t border-slate-850 p-4 flex justify-between items-center z-10">
          <button 
            type="button" 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer transition active:scale-95" 
            onClick={onClose}
          >
            Cancel
          </button>
          
          <button 
            type="button" 
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-lg text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-amber-500/10" 
            onClick={() => {
              onDownload();
              onClose();
            }}
          >
            <Download size={14} /> Download File Now
          </button>
        </div>
      </div>
    </div>
  );
}
