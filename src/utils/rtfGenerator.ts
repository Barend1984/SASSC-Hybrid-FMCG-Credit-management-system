import { Agreement, Customer } from '../types';

/**
 * Formats a number as R X.XX
 */
const formatCurrency = (amount: number): string => {
  return (amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
 * Generates the "Acknowledgement of Debt" RTF document
 */
export const generateAcknowledgementOfDebt = (agreement: Agreement, customer: Customer): string => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const totalRepay = formatCurrency(agreement.totalAmount);
  const repaymentDate = formatDateFriendly(agreement.dueDate);
  const contact = customer.phone || '—';
  const idNum = customer.idNumber || '—';
  const fileNo = customer.fileNo || '—';
  const invoiceNumber = agreement.agrNumber;

  return `{\\rtf1\\ansi\\deff0

\\b ACKNOWLEDGEMENT OF DEBT\\b0\\par

Lerato Community Financial service\\par

------------------------------------------------------------\\par

I, ${customerName}, with ID Number ${idNum}, hereby acknowledge that I have received the goods listed in Invoice Number ${invoiceNumber}.\\par

I agree to repay the total outstanding amount of R${totalRepay} on or before ${repaymentDate}.\\par

I understand that this agreement forms part of the credit agreement entered into with Lerato Community Financial service.\\par

------------------------------------------------------------\\par

Customer ID: ${fileNo}\\par
Customer Name: ${customerName}\\par
Contact Number: ${contact}\\par

------------------------------------------------------------\\par

Amount Owed: R${totalRepay}\\par
Repayment Date: ${repaymentDate}\\par

------------------------------------------------------------\\par

Customer Signature: ___________________________\\par

Date: ___________________________\\par

Lerato Representative: _________________________\\par

}`;
};

/**
 * Generates the "Lerato Account Invoice" RTF document
 */
export const generateAccountInvoice = (agreement: Agreement, customer: Customer): string => {
  const customerName = `${customer.firstNames} ${customer.surname}`.trim() || customer.name;
  const invoiceNumber = agreement.agrNumber;
  const invoiceDate = formatDateFriendly(agreement.date);
  const repaymentDate = formatDateFriendly(agreement.dueDate);
  const idNum = customer.idNumber || '—';
  const fileNo = customer.fileNo || '—';
  const contact = customer.phone || '—';
  const address = customer.address || '—';

  // Format purchased items for RTF
  let itemsFormatted = '';
  if (agreement.items && agreement.items.length > 0) {
    itemsFormatted = agreement.items
      .map((item) => `${item.name} x${item.qty} -- R${formatCurrency(item.price * item.qty)}`)
      .join('\\par\n');
  } else {
    itemsFormatted = `Credit advance transaction\\par\nGroceries: R${formatCurrency(agreement.goods)}\\par\nCash Loan: R${formatCurrency(agreement.loan)}`;
  }

  const subtotalStr = formatCurrency(agreement.goods + agreement.loan);
  const iniFeeStr = formatCurrency(agreement.initiationFee);
  const svcFeeStr = formatCurrency(agreement.serviceFee);
  const totalStr = formatCurrency(agreement.totalAmount);

  return `{\\rtf1\\ansi\\deff3\\adeflang1025
{\\fonttbl{\\f0\\froman\\fprq2\\fcharset0 Times New Roman;}{\\f1\\froman\\fprq2\\fcharset2 Symbol;}{\\f2\\fswiss\\fprq2\\fcharset0 Arial;}{\\f3\\froman\\fprq2\\fcharset0 Liberation Serif{\\*\\falt Times New Roman};}{\\f4\\fswiss\\fprq2\\fcharset0 Liberation Sans{\\*\\falt Arial};}{\\f5\\fnil\\fprq2\\fcharset0 Microsoft YaHei;}{\\f6\\fnil\\fprq2\\fcharset0 Lucida Sans;}{\\f7\\fswiss\\fprq0\\fcharset128 Lucida Sans;}}
{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;\\red0\\green255\\blue255;\\red0\\green255\\blue0;\\red255\\green0\\blue255;\\red255\\green0\\blue0;\\red255\\green255\\blue255;\\red0\\green0\\blue128;\\red0\\green128\\blue128;\\red0\\green128\\blue0;\\red128\\green0\\blue128;\\red128\\green0\\blue0;\\red128\\green128\\blue0;\\red128\\green128\\blue128;\\red192\\green192\\blue192;}
{\\stylesheet{\\s0\\snext0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052 Normal;}
{\\s15\\sbasedon0\\snext16\\rtlch\\af6\\afs28 \\ltrch\\hich\\af4\\loch\\sb240\\sa120\\keepn\\f4\\fs28\\dbch\\af5 Heading;}
{\\s16\\sbasedon0\\snext16\\loch\\sl276\\slmult1\\sb0\\sa140 Body Text;}
{\\s17\\sbasedon16\\snext17\\rtlch\\af7 \\ltrch List;}
{\\s18\\sbasedon0\\snext18\\rtlch\\af7\\afs24\\ai \\ltrch\\loch\\sb120\\sa120\\noline\\fs24\\i caption;}
{\\s19\\sbasedon0\\snext19\\rtlch\\af7 \\ltrch\\loch\\noline Index;}
}{\\*\\generator LibreOffice/25.2.4.3$Windows_X86_64 LibreOffice_project/33e196637044ead23f5c3226cde09b47731f7e27}{\\info{\\creatim\\yr2026\\mo5\\dy25\\hr22\\min31}{\\revtim\\yr2026\\mo5\\dy25\\hr22\\min40}{\\printim\\yr0\\mo0\\dy0\\hr0\\min0}}{\\*\\userprops}\\deftab709
\\hyphauto1\\viewscale90\\formshade\\nobrkwrptbl\\paperh16838\\paperw11906\\margl1134\\margr1134\\margt1134\\margb1134\\sectd\\sbknone\\sftnnar\\saftnnrlc\\sectunlocked1\\pgwsxn11906\\pghsxn16838\\marglsxn1134\\margrsxn1134\\margtsxn1134\\margbsxn1134\\ftnbj\\ftnstart1\\ftnrstcont\\ftnnar\\fet\\aftnrstcont\\aftnstart1\\aftnnrlc
{\\*\\ftnsep\\chftnsep}\\pgndec\\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
\\{\\\\rtf1\\\\ansi\\\\deff0\\}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
\\\\b LERATO ACCOUNT INVOICE\\\\b0\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Lerato Community Financial service\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
------------------------------------------------------------\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Invoice Number: ${invoiceNumber}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Invoice Date: ${invoiceDate}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Repayment Date: ${repaymentDate}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
------------------------------------------------------------\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
\\\\b CUSTOMER INFORMATION\\\\b0\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Customer ID: ${fileNo}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Customer Name: ${customerName}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
ID Number: ${idNum}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Contact Number: ${contact}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Address: ${address}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
------------------------------------------------------------\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
\\\\b PURCHASED ITEMS\\\\b0\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
${itemsFormatted}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
------------------------------------------------------------\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Subtotal: R${subtotalStr}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Initiation Fee: R${iniFeeStr}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Service Fee: R${svcFeeStr}\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar\\loch

\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
\\\\b TOTAL AMOUNT PAYABLE: R${totalStr}\\\\b0\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
------------------------------------------------------------\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Customer Signature: ___________________________\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
Date: ___________________________\\\\par}
\\par \\pard\\plain \\s0\\rtlch\\af6\\afs24\\alang1081 \\ltrch\\lang7177\\langfe2052\\hich\\af3\\loch\\widctlpar\\hyphpar0\\ltrpar\\cf0\\f3\\fs24\\lang7177\\kerning1\\dbch\\af8\\langfe2052\\ql\\ltrpar{\\loch
\\\\}}
\\par }`;
};

/**
 * Triggers a file download in the browser
 */
export const downloadRtfFile = (fileName: string, content: string): void => {
  const blob = new Blob([content], { type: 'application/rtf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.rtf') ? fileName : `${fileName}.rtf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
