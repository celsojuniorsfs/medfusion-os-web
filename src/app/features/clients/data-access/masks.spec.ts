import { formatCep, formatCnpj, formatCpf, formatPhone, formatTaxId } from './masks';

describe('formatCpf', () => {
  it('formats progressively as digits are typed', () => {
    expect(formatCpf('111')).toBe('111');
    expect(formatCpf('1114')).toBe('111.4');
    expect(formatCpf('11144477735')).toBe('111.444.777-35');
  });

  it('ignores non-digit characters and extra digits past 11', () => {
    expect(formatCpf('111.444.777-35extra')).toBe('111.444.777-35');
  });
});

describe('formatCnpj', () => {
  it('formats a complete CNPJ', () => {
    expect(formatCnpj('31233218000110')).toBe('31.233.218/0001-10');
  });
});

describe('formatTaxId', () => {
  it('applies the CPF mask while there are 11 digits or fewer', () => {
    expect(formatTaxId('11144477735')).toBe('111.444.777-35');
  });

  it('switches to the CNPJ mask from the 12th digit onward', () => {
    expect(formatTaxId('312332180001')).toBe('31.233.218/0001');
    expect(formatTaxId('31233218000110')).toBe('31.233.218/0001-10');
  });
});

describe('formatPhone', () => {
  it('formats an 11-digit mobile number', () => {
    expect(formatPhone('17999999999')).toBe('(17) 99999-9999');
  });
});

describe('formatCep', () => {
  it('formats an 8-digit CEP', () => {
    expect(formatCep('15775000')).toBe('15775-000');
  });
});
