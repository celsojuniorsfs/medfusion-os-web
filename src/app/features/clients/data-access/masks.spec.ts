import { formatCep, formatCnpj, formatCpf, formatPhone, formatTaxId, toTitleCase } from './masks';

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
  it('without personType, applies the CPF mask while there are 11 digits or fewer', () => {
    expect(formatTaxId('11144477735')).toBe('111.444.777-35');
  });

  it('without personType, switches to the CNPJ mask from the 12th digit onward', () => {
    expect(formatTaxId('312332180001')).toBe('31.233.218/0001');
    expect(formatTaxId('31233218000110')).toBe('31.233.218/0001-10');
  });

  it('with personType "individual", always applies the CPF mask', () => {
    expect(formatTaxId('11144477735', 'individual')).toBe('111.444.777-35');
  });

  it('with personType "company", always applies the CNPJ mask, even with few digits', () => {
    expect(formatTaxId('312332180001', 'company')).toBe('31.233.218/0001');
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

describe('toTitleCase', () => {
  it('capitalizes the first letter of each word from an all-uppercase name', () => {
    expect(toTitleCase('CELSO LUIZ TESTE LTDA')).toBe('Celso Luiz Teste Ltda');
  });

  it('lowercases particles ("de", "do"...) that are not the first word', () => {
    expect(toTitleCase('elza costa de andrade')).toBe('Elza Costa de Andrade');
    expect(toTitleCase('santa fé do sul')).toBe('Santa Fé do Sul');
  });

  it('capitalizes a particle when it is the first word of the whole name', () => {
    expect(toTitleCase('da silva')).toBe('Da Silva');
  });

  it('capitalizes the letter right after a hyphen', () => {
    expect(toTitleCase('jean-pierre')).toBe('Jean-Pierre');
    expect(toTitleCase('ana-clara')).toBe('Ana-Clara');
  });

  it('capitalizes the letter right after an apostrophe', () => {
    expect(toTitleCase("o'connor")).toBe("O'Connor");
  });

  it('treats a leading "d\'" as a lowercase particle unless it is the first word', () => {
    expect(toTitleCase("maria d'ávila")).toBe("Maria d'Ávila");
    expect(toTitleCase("d'ávila")).toBe("D'Ávila");
  });

  it('preserves accented characters and trims surrounding whitespace', () => {
    expect(toTitleCase('  HOSPITAL SÃO LUCAS  ')).toBe('Hospital São Lucas');
  });
});
