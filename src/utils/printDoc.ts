import { Agreement, Customer } from '../types';

/**
 * Formats a number as South African Rand
 */
const formatCurrency = (amount: number): string => {
  return 'R ' + (amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Formats date into standard South African format (DD MMM YYYY)
 */
const formatDateFriendly = (dateStr: string): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

/**
 * Common printing helper using dynamic iframe to avoid popups and keep the UI clean.
 */
const triggerPrint = (htmlContent: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('Could not get iframe document');
    return;
  }
  doc.open();
  doc.write(htmlContent);
  doc.close();
  
  // Wait for load, focus, print, and clean up
  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1500);
  }, 600);
};

/**
 * Prints a complete, legally compliant Credit Agreement & Acknowledgement of Debt (AOD)
 * containing NCA compliance disclosures, pre-agreement statement, quotation, and contract terms.
 */
export const printLegalAgreement = (agreement: Agreement, customer: Customer) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const totalRepay = formatCurrency(agreement.totalAmount);
  const repaymentDate = formatDateFriendly(agreement.dueDate);
  const contact = customer.phone || '—';
  const idNum = customer.idNumber || '—';
  const fileNo = customer.fileNo || '—';
  const agreementNumber = agreement.agrNumber;
  const agreementDate = formatDateFriendly(agreement.date);
  
  const principalAmount = agreement.goods + agreement.loan;
  const initiationFee = agreement.initiationFee || 0;
  const serviceFee = agreement.serviceFee || 0;
  const insurancePremium = agreement.insurancePremium || 0;
  const insuranceTypeStr = agreement.insuranceType === 'none' ? 'None (External Waiver)' :
                           agreement.insuranceType === 'base' ? 'Mandatory Base Credit Life' :
                           agreement.insuranceType === 'topup' ? 'Top-Up Structural Credit Life' : 'No Coverage';
  const vatAmount = agreement.vatAmount || 0;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Credit Agreement & Acknowledgement of Debt - ${agreementNumber}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.4;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        @media print {
          body {
            padding: 0;
            font-size: 10px;
          }
          .no-print {
            display: none;
          }
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 16px;
          text-transform: uppercase;
          margin: 0 0 4px 0;
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 2px 0;
          color: #4a4a4a;
        }
        .section-title {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: bold;
          background-color: #f2f2f2;
          padding: 4px 8px;
          margin-top: 15px;
          margin-bottom: 10px;
          border: 1px solid #ddd;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        td {
          padding: 4px 8px;
          vertical-align: top;
        }
        .label {
          font-weight: bold;
          color: #333;
          width: 30%;
        }
        .value {
          color: #000;
        }
        .financial-table {
          border: 1px solid #ddd;
        }
        .financial-table td {
          border-bottom: 1px solid #eee;
          padding: 6px 8px;
        }
        .financial-table tr:last-child td {
          border-bottom: none;
        }
        .financial-table .total-row {
          font-weight: bold;
          background-color: #fafafa;
          font-size: 12px;
          border-top: 1.5px solid #000;
        }
        .terms-text {
          font-size: 9px;
          color: #333;
          text-align: justify;
          margin-bottom: 15px;
          padding: 0 5px;
        }
        .terms-text ol {
          margin: 0;
          padding-left: 15px;
        }
        .terms-text li {
          margin-bottom: 4px;
        }
        .signatures {
          margin-top: 25px;
          page-break-inside: avoid;
        }
        .sig-row {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }
        .sig-box {
          width: 30%;
          border-top: 1px solid #000;
          text-align: center;
          padding-top: 5px;
          font-size: 9px;
        }
        .watermark {
          text-align: center;
          color: #888;
          font-size: 8px;
          margin-top: 20px;
          border-top: 1px dashed #ddd;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>South African Social Services Company</h1>
        <p><strong>SASSC (Pty) Ltd — Trading under Phoenix Financial Services</strong></p>
        <p>Company Reg No: 2025/685262/07 | NCR Reg: NCR/CP/10452</p>
        <p>Physical Address: 50A Von Weilligh Street, Rustenburg, 0300 | Tel: 086 100 2472 | Email: CBRDUPLESSIS.X2@GMAIL.COM</p>
      </div>

      <div style="text-align: center; font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px;">
        PART A: PRE-AGREEMENT STATEMENT &amp; QUOTATION
      </div>

      <div class="terms-text" style="font-size: 10px; margin-bottom: 15px;">
        As required by Section 92 of the National Credit Act, No. 34 of 2005 ("NCA"). This quotation is binding for five (5) business days from the date of disclosure.
      </div>

      <div class="section-title">1. Customer (Debtor) Particulars</div>
      <table>
        <tr>
          <td class="label">Full Names &amp; Surname:</td>
          <td class="value">${customerName}</td>
          <td class="label">Customer File No:</td>
          <td class="value">#${fileNo}</td>
        </tr>
        <tr>
          <td class="label">Identity Number:</td>
          <td class="value">${idNum}</td>
          <td class="label">Mobile Number:</td>
          <td class="value">${contact}</td>
        </tr>
        <tr>
          <td class="label">Physical Address:</td>
          <td class="value" colspan="3">${customer.address || '—'}</td>
        </tr>
        <tr>
          <td class="label">Employer &amp; Tel:</td>
          <td class="value">${customer.employer || '—'} (${customer.workPhone || '—'})</td>
          <td class="label">Employment Address:</td>
          <td class="value">${customer.workAddress || '—'}</td>
        </tr>
      </table>

      <div class="section-title">2. Financial Disclosure &amp; Cost of Credit</div>
      <table class="financial-table">
        <tr>
          <td class="label">Principal Goods Capital (Groceries):</td>
          <td class="value" style="text-align: right;">${formatCurrency(agreement.goods)}</td>
        </tr>
        <tr>
          <td class="label">Principal Cash Loan Advance:</td>
          <td class="value" style="text-align: right;">${formatCurrency(agreement.loan)}</td>
        </tr>
        <tr style="font-weight: 500;">
          <td class="label">Total Capital Principal Debt:</td>
          <td class="value" style="text-align: right; font-weight: bold;">${formatCurrency(principalAmount)}</td>
        </tr>
        <tr>
          <td class="label">NCA Initiation Fee (10% on Principal):</td>
          <td class="value" style="text-align: right;">${formatCurrency(initiationFee)}</td>
        </tr>
        <tr>
          <td class="label">NCA Monthly Service Fee:</td>
          <td class="value" style="text-align: right;">${formatCurrency(serviceFee)}</td>
        </tr>
        <tr>
          <td class="label">Credit Life Insurance (${insuranceTypeStr}):</td>
          <td class="value" style="text-align: right;">${formatCurrency(insurancePremium)}</td>
        </tr>
        <tr>
          <td class="label">15% VAT:</td>
          <td class="value" style="text-align: right;">${formatCurrency(vatAmount)}</td>
        </tr>
        <tr>
          <td class="label">Nominal Annual Interest Rate:</td>
          <td class="value" style="text-align: right;">0.00% (Interest-Free SASSC Pension Welfare Program)</td>
        </tr>
        <tr class="total-row">
          <td>TOTAL REPAYABLE COST OF CREDIT (VAT-INCL):</td>
          <td style="text-align: right; color: #b45309;">${totalRepay}</td>
        </tr>
      </table>

      <div class="section-title">3. Repayment Schedule</div>
      <table>
        <tr>
          <td class="label">Repayment Due Date:</td>
          <td class="value"><strong>${repaymentDate}</strong> (Allocated to Next Social Grant / Salary Day)</td>
        </tr>
        <tr>
          <td class="label">Repayment Structure:</td>
          <td class="value">Single installment settlement of <strong>${totalRepay}</strong>.</td>
        </tr>
        <tr>
          <td class="label">EFT Reference:</td>
          <td class="value"><code>${agreementNumber}</code></td>
        </tr>
      </table>

      <div style="text-align: center; font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 25px; margin-bottom: 10px; page-break-before: auto;">
        PART B: CREDIT AGREEMENT &amp; ACKNOWLEDGEMENT OF DEBT (AOD)
      </div>

      <div class="terms-text">
        I, the undersigned, <strong>${customerName}</strong>, do hereby admit and acknowledge that I am lawfully, truly and justly indebted to <strong>SASSC (Pty) Ltd</strong> in the sum of <strong>${totalRepay}</strong>, arising from the principal goods and loans specified in credit invoice <strong>${agreementNumber}</strong> dated <strong>${agreementDate}</strong>. I hereby bind myself to the following Terms &amp; Conditions under South African law:
        <ol>
          <li><strong>Undertaking to Pay:</strong> I unconditionally undertake to pay SASSC (Pty) Ltd the total outstanding repayable sum on or before the due date specified. All payments shall be made free of bank exchange or deduction at the registered offices of SASSC or via direct debit order / bank EFT.</li>
          <li><strong>DebiCheck / Payroll Consent:</strong> I hereby expressly authorize and instruct SASSC to submit a DebiCheck debit order instruction or a payroll deduction mandate against my designated bank account for the amount of ${totalRepay} on the next Social Grant / Payday scheduled for ${repaymentDate}.</li>
          <li><strong>Consent to Jurisdiction:</strong> In terms of Section 45 of the Magistrate's Court Act 32 of 1944, I hereby consent to the jurisdiction of the Magistrate's Court having jurisdiction in respect of any legal action which may be instituted against me by SASSC arising from this agreement.</li>
          <li><strong>Credit Bureau Consent:</strong> I consent and acknowledge that SASSC may transmit data about my credit profile and payment performance to registered Credit Bureaus in terms of Section 70 and Regulation 19 of the National Credit Act. In the event of default, my profile may be listed accordingly.</li>
          <li><strong>Default and Collection Costs:</strong> Should I fail to pay any single amount on the due date, the entire balance becomes immediately due, and SASSC is entitled to recover default administration charges, interest at the maximum statutory rate, and all legal costs on an attorney-and-client scale, including collection commission.</li>
          <li><strong>Certificate of Indebtedness:</strong> A certificate signed by any director or manager of SASSC (Pty) Ltd showing the amount of my indebtedness under this agreement shall be prima facie (sufficient) proof of my outstanding balance for purposes of obtaining summary judgment or provisional sentence.</li>
        </ol>
      </div>

      <div class="signatures">
        <div class="sig-row">
          <div class="sig-box" style="border-top: 1px solid #000;">
            <br/><br/>
            <strong>DEBTOR (CUSTOMER) SIGNATURE</strong><br/>
            Name: ${customerName}<br/>
            Date: ________________________
          </div>
          <div class="sig-box" style="border-top: 1px solid #000;">
            <br/><br/>
            <strong>SASSC REPRESENTATIVE SIGNATURE</strong><br/>
            For SASSC (Pty) Ltd<br/>
            Date: ________________________
          </div>
          <div class="sig-box" style="border-top: 1px solid #000;">
            <br/><br/>
            <strong>WITNESS SIGNATURE</strong><br/>
            Name: ________________________<br/>
            Date: ________________________
          </div>
        </div>
      </div>

      <div class="watermark">
        SASSC Compliance Department | Document Ref: SASSC-AOD-${agreementNumber} | Generated on ${new Date().toLocaleString('en-ZA')}
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

/**
 * Prints a beautifully formatted Tax Invoice for the Credit Agreement.
 * Provides itemized grocery bills or cash advance details.
 */
export const printAccountInvoice = (agreement: Agreement, customer: Customer) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const totalRepay = formatCurrency(agreement.totalAmount);
  const repaymentDate = formatDateFriendly(agreement.dueDate);
  const contact = customer.phone || '—';
  const idNum = customer.idNumber || '—';
  const fileNo = customer.fileNo || '—';
  const address = customer.address || '—';
  const invoiceNumber = agreement.agrNumber;
  const invoiceDate = formatDateFriendly(agreement.date);
  
  const principalAmount = agreement.goods + agreement.loan;
  const initiationFee = agreement.initiationFee || 0;
  const serviceFee = agreement.serviceFee || 0;
  const insurancePremium = agreement.insurancePremium || 0;
  const insuranceTypeStr = agreement.insuranceType === 'none' ? 'None (External Waiver)' :
                           agreement.insuranceType === 'base' ? 'Mandatory Base Credit Life' :
                           agreement.insuranceType === 'topup' ? 'Top-Up Structural Credit Life' : 'No Coverage';
  const vatAmount = agreement.vatAmount || 0;

  // Render invoice items
  let rows = '';
  if (agreement.items && agreement.items.length > 0) {
    rows = agreement.items.map((item, index) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 6px;">${item.name}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.qty}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(item.price)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(item.price * item.qty)}</td>
      </tr>
    `).join('');
  } else {
    rows = `
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;">1</td>
        <td style="border: 1px solid #ddd; padding: 6px;">Groceries Advance Package Capital</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">1</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(agreement.goods)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(agreement.goods)}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 6px;">2</td>
        <td style="border: 1px solid #ddd; padding: 6px;">Cash Loan Welfare Advance Capital</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">1</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">${formatCurrency(agreement.loan)}</td>
        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; font-weight: bold;">${formatCurrency(agreement.loan)}</td>
      </tr>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Tax Invoice - ${invoiceNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.4;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        @media print {
          body {
            padding: 0;
            font-size: 10px;
          }
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header-left h1 {
          font-size: 18px;
          text-transform: uppercase;
          margin: 0 0 4px 0;
          font-weight: bold;
        }
        .header-left p {
          margin: 2px 0;
          color: #4a4a4a;
        }
        .header-right {
          text-align: right;
        }
        .invoice-title {
          font-size: 20px;
          font-weight: bold;
          text-transform: uppercase;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }
        .details-grid {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .details-box {
          width: 48%;
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 4px;
        }
        .details-box h3 {
          margin: 0 0 6px 0;
          font-size: 11px;
          text-transform: uppercase;
          border-bottom: 1px solid #eee;
          padding-bottom: 4px;
        }
        .details-box p {
          margin: 3px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          padding: 6px;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: bold;
        }
        .summary-wrapper {
          display: flex;
          justify-content: space-between;
          page-break-inside: avoid;
        }
        .banking-details {
          width: 50%;
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 4px;
          background-color: #fafafa;
        }
        .banking-details h4 {
          margin: 0 0 6px 0;
          font-size: 10px;
          text-transform: uppercase;
          color: #333;
          border-bottom: 1px solid #ddd;
          padding-bottom: 4px;
        }
        .summary-box {
          width: 45%;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px solid #eee;
        }
        .summary-row.total {
          border-top: 1.5px solid #000;
          border-bottom: 1.5px solid #000;
          font-weight: bold;
          font-size: 12px;
          padding: 6px 0;
          margin-top: 4px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #777;
          font-size: 8px;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>South African Social Services Company</h1>
          <p>SASSC (Pty) Ltd — Trading under Phoenix Financial Services (Reg: 2025/685262/07 | NCR: NCR/CP/10452)</p>
          <p>Address: 50A Von Weilligh Street, Rustenburg, 0300</p>
          <p>Tel: 086 100 2472 | Email: CBRDUPLESSIS.X2@GMAIL.COM</p>
        </div>
        <div class="header-right">
          <div class="invoice-title">Tax Invoice</div>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Date of Issue:</strong> ${invoiceDate}</p>
          <p><strong>Due Date:</strong> ${repaymentDate}</p>
        </div>
      </div>

      <div class="details-grid">
        <div class="details-box">
          <h3>Billed To (Customer Detail)</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Identity Number:</strong> ${idNum}</p>
          <p><strong>Customer File No:</strong> #${fileNo}</p>
          <p><strong>Mobile phone:</strong> ${contact}</p>
          <p><strong>Address:</strong> ${address}</p>
        </div>
        <div class="details-box">
          <h3>Payment Terms &amp; Settlement</h3>
          <p><strong>Account Class:</strong> SASSC Pensioner Grocery Credit</p>
          <p><strong>Interest Rate:</strong> 0.00% Nominal interest</p>
          <p><strong>Repayment Trigger:</strong> Direct debit mandate / EFT repayment</p>
          <p><strong>Repayment Due Date:</strong> ${repaymentDate}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 5%; text-align: center;">Item</th>
            <th style="width: 50%; text-align: left;">Item Description</th>
            <th style="width: 10%; text-align: center;">Qty</th>
            <th style="width: 15%; text-align: right;">Unit Price</th>
            <th style="width: 20%; text-align: right;">Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="summary-wrapper">
        <div class="banking-details">
          <h4>Repayment Instructions (EFT Bank Routing)</h4>
          <p style="margin: 4px 0;">To settle this outstanding invoice, please transfer funds into the official trust account:</p>
          <p style="margin: 3px 0;"><strong>Bank Name:</strong> First National Bank (FNB)</p>
          <p style="margin: 3px 0;"><strong>Account Name:</strong> SASSC Credit Collections Trust</p>
          <p style="margin: 3px 0;"><strong>Account Number:</strong> 629 184 929 39</p>
          <p style="margin: 3px 0;"><strong>Branch Code:</strong> 250655</p>
          <p style="margin: 3px 0;"><strong>EFT Payment Reference:</strong> <code style="font-size: 11px; background-color: #eee; padding: 2px 4px; border-radius: 2px; font-weight: bold; border: 1px solid #ccc;">${invoiceNumber}</code></p>
          <p style="margin: 4px 0; font-size: 8.5px; color: #666; font-style: italic;">* Note: Please ensure the Invoice Number is written exactly as the bank payment reference to guarantee auto-allocation.</p>
        </div>
        
        <div class="summary-box">
          <div class="summary-row">
            <span>Capital Goods / Loans (Principal):</span>
            <span>${formatCurrency(principalAmount)}</span>
          </div>
          <div class="summary-row">
            <span>NCA Approved Initiation Fee:</span>
            <span>${formatCurrency(initiationFee)}</span>
          </div>
          <div class="summary-row">
            <span>NCA Approved Monthly Service Fee:</span>
            <span>${formatCurrency(serviceFee)}</span>
          </div>
          <div class="summary-row">
            <span>Credit Life Insurance (${insuranceTypeStr}):</span>
            <span>${formatCurrency(insurancePremium)}</span>
          </div>
          <div class="summary-row">
            <span>15% VAT:</span>
            <span>${formatCurrency(vatAmount)}</span>
          </div>
          <div class="summary-row total">
            <span>Total Repayable Cost (VAT-Incl):</span>
            <span>${totalRepay}</span>
          </div>
          <div class="summary-row" style="color: #10b981; font-weight: 600;">
            <span>Total Paid to Date:</span>
            <span>${formatCurrency(agreement.paid)}</span>
          </div>
          <div class="summary-row" style="color: #f43f5e; font-weight: 800; border-top: 1px solid #ddd; margin-top: 4px; font-size: 11px;">
            <span>Remaining Balance Due:</span>
            <span>${formatCurrency(agreement.balance)}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your business. For compliance queries, please email CBRDUPLESSIS.X2@GMAIL.COM or call 086 100 2472.</p>
        <p>Phoenix Financial Services is an Authorized Credit Provider registered under NCR number NCR/CP/10452.</p>
        <p>Invoice generated on ${new Date().toLocaleString('en-ZA')}</p>
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

/**
 * Prints a beautifully formatted Consent & Authorization for Salary Deduction and Legal Action.
 * Compliant with NCA and South African employment law directives.
 */
export const printSalaryConsent = (agreement: Agreement, customer: Customer) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const shortName = customer.name || customerName;
  const idNum = customer.idNumber || '—';
  const fileNo = customer.fileNo || '—';
  const address = customer.address || '—';
  const phone = customer.phone || '—';
  const employerName = customer.employer || 'Designated Employer';
  const agreementNumber = agreement.agrNumber;
  const lDate = formatDateFriendly(agreement.date);
  
  const payment = formatCurrency(agreement.loan);
  const totalAmount = formatCurrency(agreement.totalAmount);
  const goodsAmount = formatCurrency(agreement.goods);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Consent & Authorization for Salary Deduction - ${agreementNumber}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.5;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        @media print {
          body {
            padding: 0;
            font-size: 10px;
          }
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 16px;
          text-transform: uppercase;
          margin: 0 0 4px 0;
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 2px 0;
          color: #4a4a4a;
        }
        .section-title {
          font-size: 11px;
          text-transform: uppercase;
          font-weight: bold;
          background-color: #f2f2f2;
          padding: 4px 8px;
          margin-top: 15px;
          margin-bottom: 10px;
          border: 1px solid #ddd;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        td {
          padding: 4px 8px;
          vertical-align: top;
        }
        .label {
          font-weight: bold;
          color: #333;
          width: 30%;
        }
        .value {
          color: #000;
        }
        .terms-text {
          font-size: 10px;
          color: #1a1a1a;
          text-align: justify;
          margin-bottom: 15px;
          padding: 0 5px;
        }
        .terms-text p {
          margin: 0 0 10px 0;
        }
        .terms-text ol {
          margin: 0;
          padding-left: 15px;
        }
        .terms-text li {
          margin-bottom: 8px;
        }
        .signatures {
          margin-top: 30px;
          page-break-inside: avoid;
        }
        .sig-row {
          display: flex;
          justify-content: space-between;
          margin-top: 25px;
        }
        .sig-box {
          width: 45%;
          border-top: 1px solid #000;
          text-align: center;
          padding-top: 5px;
          font-size: 9px;
        }
        .watermark {
          text-align: center;
          color: #888;
          font-size: 8px;
          margin-top: 30px;
          border-top: 1px dashed #ddd;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Phoenix Financial Services</h1>
        <p><strong>PHOENIX FINANCIAL SERVICES (PTY) LTD — Registered Credit Provider</strong></p>
        <p>Physical Address: 50A Von Weilligh Street, Rustenburg, 0300 | Tel: 086 100 2472 | Email: CBRDUPLESSIS.X2@GMAIL.COM</p>
      </div>

      <div style="text-align: right; margin-bottom: 15px; font-weight: 500;">
        Date: ${lDate}
      </div>

      <div style="margin-bottom: 15px;">
        <strong>To:</strong> Employment Payroll Department / SASSA Welfare Disbursements<br/>
        <strong>File Reference:</strong> #${fileNo}<br/>
        <strong>Customer:</strong> ${customerName} (ID: ${idNum})<br/>
        <strong>Address:</strong> ${address}
      </div>

      <div style="font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; border-bottom: 1.5px solid #000; padding-bottom: 4px;">
        SUBJECT: CONSENT &amp; AUTHORIZATION FOR SALARY DEDUCTION AND LEGAL ACTION IN CASE OF DEFAULT
      </div>

      <div class="terms-text">
        <p>Dear ${customerName} (ID: ${idNum})</p>

        <p>This letter serves as a formal agreement wherein you, <strong>${shortName}</strong>, with ID number: <strong>${idNum}</strong>, hereby give your full and irrevocable consent for the deduction of loan repayments directly from your salary and authorize <strong>Phoenix Financial Services</strong> to take necessary legal action under the South African National Credit Act (NCA) 34 of 2005 in the event of default on <strong>${lDate}</strong>.</p>

        <div style="font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 11px; text-transform: uppercase;">1. Authority to Deduct Salary</div>
        <p>You hereby authorize <strong>Phoenix Financial Services (Pty) Ltd</strong> to instruct your employer, <strong>${employerName}</strong>, to deduct the agreed loan repayment amount from your monthly salary and transfer it directly to <strong>Phoenix Financial Services Trust Account</strong> until the full outstanding amount is settled. This deduction will occur on your first salary date following the loan issuance or after default without payment arrangement, and continue as per the agreed repayment terms.</p>

        <div style="font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 11px; text-transform: uppercase;">2. Consent to Legal Action in Case of Default</div>
        <p>In the event of non-payment or default, you acknowledge that <strong>Phoenix Financial Services</strong> (50A Von Weilligh Street, Rustenburg, 0300) has the full legal right to:</p>
        <ul>
          <li style="margin-bottom: 4px;">Report the outstanding debt to credit bureaus, affecting your credit profile.</li>
          <li style="margin-bottom: 4px;">Institute legal proceedings in accordance with the National Credit Act (NCA) and South African law.</li>
          <li style="margin-bottom: 4px;">Recover any legal costs, collection fees, and interest incurred due to default as permitted by law.</li>
          <li style="margin-bottom: 4px;">Obtain a court judgment and garnishee order against your salary or any other assets for recovery of outstanding amounts.</li>
        </ul>

        <div style="font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 11px; text-transform: uppercase;">3. Acknowledgment of Debt</div>
        <p>You acknowledge that the loan amount of <strong>${payment}</strong> (and/or groceries credit of <strong>${goodsAmount}</strong>), with total repayable amount of <strong>${totalAmount}</strong>, together with agreed-upon interest and service fees, constitutes a legally binding debt. You further confirm that you have understood and agreed to the repayment terms outlined in your loan agreement.</p>

        <div style="font-weight: bold; margin-top: 15px; margin-bottom: 5px; font-size: 11px; text-transform: uppercase;">4. Termination of this Authority</div>
        <p>This authority shall remain valid until the full repayment of the loan and any outstanding costs. Any revocation of this authority must be provided in writing and will only be valid once acknowledged by Phoenix Financial Services via e-mail to <strong>cbrduplessis.x2@gmail.com</strong>.</p>

        <p style="margin-top: 15px;">By signing below, you confirm that you understand and voluntarily consent to the terms outlined in this letter.</p>
      </div>

      <div style="margin-top: 25px;">
        <p>Yours Faithfully,</p>
        <p>
          <strong>Claudine Pike du Plessis</strong><br/>
          Phoenix Financial Services<br/>
          Tel: 086 100 2472
        </p>
      </div>

      <div style="page-break-before: auto; margin-top: 30px; border-top: 2px solid #000; padding-top: 15px;">
        <div style="text-align: center; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 15px;">
          CLIENT CONSENT &amp; ACKNOWLEDGMENT
        </div>

        <div class="terms-text" style="font-size: 11px;">
          I, <strong>${customerName}</strong>, with ID number <strong>${idNum}</strong>, hereby confirm that I have read, understood, and agree to the terms of this authorization letter.<br/><br/>
          I give my full consent to salary deductions and legal action as stipulated above.
        </div>

        <div class="signatures">
          <div class="sig-row">
            <div class="sig-box">
              <br/><br/>
              <strong>CLIENT (DEBTOR) SIGNATURE</strong><br/>
              Date: ________________________
            </div>
            <div class="sig-box">
              <br/><br/>
              <strong>WITNESS SIGNATURE (IF REQUIRED)</strong><br/>
              Date: ________________________
            </div>
          </div>
        </div>
      </div>

      <div class="watermark">
        Phoenix Compliance Department | Document Ref: PHOENIX-CONSENT-${agreementNumber} | Generated on ${new Date().toLocaleString('en-ZA')}
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

/**
 * Prints a beautifully formatted and legally compliant Consumer Necessary Expense Declaration.
 * Mandatory under Section 81(1) of the South African National Credit Act (NCA) to verify affordability.
 */
export const printAffordabilityDeclaration = (agreement: Agreement, customer: Customer) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const idNum = customer.idNumber || '—';
  const fileNo = customer.fileNo || '—';
  const address = customer.address || '—';
  const phone = customer.phone || '—';
  const email = customer.email || '—';
  const agreementNumber = agreement.agrNumber;
  const lDate = formatDateFriendly(agreement.date);

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

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Consumer Necessary Expense Declaration - ${agreementNumber}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.4;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        @media print {
          body {
            padding: 0;
            font-size: 10px;
          }
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 8px;
          margin-bottom: 15px;
        }
        .header h1 {
          font-size: 15px;
          text-transform: uppercase;
          margin: 0 0 4px 0;
          font-weight: bold;
          letter-spacing: 0.5px;
        }
        .header p {
          margin: 2px 0;
          color: #4a4a4a;
          font-size: 10px;
        }
        .doc-title {
          text-align: center;
          font-size: 13px;
          font-weight: bold;
          text-transform: uppercase;
          margin: 15px 0;
          text-decoration: underline;
        }
        .meta-table, .expenses-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        .meta-table td {
          border: 1px solid #1a1a1a;
          padding: 5px 8px;
          font-size: 10px;
        }
        .meta-table .label {
          font-weight: bold;
          background-color: #f5f5f5;
          width: 25%;
        }
        .expenses-table th, .expenses-table td {
          border: 1px solid #1a1a1a;
          padding: 5px 8px;
          text-align: left;
        }
        .expenses-table th {
          background-color: #f2f2f2;
          font-weight: bold;
          font-size: 10px;
          text-transform: uppercase;
        }
        .expenses-table .total-row td {
          font-weight: bold;
          background-color: #eaeaea;
        }
        .reminder-box {
          border: 1px solid #1a1a1a;
          padding: 10px;
          background-color: #fafafa;
          font-size: 9.5px;
          text-align: justify;
          margin-bottom: 15px;
        }
        .address-clause {
          font-size: 9px;
          color: #333;
          margin-top: 5px;
          margin-bottom: 15px;
          text-align: justify;
        }
        .signatures {
          margin-top: 25px;
          page-break-inside: avoid;
        }
        .sig-row {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }
        .sig-box {
          width: 48%;
          border-top: 1px solid #000;
          text-align: center;
          padding-top: 5px;
          font-size: 9px;
        }
        .watermark {
          text-align: center;
          color: #888;
          font-size: 8px;
          margin-top: 25px;
          border-top: 1px dashed #ddd;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 10px; font-weight: bold;">
        <div>Client number: ${fileNo}</div>
        <div>Loan number: ${agreementNumber}</div>
      </div>

      <div class="header">
        <h1>Phoenix Financial Services</h1>
        <p><strong>PHOENIX FINANCIAL SERVICES (PTY) LTD — Reg: 2025/685262/07 | NCR Reg No: NCR/CP/10452</strong></p>
        <p>Physical Address: 50A Von Weilligh Street, Rustenburg, 0300 | Tel: 086 100 2472 | Email: CBRDUPLESSIS.X2@GMAIL.COM</p>
      </div>

      <div class="doc-title">
        CONSUMER NECESSARY EXPENSE DECLARATION
      </div>

      <table class="meta-table">
        <tr>
          <td class="label">SURNAME [Mr./Mrs./Ms.]</td>
          <td>${customer.surname || '—'}</td>
          <td class="label">FIRST NAMES</td>
          <td>${customer.firstNames || customer.name || '—'}</td>
        </tr>
        <tr>
          <td class="label">ID NUMBER</td>
          <td>${idNum}</td>
          <td class="label">TEL No</td>
          <td>${phone}</td>
        </tr>
        <tr>
          <td class="label">E-MAIL ADDRESS</td>
          <td colspan="3">${email}</td>
        </tr>
        <tr>
          <td class="label">NOMINATED ADDRESS</td>
          <td colspan="3">
            ${address}
          </td>
        </tr>
      </table>

      <div class="address-clause">
        The Borrower nominates the above address for purposes of mail of any nature, including legal notices and court orders, to be sent. If the above address of the Borrower changes, then the Borrower must notify the Lender of the new address in writing by hand or registered mail to the address of the Lender within 10 business days from change.
      </div>

      <div class="reminder-box">
        <strong>NCA SECTION 81(1) COMPLIANCE REMINDER:</strong><br/>
        The Consumer completing this questionnaire is hereby reminded that in terms of Section 81(1) of the National Credit Act, when applying for a credit agreement, and while that credit agreement is being considered by the credit provider, the prospective consumer must fully and truthfully answer any request for information made by the credit provider as part of the assessment. Misrepresentation of facts will be dealt with in terms of the applicable law.
      </div>

      <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 8px; font-size: 10px;">
        DECLARED MONTHLY EXPENSES BY THE CONSUMER
      </div>

      <table class="expenses-table">
        <thead>
          <tr>
            <th style="width: 40%;">Description of Living Expenses</th>
            <th style="width: 20%;">Average Declared</th>
            <th style="width: 15%;">Exempted For</th>
            <th style="width: 25%;">Exemption Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Housing (Rent / Bond)</td>
            <td>${formatCurrency(rent)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Transport</td>
            <td>${formatCurrency(transport)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Municipal Services (Water / Electricity / Rates)</td>
            <td>${formatCurrency(municipal)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Groceries / Food</td>
            <td>${formatCurrency(food)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Clothing</td>
            <td>${formatCurrency(clothing)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Telephone / Cellphone</td>
            <td>${formatCurrency(telephone)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Hire Purchase Instalments</td>
            <td>${formatCurrency(otherLoans)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Insurance Premiums</td>
            <td>${formatCurrency(insurance)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Pocket Money / Sundries</td>
            <td>${formatCurrency(pocketMoney)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr class="total-row">
            <td>TOTAL EXPENSES [C]</td>
            <td>${formatCurrency(expensesTotal)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      <div style="font-weight: bold; margin-top: 15px; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 8px;">
        NCA REGULATORY AUDIT SCORECARD & RISK RATIO ASSESSMENT
      </div>
      <table class="meta-table" style="margin-bottom: 15px;">
        <tr>
          <td class="label" style="width: 25%;">Gross/Net Monthly Income</td>
          <td style="width: 25%; font-weight: bold;">${formatCurrency(aff.income)}</td>
          <td class="label" style="width: 25%;">Declared Living Expenses</td>
          <td style="width: 25%;">${formatCurrency(expensesTotal)}</td>
        </tr>
        <tr>
          <td class="label">Calculated Surplus [A]</td>
          <td style="font-weight: bold; color: ${aff.disposable >= 0 ? '#1b5e20' : '#b71c1c'};">${formatCurrency(aff.disposable)}</td>
          <td class="label">Proposed Monthly Installment [B]</td>
          <td style="font-weight: bold; color: #d84315;">${formatCurrency(agreement.totalAmount)}</td>
        </tr>
        <tr>
          <td class="label">Surplus After Contract [A - B]</td>
          <td colspan="3" style="font-weight: bold; background-color: ${aff.afterAgreement >= 0 ? '#e8f5e9' : '#ffebee'}; color: ${aff.afterAgreement >= 0 ? '#1b5e20' : '#b71c1c'};">
            ${formatCurrency(aff.afterAgreement)} &nbsp;&nbsp;&nbsp;&nbsp; 
            [${aff.afterAgreement >= 0 ? '✓ COMPLIANT SURPLUS' : '✗ OVER-INDEBTED WARNING'}]
          </td>
        </tr>
        <tr>
          <td class="label">Existing DTI Ratio</td>
          <td>${(aff.income > 0) ? ((otherLoans / aff.income) * 100).toFixed(1) + '%' : '0.0%'}</td>
          <td class="label">Proposed DTI Ratio (incl. Loan)</td>
          <td style="font-weight: bold; background-color: ${(((otherLoans + agreement.totalAmount) / aff.income) * 100) > 45 ? '#fff3e0' : '#f5f5f5'};">
            ${(aff.income > 0) ? (((otherLoans + agreement.totalAmount) / aff.income) * 100).toFixed(1) + '%' : '0.0%'} &nbsp;&nbsp;&nbsp;&nbsp;
            [NCR Risk: ${((otherLoans + agreement.totalAmount) / aff.income * 100) > 50 ? 'CRITICAL RISK' : ((otherLoans + agreement.totalAmount) / aff.income * 100) > 40 ? 'HIGH RISK' : ((otherLoans + agreement.totalAmount) / aff.income * 100) > 30 ? 'MODERATE RISK' : 'LOW RISK'}]
          </td>
        </tr>
      </table>

      <div style="font-weight: bold; margin-top: 15px; font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 10px;">
        EXEMPTIONS AS LISTED ACCEPTED BY BORROWER
      </div>
      <div style="font-size: 9.5px; margin-bottom: 15px;">
        Signed at <strong>Johannesburg</strong> on <strong>${lDate}</strong>
      </div>

      <div class="signatures">
        <div class="sig-row">
          <div class="sig-box">
            <br/><br/>
            <strong>BORROWER SIGNATURE</strong><br/>
            Date: ________________________
          </div>
          <div class="sig-box">
            <br/><br/>
            <strong>WITNESS SIGNATURE</strong><br/>
            Date: ________________________
          </div>
        </div>
      </div>

      <div class="watermark">
        Phoenix Regulatory Department | Form NCA-81-1-A | Document Ref: PHOENIX-AFFORD-${agreementNumber} | Generated on ${new Date().toLocaleString('en-ZA')}
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

/**
 * Prints the Freedom of Choice Mandate under Section 106(4) of the NCA
 */
export const printFreedomOfChoiceMandate = (agreement: Agreement, customer: Customer) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const agreementNumber = agreement.agrNumber;
  const agreementDate = formatDateFriendly(agreement.date);
  const idNum = customer.idNumber || '—';
  
  const isExternal = agreement.insuranceType === 'none';
  const selectedPolicyStr = agreement.insuranceType === 'none' ? 'EXTERNAL INSURANCE POLICY (WAIVER)' :
                            agreement.insuranceType === 'base' ? 'INTERNAL BASE CREDIT LIFE INSURANCE' :
                            agreement.insuranceType === 'topup' ? 'INTERNAL TOP-UP STRUCTURAL CREDIT LIFE' : 'NONE';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Freedom of Choice Mandate - Section 106(4) - ${agreementNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.5;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 2px solid #334155;
          padding-bottom: 15px;
        }
        .title {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          color: #0f172a;
        }
        .subtitle {
          font-size: 10px;
          color: #475569;
          margin-top: 5px;
          letter-spacing: 0.5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        td {
          padding: 6px;
          border: 1px solid #cbd5e1;
          vertical-align: top;
        }
        .label {
          background-color: #f8fafc;
          font-weight: bold;
          width: 30%;
        }
        .section-title {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          background-color: #0f172a;
          color: #ffffff;
          padding: 5px 8px;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .terms {
          text-align: justify;
          margin-bottom: 20px;
        }
        .option-box {
          border: 1px solid #94a3b8;
          border-radius: 4px;
          padding: 10px;
          margin: 8px 0;
          background-color: #f8fafc;
        }
        .signatures {
          margin-top: 40px;
        }
        .sig-row {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
        }
        .sig-box {
          width: 45%;
          border-top: 1px solid #1e293b;
          padding-top: 8px;
        }
        .watermark {
          text-align: center;
          font-size: 8px;
          color: #94a3b8;
          margin-top: 40px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Freedom of Choice Mandate</div>
        <div class="subtitle">SECTION 106(4) OF THE NATIONAL CREDIT ACT, NO. 34 OF 2005</div>
      </div>

      <table>
        <tr>
          <td class="label">Consumer Full Names:</td>
          <td>${customerName}</td>
          <td class="label">Identity Number:</td>
          <td>${idNum}</td>
        </tr>
        <tr>
          <td class="label">Credit Provider:</td>
          <td>SASSC Credit Ltd / Phoenix Financial Services</td>
          <td class="label">Agreement Number:</td>
          <td><strong>${agreementNumber}</strong></td>
        </tr>
        <tr>
          <td class="label">Date of Election:</td>
          <td>${agreementDate}</td>
          <td class="label">Selected Policy:</td>
          <td><strong>${selectedPolicyStr}</strong></td>
        </tr>
      </table>

      <div class="section-title">1. Statutory Declaration of Consumer Rights</div>
      <div class="terms">
        In terms of Section 106(4) of the National Credit Act (Act 34 of 2005), where a credit provider requires a consumer to maintain credit life insurance, the consumer must be given an explicit, free choice to either:
        <ul>
          <li><strong>Option A:</strong> Elect to purchase a policy offered by the credit provider (our internal statutory program); or</li>
          <li><strong>Option B:</strong> Elect to provide an existing or external policy of their own choice, naming the credit provider as first loss payee up to the value of the outstanding debt.</li>
        </ul>
        The Credit Provider is strictly prohibited from forcing, coercing, or auto-enrolling a consumer into an internal policy without presenting this Freedom of Choice Mandate first.
      </div>

      <div class="section-title">2. Consumer Election & Acknowledgement</div>
      <div class="terms">
        I, the undersigned, <strong>${customerName}</strong>, do hereby declare that I was fully informed of my rights in terms of Section 106(4) of the National Credit Act before entering into this credit agreement. I make the following choice:
        
        <div class="option-box">
          <strong>[ ${!isExternal ? '✓' : ' &nbsp; '} ] I ELECT TO PURCHASE THE CREDIT PROVIDER'S INSURANCE</strong><br/>
          I authorize SASSC/Phoenix to issue the selected credit life insurance policy on my behalf. I understand that the initial monthly premium is specified in my Form 20 Quote and is itemized in my invoice on a declining-balance basis.
        </div>

        <div class="option-box">
          <strong>[ ${isExternal ? '✓' : ' &nbsp; '} ] I ELECT TO PROVIDE AN EXTERNAL INSURANCE POLICY</strong><br/>
          I waive the internal coverage program. I undertake to submit details of my own external policy and sign the mandatory <strong>Loss Payee Nomination Mandate</strong> to secure SASSC/Phoenix as the primary loss beneficiary up to the outstanding balance.
        </div>
      </div>

      <div class="signatures">
        <div class="sig-row">
          <div class="sig-box">
            <strong>CONSUMER / DEBTOR SIGNATURE</strong><br/>
            Name: ${customerName}<br/>
            Date: ${agreementDate}
          </div>
          <div class="sig-box">
            <strong>FOR CREDIT PROVIDER</strong><br/>
            Phoenix Financial Services (Pty) Ltd<br/>
            Date: ${agreementDate}
          </div>
        </div>
      </div>

      <div class="watermark">
        Phoenix Legal & Compliance Department | NCR/CP/10452 | Document Ref: SEC106-CHOICE-${agreementNumber}
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

/**
 * Prints the Loss Payee Nomination Mandate for external policies
 */
export const printLossPayeeNominationMandate = (agreement: Agreement, customer: Customer) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const agreementNumber = agreement.agrNumber;
  const agreementDate = formatDateFriendly(agreement.date);
  const idNum = customer.idNumber || '—';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Loss Payee Nomination Mandate - ${agreementNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.5;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 2px solid #334155;
          padding-bottom: 15px;
        }
        .title {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          color: #0f172a;
        }
        .subtitle {
          font-size: 10px;
          color: #475569;
          margin-top: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        td {
          padding: 6px;
          border: 1px solid #cbd5e1;
          vertical-align: top;
        }
        .label {
          background-color: #f8fafc;
          font-weight: bold;
          width: 30%;
        }
        .section-title {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          background-color: #0f172a;
          color: #ffffff;
          padding: 5px 8px;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .terms {
          text-align: justify;
          margin-bottom: 20px;
        }
        .signatures {
          margin-top: 45px;
        }
        .sig-row {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
        }
        .sig-box {
          width: 45%;
          border-top: 1px solid #1e293b;
          padding-top: 8px;
        }
        .watermark {
          text-align: center;
          font-size: 8px;
          color: #94a3b8;
          margin-top: 50px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Loss Payee Nomination Mandate</div>
        <div class="subtitle">EXTERNAL CREDIT LIFE INSURANCE POLICY BENEFICIARY DESIGNATION</div>
      </div>

      <table>
        <tr>
          <td class="label">Policy Holder Name:</td>
          <td>${customerName}</td>
          <td class="label">Identity Number:</td>
          <td>${idNum}</td>
        </tr>
        <tr>
          <td class="label">Designated Creditor:</td>
          <td>SASSC / Phoenix Financial Services (Pty) Ltd</td>
          <td class="label">Credit Agreement Ref:</td>
          <td><strong>${agreementNumber}</strong></td>
        </tr>
        <tr>
          <td class="label">External Insurer:</td>
          <td>__________________________________</td>
          <td class="label">External Policy Number:</td>
          <td>__________________________________</td>
        </tr>
      </table>

      <div class="section-title">1. Legal Instruction to External Insurer</div>
      <div class="terms">
        In terms of Section 106(4) of the National Credit Act, I hereby instruct and mandate the above-mentioned external insurer to register <strong>Phoenix Financial Services (Pty) Ltd</strong> (or its parent entity, <strong>SASSC Pty Ltd</strong>) as the <strong>Sole Primary Loss Payee</strong> and beneficiary on my credit insurance policy.
        <br/><br/>
        In the event of my death, permanent disability, temporary disability, or retrenchment during the currency of my indebtedness to SASSC/Phoenix, any benefits or claim payouts payable under this policy must first be paid directly to SASSC/Phoenix up to the full value of my remaining, outstanding debt liability.
      </div>

      <div class="section-title">2. Underwriting Authority & Waiver</div>
      <div class="terms">
        I hereby authorize SASSC/Phoenix to query, audit, verify and verify the status, premiums, and validity of my external insurance policy with my insurer at any stage. Should I fail to maintain this external policy, or should it lapse, I understand that SASSC/Phoenix reserves the right to register me on the internal statutory Credit Life Insurance program to protect the outstanding financial welfare loan.
      </div>

      <div class="signatures">
        <div class="sig-row">
          <div class="sig-box">
            <strong>CONSUMER / POLICY HOLDER SIGNATURE</strong><br/>
            Name: ${customerName}<br/>
            Date: ${agreementDate}
          </div>
          <div class="sig-box">
            <strong>FOR REGISTERED CREDIT PROVIDER</strong><br/>
            Phoenix Financial Services (Pty) Ltd<br/>
            Date: ${agreementDate}
          </div>
        </div>
      </div>

      <div class="watermark">
        Phoenix Legal & Compliance Department | NCR/CP/10452 | Document Ref: SEC106-LOSSPAYEE-${agreementNumber}
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

/**
 * Prints the Form 20 Pre-Agreement Statement & Quotation
 */
export const printForm20Quotation = (agreement: Agreement, customer: Customer) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const agreementNumber = agreement.agrNumber;
  const agreementDate = formatDateFriendly(agreement.date);
  const repaymentDate = formatDateFriendly(agreement.dueDate);
  const idNum = customer.idNumber || '—';

  const goods = agreement.goods || 0;
  const loan = agreement.loan || 0;
  const principal = goods + loan;
  const initiation = agreement.initiationFee || 0;
  const service = agreement.serviceFee || 0;
  const insurance = agreement.insurancePremium || 0;
  const vat = agreement.vatAmount || 0;
  const total = agreement.totalAmount || 0;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Form 20 Pre-Agreement Statement & Quotation - ${agreementNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.4;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
        }
        .title {
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          color: #0f172a;
        }
        .subtitle {
          font-size: 10px;
          color: #475569;
          margin-top: 3px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        td, th {
          padding: 6px;
          border: 1px solid #cbd5e1;
          text-align: left;
        }
        th {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: bold;
        }
        .label {
          background-color: #f8fafc;
          font-weight: bold;
          width: 35%;
        }
        .section-title {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          background-color: #475569;
          color: #ffffff;
          padding: 5px;
          margin-top: 15px;
          margin-bottom: 5px;
        }
        .right-text {
          text-align: right;
        }
        .bold-total {
          font-weight: bold;
          font-size: 12px;
          background-color: #f1f5f9;
        }
        .terms {
          font-size: 9.5px;
          color: #334155;
          text-align: justify;
          margin-top: 15px;
        }
        .signatures {
          margin-top: 35px;
        }
        .sig-row {
          display: flex;
          justify-content: space-between;
          margin-top: 25px;
        }
        .sig-box {
          width: 45%;
          border-top: 1px solid #0f172a;
          padding-top: 5px;
        }
        .watermark {
          text-align: center;
          font-size: 8px;
          color: #94a3b8;
          margin-top: 40px;
          border-top: 1px dashed #cbd5e1;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Form 20 Pre-Agreement Statement & Quotation</div>
        <div class="subtitle">NATIONAL CREDIT REGULATOR COMPLIANT DISCLOSURE DOCUMENT</div>
      </div>

      <table>
        <tr>
          <td class="label">Consumer Full Names:</td>
          <td>${customerName}</td>
          <td class="label">ID / Passport Number:</td>
          <td>${idNum}</td>
        </tr>
        <tr>
          <td class="label">Credit Provider:</td>
          <td>Phoenix Financial Services (Pty) Ltd</td>
          <td class="label">NCR Registration Number:</td>
          <td>NCR/CP/10452</td>
        </tr>
        <tr>
          <td class="label">Quote Date:</td>
          <td>${agreementDate}</td>
          <td class="label">Repayment Date:</td>
          <td><strong>${repaymentDate}</strong></td>
        </tr>
      </table>

      <div class="section-title">1. Itemised Cost Breakdown & Disclosure</div>
      <table>
        <thead>
          <tr>
            <th>Cost Element Description</th>
            <th class="right-text">Value (ZAR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">Principal Goods Capital (Groceries):</td>
            <td class="right-text">${formatCurrency(goods)}</td>
          </tr>
          <tr>
            <td class="label">Principal Cash Loan Advance:</td>
            <td class="right-text">${formatCurrency(loan)}</td>
          </tr>
          <tr style="font-weight: bold;">
            <td class="label">Total Capital Principal Debt:</td>
            <td class="right-text">${formatCurrency(principal)}</td>
          </tr>
          <tr>
            <td class="label">NCA Initiation Fee (10% on Capital):</td>
            <td class="right-text">${formatCurrency(initiation)}</td>
          </tr>
          <tr>
            <td class="label">NCA Monthly Credit Service Fee:</td>
            <td class="right-text">${formatCurrency(service)}</td>
          </tr>
          <tr>
            <td class="label">Credit Life Insurance (NCA Declining Balance Basis):</td>
            <td class="right-text">${formatCurrency(insurance)}</td>
          </tr>
          <tr>
            <td class="label">Welfare Welfare Program Interest Rate:</td>
            <td class="right-text">R 0.00 (0.00% Interest-Free)</td>
          </tr>
          <tr>
            <td class="label">15% VAT:</td>
            <td class="right-text">${formatCurrency(vat)}</td>
          </tr>
          <tr class="bold-total">
            <td>TOTAL REPAYABLE COST OF CREDIT:</td>
            <td class="right-text" style="color: #b45309;">${formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">2. Quotation Validity & Terms</div>
      <div class="terms">
        This Pre-Agreement Statement and Quotation is valid and binding on the Credit Provider for a statutory period of <strong>5 business days</strong> from the Quote Date specified above. You are under no obligation to accept this credit. If accepted, this quote will serve as the financial appendix to your Acknowledgement of Debt (AOD) agreement.
        <br/><br/>
        There are no hidden costs, annual charges, or penalty rates on this interest-free social welfare package.
      </div>

      <div class="signatures">
        <div class="sig-row">
          <div class="sig-box">
            <strong>CONSUMER ACCEPTANCE SIGNATURE</strong><br/>
            I hereby accept this statutory quotation.<br/>
            Date: ${agreementDate}
          </div>
          <div class="sig-box">
            <strong>AUTHORIZED REPRESENTATIVE</strong><br/>
            For Phoenix Financial Services (Pty) Ltd<br/>
            Date: ${agreementDate}
          </div>
        </div>
      </div>

      <div class="watermark">
        Phoenix Financial Services (Pty) Ltd | Registered National Credit Provider | NCR/CP/10452
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};

/**
 * Prints a complete identity profile summary sheet for debt enforcement or collections
 */
export const printCustomerIdentityProfile = (customer: Customer, agreements: Agreement[]) => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const fileNo = customer.fileNo || '—';
  const phone = customer.phone || '—';
  const workPhone = customer.workPhone || '—';
  const email = customer.email || '—';
  const idNumber = customer.idNumber || '—';
  const address = customer.address || '—';
  const workAddress = customer.workAddress || '—';
  const employer = customer.employer || '—';
  const salaryDay = customer.salaryDay || '—';
  const incomeSource = customer.incomeSource || '—';
  const church = customer.church || '—';
  const pastor = customer.pastor || '—';
  const notes = customer.notes || '—';
  
  const customerAgreements = agreements.filter(a => a.customerId === customer.id);
  const totalExposure = customerAgreements.reduce((sum, a) => sum + (a.status !== 'paid' ? a.balance : 0), 0);

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Default Collection Portfolio - File #${fileNo}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.4;
          font-size: 11px;
          margin: 0;
          padding: 30px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 18px;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .header h2 {
          font-size: 12px;
          margin: 5px 0 0 0;
          color: #4b5563;
        }
        .profile-container {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        .photo-box {
          width: 150px;
          height: 150px;
          border: 2px solid #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .photo-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .details-box {
          flex-grow: 1;
        }
        .section-title {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          background: #f3f4f6;
          padding: 4px 8px;
          margin-top: 15px;
          margin-bottom: 8px;
          border-left: 3px solid #1a1a1a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        th, td {
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
        }
        td.label {
          font-weight: bold;
          width: 30%;
          color: #374151;
        }
        .agreements-table th {
          background: #1a1a1a;
          color: #fff;
          font-size: 9px;
          text-transform: uppercase;
        }
        .agreements-table td, .agreements-table th {
          border: 1px solid #e5e7eb;
          padding: 5px;
        }
        .right {
          text-align: right;
        }
        .danger-alert {
          border: 1px solid #dc2626;
          background: #fef2f2;
          color: #991b1b;
          padding: 8px;
          border-radius: 4px;
          font-weight: bold;
          margin-bottom: 15px;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Phoenix Financial Services (Pty) Ltd</h1>
          <h2>Customer Identity & Collection Dossier (NCA Compliance)</h2>
        </div>
        <div class="right">
          <strong>FILE NO: #${fileNo}</strong><br/>
          Date Generated: ${new Date().toLocaleDateString('en-ZA')}
        </div>
      </div>

      <div class="danger-alert">
        CONFIDENTIAL COLLECTION PORTFOLIO — FOR DEBT RECOVERY ENFORCEMENT PURPOSES ONLY. DO NOT CONVEY TO PUBLIC REPOSITORIES.
      </div>

      <div class="profile-container">
        <div class="photo-box">
          ${customer.photoUrl ? `<img src="${customer.photoUrl}" alt="Identity Photo" />` : '<div style="color: #9ca3af; text-align: center; font-size: 10px;">NO PROFILE PHOTO<br/>UPLOADED</div>'}
        </div>
        <div class="details-box">
          <div class="section-title" style="margin-top: 0;">Personal Identity Details</div>
          <table>
            <tr>
              <td class="label">Full Name:</td>
              <td>${customerName}</td>
              <td class="label">ID Number:</td>
              <td>${idNumber}</td>
            </tr>
            <tr>
              <td class="label">Contact Cell:</td>
              <td>${phone}</td>
              <td class="label">Email Address:</td>
              <td>${email}</td>
            </tr>
            <tr>
              <td class="label">Physical Address:</td>
              <td colspan="3">${address}</td>
            </tr>
          </table>
        </div>
      </div>

      <div class="section-title">Employment & Financial Profile</div>
      <table>
        <tr>
          <td class="label">Employer Name:</td>
          <td>${employer}</td>
          <td class="label">Work Contact:</td>
          <td>${workPhone}</td>
        </tr>
        <tr>
          <td class="label">Salary Payment Day:</td>
          <td>${salaryDay}</td>
          <td class="label">Income Source:</td>
          <td>${incomeSource}</td>
        </tr>
        <tr>
          <td class="label">Work Address:</td>
          <td colspan="3">${workAddress}</td>
        </tr>
        <tr>
          <td class="label">Social / Church:</td>
          <td>${church} (Pastor: ${pastor})</td>
          <td class="label">Credit Limit Approved:</td>
          <td>${(customer.creditLimit || 0).toFixed(2)}</td>
        </tr>
      </table>

      <div class="section-title">Credit Ledger Summary & Default Exposure</div>
      <p style="margin: 0 0 8px 0;">Total Outstanding Exposure: <strong>R ${totalExposure.toFixed(2)}</strong> across <strong>${customerAgreements.length}</strong> contract(s).</p>
      
      <table class="agreements-table">
        <thead>
          <tr>
            <th>Agreement No</th>
            <th>Date Signed</th>
            <th>Due Date</th>
            <th>Approved Amt</th>
            <th>Current Balance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${customerAgreements.length === 0 ? `
            <tr>
              <td colspan="6" style="text-align: center; color: #6b7280;">No agreements recorded for this customer.</td>
            </tr>
          ` : customerAgreements.map(a => `
            <tr>
              <td>${a.agrNumber}</td>
              <td>${a.date}</td>
              <td>${a.dueDate}</td>
              <td>R ${(a.totalAmount || 0).toFixed(2)}</td>
              <td class="right" style="font-weight: bold; color: ${a.balance > 0 ? '#b91c1c' : '#047857'};">R ${(a.balance || 0).toFixed(2)}</td>
              <td style="text-transform: uppercase; font-weight: bold; color: ${a.status === 'overdue' ? '#b91c1c' : '#374151'}">${a.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${customer.bank ? `
        <div class="section-title">Verified Bank Account Details (Salary Routing)</div>
        <table>
          <tr>
            <td class="label">Bank Name:</td>
            <td>${customer.bank.name || '—'}</td>
            <td class="label">Account Number:</td>
            <td>${customer.bank.accountNumber || '—'}</td>
          </tr>
          <tr>
            <td class="label">Branch Route Code:</td>
            <td>${customer.bank.branchCode || '—'}</td>
            <td class="label">Account Holder:</td>
            <td>${customer.bank.holder || '—'}</td>
          </tr>
        </table>
      ` : ''}

      <div class="section-title">Internal Credit Controller & Enforcement Notes</div>
      <div style="border: 1px solid #d1d5db; padding: 10px; background: #f9fafb; min-height: 50px; font-style: italic;">
        ${notes}
      </div>

      <div style="margin-top: 30px; text-align: center; color: #6b7280; font-size: 9px; border-top: 1px dashed #d1d5db; padding-top: 10px;">
        Phoenix Financial Services (Pty) Ltd | National Credit Regulator Registration Number: NCR/CP/10452 | Strictly Confidential System Generated Dossier
      </div>
    </body>
    </html>
  `;
  triggerPrint(html);
};


