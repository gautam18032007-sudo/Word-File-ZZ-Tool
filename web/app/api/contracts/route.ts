import { NextResponse } from 'next/server';
import { readContracts } from '@/lib/store';
import { readCertificates } from '@/lib/certStore';

export async function GET() {
  const contracts = readContracts();
  const certs = readCertificates();

  // Normalize certificates to match ContractRecord interface structure
  const normalizedCerts = certs.map(c => ({
    contract_no: c.id,
    type: 'certificate',
    party_name: c.name,
    generated_at: c.generatedAt,
    docx: '', // no docx for certificates
    pdf: c.pdf,
    folder: 'certificates',
    designation: c.designation,
    certificateType: c.certificateType,
    template: c.template,
  }));

  // Combine and sort newest first
  const combined = [...contracts, ...normalizedCerts].sort((a, b) => {
    return new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime();
  });

  return NextResponse.json({ contracts: combined });
}
