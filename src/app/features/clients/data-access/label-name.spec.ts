import { abbreviateClientLabelName } from './label-name';

describe('abbreviateClientLabelName', () => {
  it('pessoa física com sobrenome vira primeiro nome + inicial', () => {
    expect(abbreviateClientLabelName({ name: 'Marcos Augusto', person_type: 'individual' })).toBe('Marcos A.');
  });

  it('pessoa física de uma palavra só mostra o nome inteiro', () => {
    expect(abbreviateClientLabelName({ name: 'Marcos', person_type: 'individual' })).toBe('Marcos');
  });

  it('pessoa física com mais de dois nomes usa só o segundo pra inicial', () => {
    expect(abbreviateClientLabelName({ name: 'Marcos Augusto Silva', person_type: 'individual' })).toBe('Marcos A.');
  });

  it('empresa com nome fantasia usa o nome fantasia, sem abreviar', () => {
    expect(
      abbreviateClientLabelName({ name: 'Clínica Saúde e Bem Estar Ltda', trade_name: 'Clínica Vida', person_type: 'company' }),
    ).toBe('Clínica Vida');
  });

  it('empresa sem nome fantasia aplica a regra de iniciais na razão social', () => {
    expect(abbreviateClientLabelName({ name: 'Clínica Saúde Ltda', person_type: 'company' })).toBe('Clínica S.');
  });

  it('empresa sem nome fantasia e razão social de uma palavra mostra a palavra inteira', () => {
    expect(abbreviateClientLabelName({ name: 'Hospital', person_type: 'company' })).toBe('Hospital');
  });

  it('trade_name em branco é tratado como ausente', () => {
    expect(abbreviateClientLabelName({ name: 'Clínica Saúde Ltda', trade_name: '   ', person_type: 'company' })).toBe('Clínica S.');
  });

  it('person_type ausente (cadastro legado) é tratado como empresa', () => {
    expect(abbreviateClientLabelName({ name: 'Clínica Saúde Ltda', trade_name: 'Clínica Vida' })).toBe('Clínica Vida');
    expect(abbreviateClientLabelName({ name: 'Clínica Saúde Ltda' })).toBe('Clínica S.');
  });

  it('ignora espaços extras entre as palavras', () => {
    expect(abbreviateClientLabelName({ name: '  Marcos   Augusto  ', person_type: 'individual' })).toBe('Marcos A.');
  });
});
